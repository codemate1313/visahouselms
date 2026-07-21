import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from random import SystemRandom
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload, selectinload

from app.config import settings
from app.models.attempt import (
    ATTEMPT_GRADED,
    ATTEMPT_GRADING,
    ATTEMPT_IN_PROGRESS,
    ATTEMPT_READY,
    ATTEMPT_SUBMITTED,
    ATTEMPT_FLAG_TYPES,
    AttemptAnswer,
    AttemptFlag,
    AttemptPartGrade,
    TestAttempt,
)
from app.models.exam_module import ExamModule, ExamModuleAsset, ExamModulePart, ExamModuleQuestion
from app.models.user import User
from app.models.user_session import UserSession
from app.services import cefr_service

# Small buffer so a slow network round-trip near the deadline doesn't cost
# the student their last answer - the server clock is still authoritative.
EXPIRY_BUFFER_MINUTES = 2
FINAL_TEST_HEARTBEAT_GRACE_SECONDS = 30
_randomizer = SystemRandom()

FLAG_SEVERITY = {
    "blur": "low",
    "visibility_change": "medium",
    "fullscreen_exit": "high",
    "camera_stopped": "high",
    "microphone_stopped": "high",
    "screen_share_stopped": "critical",
    "screen_surface_invalid": "critical",
    "concurrent_tab": "critical",
    "clipboard": "low",
    "print_attempt": "high",
    "context_menu": "low",
    "ip_change": "medium",
}
FLAG_RISK_WEIGHT = {"low": 1, "medium": 2, "high": 3, "critical": 5}


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _utc_out(value: Optional[datetime]) -> Optional[datetime]:
    """Attach the UTC offset omitted by the database's naive UTC columns."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _attempt_query(db: Session):
    return db.query(TestAttempt).options(
        joinedload(TestAttempt.module).selectinload(ExamModule.parts).selectinload(ExamModulePart.questions),
        joinedload(TestAttempt.module).selectinload(ExamModule.parts).selectinload(ExamModulePart.assets),
        selectinload(TestAttempt.answers),
        selectinload(TestAttempt.part_grades),
        selectinload(TestAttempt.flags),
    )


def get_attempt_or_404(db: Session, user: User, attempt_id: int) -> TestAttempt:
    attempt = _attempt_query(db).filter(TestAttempt.id == attempt_id).first()
    if attempt is None or attempt.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found")
    return attempt


def _build_content_snapshot(module: ExamModule, *, randomize: bool) -> dict:
    """Freeze student-visible content and marking keys for this sitting."""
    parts: dict[str, dict] = {}
    part_ids = [part.id for part in sorted(module.parts, key=lambda item: item.sort_order)]
    for part in module.parts:
        questions = sorted(part.questions, key=lambda item: item.sort_order)
        if randomize:
            questions = questions[:]
            _randomizer.shuffle(questions)
        question_ids: list[int] = []
        question_data: dict[str, dict] = {}
        for question in questions:
            options = [dict(item) for item in (question.options or [])]
            if randomize and len(options) > 1:
                _randomizer.shuffle(options)
            question_ids.append(question.id)
            question_data[str(question.id)] = {
                "question_type": question.question_type,
                "prompt": question.prompt,
                "instructions": question.instructions,
                "passage": question.passage,
                "options": options,
                "correct_answers": list(question.correct_answers or []),
                "explanation": question.explanation,
                "points": str(question.points),
                "sort_order": question.sort_order,
            }
        parts[str(part.id)] = {"question_ids": question_ids, "questions": question_data}
    return {"version": 1, "part_ids": part_ids, "parts": parts}


def _snapshot_question(attempt: TestAttempt, part_id: int, question_id: int) -> Optional[dict]:
    snapshot = attempt.content_snapshot or {}
    return snapshot.get("parts", {}).get(str(part_id), {}).get("questions", {}).get(str(question_id))


def _ordered_questions(attempt: TestAttempt, part: ExamModulePart) -> list[ExamModuleQuestion]:
    by_id = {question.id: question for question in part.questions}
    ids = (attempt.content_snapshot or {}).get("parts", {}).get(str(part.id), {}).get("question_ids")
    if ids:
        return [by_id[question_id] for question_id in ids if question_id in by_id]
    return sorted(part.questions, key=lambda item: item.sort_order)


def start_attempt(db: Session, user: User, module: ExamModule) -> dict:
    is_final = module.module_type == "final_test"
    if is_final:
        prior = db.query(TestAttempt).filter(
            TestAttempt.user_id == user.id, TestAttempt.module_id == module.id
        ).first()
        if prior is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The Final Test allows only one sitting and has already been attempted",
            )
    else:
        existing = (
            db.query(TestAttempt)
            .filter(
                TestAttempt.user_id == user.id,
                TestAttempt.module_id == module.id,
                TestAttempt.status == ATTEMPT_IN_PROGRESS,
            )
            .first()
        )
        if existing is not None:
            if existing.expires_at > _now():
                return get_student_view(db, get_attempt_or_404(db, user, existing.id))
            _auto_expire(db, existing)

    if user.institute_id is not None:
        from app.dependencies.limits import enforce_limit

        enforce_limit(db, user.institute_id, "tests")

    now = _now()
    expires_at = now + timedelta(minutes=module.duration_minutes + EXPIRY_BUFFER_MINUTES)
    attempt = TestAttempt(
        user_id=user.id,
        module_id=module.id,
        status=ATTEMPT_READY if is_final else ATTEMPT_IN_PROGRESS,
        is_final=is_final,
        security_required=is_final,
        started_at=now,
        expires_at=expires_at,
        content_snapshot=_build_content_snapshot(module, randomize=is_final),
    )
    db.add(attempt)
    db.commit()
    return get_student_view(db, get_attempt_or_404(db, user, attempt.id))


def _auto_expire(db: Session, attempt: TestAttempt) -> None:
    if attempt.status == ATTEMPT_IN_PROGRESS:
        attempt.status = "expired"
        db.add(attempt)
        db.commit()


def _asset_out(asset: ExamModuleAsset, reveal_transcript: bool) -> dict:
    return {
        "id": asset.id,
        "part_id": asset.part_id,
        "asset_type": asset.asset_type,
        "title": asset.title,
        "url": f"/storage/{asset.file_path}",
        "mime_type": asset.mime_type,
        "transcript": asset.transcript if reveal_transcript else None,
    }


def _redacted_question(
    question: ExamModuleQuestion,
    answer: Optional[AttemptAnswer],
    frozen: Optional[dict] = None,
) -> dict:
    source = frozen or {}
    return {
        "id": question.id,
        "question_type": source.get("question_type", question.question_type),
        "prompt": source.get("prompt", question.prompt),
        "instructions": source.get("instructions", question.instructions),
        "passage": source.get("passage", question.passage),
        "options": source.get("options", question.options),
        "points": source.get("points", str(question.points)),
        "sort_order": source.get("sort_order", question.sort_order),
        "response": answer.response if answer else None,
        "audio_path": (f"/storage/{answer.audio_path}" if answer and answer.audio_path else None),
        "revision": answer.revision if answer else 0,
    }


def _revealed_question(
    question: ExamModuleQuestion,
    answer: Optional[AttemptAnswer],
    frozen: Optional[dict] = None,
) -> dict:
    source = frozen or {}
    out = _redacted_question(question, answer, frozen)
    out["correct_answers"] = source.get("correct_answers", question.correct_answers)
    out["explanation"] = source.get("explanation", question.explanation)
    out["is_correct"] = answer.is_correct if answer else None
    out["points_awarded"] = str(answer.points_awarded) if answer and answer.points_awarded is not None else None
    return out


def _serialize_part(
    attempt: TestAttempt,
    part: ExamModulePart,
    *,
    reveal: bool,
    include_questions: bool,
) -> dict:
    answers_by_question = {answer.question_id: answer for answer in attempt.answers}
    grades_by_part = {grade.part_id: grade for grade in attempt.part_grades}
    ordered_questions = _ordered_questions(attempt, part)
    question_fn = _revealed_question if reveal else _redacted_question
    grade = grades_by_part.get(part.id)
    return {
        "id": part.id,
        "section_type": part.section_type,
        "part_code": part.part_code,
        "title": part.title,
        "skill_focus": part.skill_focus,
        "instructions": part.instructions,
        "duration_minutes": part.duration_minutes,
        "auto_marked": part.auto_marked,
        "max_marks": str(part.max_marks) if part.max_marks is not None else None,
        "rubric": part.rubric,
        "cefr_scale": cefr_service.assessment_scale(part.section_type) if not part.auto_marked else [],
        "sort_order": part.sort_order,
        "assets": [_asset_out(asset, reveal_transcript=reveal) for asset in part.assets] if include_questions else [],
        "question_count": len(ordered_questions),
        "answered_count": sum(1 for question in ordered_questions if question.id in answers_by_question),
        "questions": [
            question_fn(
                question,
                answers_by_question.get(question.id),
                _snapshot_question(attempt, part.id, question.id),
            )
            for question in ordered_questions
        ] if include_questions else [],
        "grade": (
            {
                "criteria": [
                    {
                        **criterion,
                        "cefr_level": criterion.get("cefr_level")
                        or cefr_service.criterion_level(
                            criterion.get("marks_awarded"), criterion.get("max_marks")
                        ),
                    }
                    for criterion in (grade.criteria or [])
                ],
                "total_marks": str(grade.total_marks) if grade.total_marks is not None else None,
                "comment": grade.comment,
                "status": grade.status,
            }
            if grade
            else None
        ),
    }


def _serialize_parts(
    attempt: TestAttempt,
    reveal: bool,
    *,
    hide_content: bool = False,
    question_part_id: Optional[int] = None,
) -> list[dict]:
    parts = sorted(attempt.module.parts, key=lambda item: item.sort_order)
    default_part_id = parts[0].id if parts else None
    return [
        _serialize_part(
            attempt,
            part,
            reveal=reveal,
            include_questions=(
                not hide_content
                and (
                    not attempt.security_required
                    or reveal
                    or part.id == (question_part_id or default_part_id)
                )
            ),
        )
        for part in parts
    ]


def get_student_view(
    db: Session,
    attempt: TestAttempt,
    *,
    security_authorized: bool = False,
    question_part_id: Optional[int] = None,
) -> dict:
    from app.services import grading_service

    if attempt.status == ATTEMPT_IN_PROGRESS and attempt.expires_at <= _now():
        _auto_expire(db, attempt)
        attempt = get_attempt_or_404(db, db.get(User, attempt.user_id), attempt.id)
    if attempt.status in (ATTEMPT_GRADING, ATTEMPT_GRADED) and (
        attempt.cefr_profile is None or attempt.cefr_policy_version != cefr_service.POLICY_VERSION
    ):
        cefr_service.apply_evaluation(attempt)
        db.add(attempt)
        db.commit()
    reveal = attempt.status in (ATTEMPT_GRADING, ATTEMPT_GRADED)
    return {
        "id": attempt.id,
        "module_id": attempt.module_id,
        "module_type": attempt.module.module_type,
        "module_title": attempt.module.title,
        "course_id": attempt.course_id,
        "status": attempt.status,
        "is_final": attempt.is_final,
        "security_required": attempt.security_required,
        "security_authorized": security_authorized or not attempt.security_required or reveal,
        "security_started_at": _utc_out(attempt.security_started_at),
        "security_last_heartbeat_at": _utc_out(attempt.security_last_heartbeat_at),
        "security_risk_score": attempt.security_risk_score,
        "started_at": _utc_out(attempt.started_at),
        "expires_at": _utc_out(attempt.expires_at),
        "submitted_at": _utc_out(attempt.submitted_at),
        "raw_score": str(attempt.raw_score) if attempt.raw_score is not None else None,
        "max_score": str(attempt.max_score) if attempt.max_score is not None else None,
        "band_label": attempt.band_label,
        "cefr_level": attempt.cefr_level,
        "cefr_profile": attempt.cefr_profile,
        "cefr_policy_version": attempt.cefr_policy_version,
        "graded_at": _utc_out(attempt.graded_at),
        "flag_count": len(attempt.flags),
        "reevaluation": grading_service.reevaluation_for_student(db, attempt),
        "parts": _serialize_parts(
            attempt,
            reveal=reveal,
            hide_content=(attempt.security_required and not security_authorized and not reveal),
            question_part_id=question_part_id,
        ),
    }


def _attempt_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def security_access_valid(
    attempt: TestAttempt,
    session: UserSession,
    attempt_token: Optional[str],
) -> bool:
    if not attempt.security_required:
        return True
    if (
        not attempt_token
        or not attempt.security_token_hash
        or session.device_id is None
        or session.device_id != attempt.security_device_id
    ):
        return False
    return hmac.compare_digest(_attempt_token_hash(attempt_token), attempt.security_token_hash)


def require_security_access(
    attempt: TestAttempt,
    session: UserSession,
    attempt_token: Optional[str],
) -> None:
    if not security_access_valid(attempt, session, attempt_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Complete the Final Test security check on the registered device to continue",
        )


def require_live_security(attempt: TestAttempt) -> None:
    if not attempt.security_required:
        return
    state = attempt.security_media_state or {}
    required_active = all(
        state.get(key)
        for key in ("camera_active", "microphone_active", "screen_share_active", "fullscreen_active")
    ) and state.get("display_surface") == "monitor"
    heartbeat_fresh = (
        attempt.security_last_heartbeat_at is not None
        and (_now() - attempt.security_last_heartbeat_at).total_seconds() <= FINAL_TEST_HEARTBEAT_GRACE_SECONDS
    )
    if not required_active or not heartbeat_fresh:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Restore camera, microphone, entire-screen sharing, and full screen before continuing",
        )


def _add_security_flag(
    db: Session,
    attempt: TestAttempt,
    flag_type: str,
    meta: Optional[dict] = None,
    *,
    client_sequence: Optional[int] = None,
    client_occurred_at: Optional[datetime] = None,
) -> AttemptFlag:
    if flag_type not in ATTEMPT_FLAG_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown flag type")
    if client_sequence is not None:
        duplicate = db.query(AttemptFlag).filter(
            AttemptFlag.attempt_id == attempt.id,
            AttemptFlag.client_sequence == client_sequence,
        ).first()
        if duplicate is not None:
            return duplicate
    severity = FLAG_SEVERITY[flag_type]
    flag = AttemptFlag(
        attempt_id=attempt.id,
        flag_type=flag_type,
        severity=severity,
        client_sequence=client_sequence,
        client_occurred_at=(
            client_occurred_at.astimezone(timezone.utc).replace(tzinfo=None)
            if client_occurred_at and client_occurred_at.tzinfo
            else client_occurred_at
        ),
        meta=meta,
    )
    attempt.security_risk_score = (attempt.security_risk_score or 0) + FLAG_RISK_WEIGHT[severity]
    db.add_all([flag, attempt])
    return flag


def secure_preflight(
    db: Session,
    attempt: TestAttempt,
    session: UserSession,
    payload: dict,
    ip_address: Optional[str],
) -> dict:
    if not attempt.security_required or not attempt.is_final:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Security preflight is only for Final Tests")
    if attempt.status not in (ATTEMPT_READY, ATTEMPT_IN_PROGRESS):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This Final Test can no longer be resumed")
    if session.device_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="A registered student device is required")
    if not all(
        payload.get(key)
        for key in ("camera_active", "microphone_active", "screen_share_active", "fullscreen_active")
    ) or payload.get("display_surface") != "monitor":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Camera, microphone, full screen, and entire-screen sharing must all be active",
        )
    if attempt.security_device_id is not None and attempt.security_device_id != session.device_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This Final Test is locked to the device where its security check was first completed",
        )

    client_id = payload["client_id"]
    if (
        attempt.status == ATTEMPT_IN_PROGRESS
        and attempt.security_client_id
        and attempt.security_client_id != client_id
        and attempt.security_last_heartbeat_at
        and (_now() - attempt.security_last_heartbeat_at).total_seconds() < FINAL_TEST_HEARTBEAT_GRACE_SECONDS
    ):
        _add_security_flag(db, attempt, "concurrent_tab", {"client_id": client_id})
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This Final Test is active in another browser tab",
        )

    if attempt.security_ip_address and ip_address and attempt.security_ip_address != ip_address:
        _add_security_flag(
            db,
            attempt,
            "ip_change",
            {"previous": attempt.security_ip_address, "current": ip_address},
        )

    raw_token = secrets.token_urlsafe(32)
    attempt.security_device_id = session.device_id
    attempt.security_client_id = client_id
    attempt.security_token_hash = _attempt_token_hash(raw_token)
    attempt.security_ip_address = ip_address
    attempt.security_heartbeat_sequence = 0
    attempt.security_media_state = {
        "camera_active": True,
        "microphone_active": True,
        "screen_share_active": True,
        "fullscreen_active": True,
        "visible": True,
        "focused": True,
        "display_surface": "monitor",
    }
    db.add(attempt)
    db.commit()
    return {
        "attempt_token": raw_token,
        "status": attempt.status,
        "security_required": True,
    }


def begin_secure_attempt(
    db: Session,
    attempt: TestAttempt,
    session: UserSession,
    attempt_token: Optional[str],
) -> dict:
    require_security_access(attempt, session, attempt_token)
    state = attempt.security_media_state or {}
    if not all(
        state.get(key)
        for key in ("camera_active", "microphone_active", "screen_share_active", "fullscreen_active")
    ) or state.get("display_surface") != "monitor":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The security preflight is incomplete")
    if attempt.status == ATTEMPT_READY:
        now = _now()
        attempt.status = ATTEMPT_IN_PROGRESS
        attempt.started_at = now
        attempt.security_started_at = now
        attempt.security_last_heartbeat_at = now
        attempt.expires_at = now + timedelta(
            minutes=attempt.module.duration_minutes + EXPIRY_BUFFER_MINUTES
        )
        db.add(attempt)
        db.commit()
        attempt = get_attempt_or_404(db, db.get(User, attempt.user_id), attempt.id)
    elif attempt.status != ATTEMPT_IN_PROGRESS:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This Final Test cannot be started")
    return get_student_view(db, attempt, security_authorized=True)


def record_heartbeat(
    db: Session,
    attempt: TestAttempt,
    session: UserSession,
    attempt_token: Optional[str],
    payload: dict,
    ip_address: Optional[str],
) -> dict:
    require_security_access(attempt, session, attempt_token)
    _require_in_progress(attempt)
    if payload["client_id"] != attempt.security_client_id:
        _add_security_flag(db, attempt, "concurrent_tab", {"client_id": payload["client_id"]})
        db.commit()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Another browser tab owns this attempt")
    if payload["sequence"] <= attempt.security_heartbeat_sequence:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Stale security heartbeat")

    previous = attempt.security_media_state or {}
    transitions = (
        ("camera_active", "camera_stopped"),
        ("microphone_active", "microphone_stopped"),
        ("screen_share_active", "screen_share_stopped"),
        ("fullscreen_active", "fullscreen_exit"),
    )
    for key, flag_type in transitions:
        if previous.get(key, True) and not payload.get(key):
            _add_security_flag(db, attempt, flag_type, {"source": "heartbeat"})
    if payload.get("display_surface") != "monitor":
        _add_security_flag(db, attempt, "screen_surface_invalid", {"surface": payload.get("display_surface")})
    if attempt.security_ip_address and ip_address and attempt.security_ip_address != ip_address:
        _add_security_flag(
            db,
            attempt,
            "ip_change",
            {"previous": attempt.security_ip_address, "current": ip_address},
        )
        attempt.security_ip_address = ip_address

    attempt.security_heartbeat_sequence = payload["sequence"]
    attempt.security_last_heartbeat_at = _now()
    attempt.security_media_state = {
        key: payload.get(key)
        for key in (
            "camera_active",
            "microphone_active",
            "screen_share_active",
            "fullscreen_active",
            "visible",
            "focused",
            "display_surface",
            "current_part_id",
        )
    }
    db.add(attempt)
    db.commit()
    return {
        "received": True,
        "server_at": _utc_out(attempt.security_last_heartbeat_at),
        "risk_score": attempt.security_risk_score,
    }


def get_attempt_part_view(attempt: TestAttempt, part_id: int) -> dict:
    _require_in_progress(attempt)
    require_live_security(attempt)
    part = next((item for item in attempt.module.parts if item.id == part_id), None)
    if part is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test part not found")
    return _serialize_part(attempt, part, reveal=False, include_questions=True)


def _require_in_progress(attempt: TestAttempt) -> None:
    if attempt.status != ATTEMPT_IN_PROGRESS:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This attempt is no longer in progress")
    if attempt.expires_at <= _now():
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Time is up for this attempt")


def _question_or_404(attempt: TestAttempt, question_id: int) -> tuple[ExamModulePart, ExamModuleQuestion]:
    for part in attempt.module.parts:
        for question in part.questions:
            if question.id == question_id:
                return part, question
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found in this attempt's module")


def save_answer(
    db: Session,
    attempt: TestAttempt,
    question_id: int,
    response: Optional[dict],
    revision: Optional[int] = None,
) -> dict:
    _require_in_progress(attempt)
    part, _question = _question_or_404(attempt, question_id)
    answer = next((item for item in attempt.answers if item.question_id == question_id), None)
    if answer is None:
        answer = AttemptAnswer(attempt_id=attempt.id, question_id=question_id, part_id=part.id)
        db.add(answer)
    current_revision = answer.revision or 0
    next_revision = revision if revision is not None else current_revision + 1
    if next_revision <= current_revision:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A newer answer has already been saved")
    answer.response = response
    answer.revision = next_revision
    db.commit()
    return {"question_id": question_id, "revision": answer.revision, "saved_at": _now()}


def save_audio_answer(
    db: Session, attempt: TestAttempt, question_id: int, content: bytes, extension: str
) -> dict:
    _require_in_progress(attempt)
    part, _question = _question_or_404(attempt, question_id)
    if part.section_type != "speaking":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Audio answers are only for Speaking questions")

    relative = Path("attempt-answers") / str(attempt.id) / f"{uuid4().hex}{extension}"
    destination = settings.storage_path / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(content)

    answer = next((item for item in attempt.answers if item.question_id == question_id), None)
    old_path = None
    if answer is None:
        answer = AttemptAnswer(attempt_id=attempt.id, question_id=question_id, part_id=part.id)
        db.add(answer)
    elif answer.audio_path:
        old_path = settings.storage_path / answer.audio_path
    answer.audio_path = relative.as_posix()
    answer.response = {"recorded": True}
    answer.revision = (answer.revision or 0) + 1
    try:
        db.commit()
    except Exception:
        db.rollback()
        destination.unlink(missing_ok=True)
        raise
    if old_path is not None:
        old_path.unlink(missing_ok=True)
    return {"question_id": question_id, "audio_url": f"/storage/{relative.as_posix()}"}


def record_flag(
    db: Session,
    attempt: TestAttempt,
    flag_type: str,
    meta: Optional[dict],
    client_sequence: Optional[int] = None,
    client_occurred_at: Optional[datetime] = None,
) -> dict:
    _add_security_flag(
        db,
        attempt,
        flag_type,
        meta,
        client_sequence=client_sequence,
        client_occurred_at=client_occurred_at,
    )
    state_key = {
        "camera_stopped": "camera_active",
        "microphone_stopped": "microphone_active",
        "screen_share_stopped": "screen_share_active",
        "fullscreen_exit": "fullscreen_active",
    }.get(flag_type)
    if state_key and attempt.security_media_state:
        attempt.security_media_state = {**attempt.security_media_state, state_key: False}
        db.add(attempt)
    db.commit()
    return {"recorded": True, "risk_score": attempt.security_risk_score}


def _normalize(value) -> str:
    return " ".join(str(value).strip().upper().split())


def _grade_answer(
    question: ExamModuleQuestion,
    response: Optional[dict],
    frozen: Optional[dict] = None,
) -> tuple[Optional[bool], Decimal]:
    source = frozen or {}
    correct = {_normalize(item) for item in source.get("correct_answers", question.correct_answers or [])}
    qtype = source.get("question_type", question.question_type)
    if qtype in ("essay", "speaking_prompt"):
        return None, Decimal("0")
    if not response:
        return False, Decimal("0")

    if qtype in ("mcq_single", "true_false_not_given", "yes_no_not_given"):
        selected = response.get("selected")
        is_correct = bool(selected) and _normalize(selected) in correct
    elif qtype == "mcq_multiple":
        selected = response.get("selected") or []
        is_correct = {_normalize(item) for item in selected} == correct
    elif qtype in ("short_answer", "fill_blank"):
        text = response.get("text")
        is_correct = bool(text) and _normalize(text) in correct
    else:
        return None, Decimal("0")

    return is_correct, (Decimal(source.get("points", question.points)) if is_correct else Decimal("0"))


def submit_attempt(db: Session, attempt: TestAttempt) -> dict:
    if attempt.status != ATTEMPT_IN_PROGRESS:
        # idempotent: a retried submit just returns the current state
        return get_student_view(db, attempt)

    attempt.status = ATTEMPT_SUBMITTED
    attempt.submitted_at = _now()

    answers_by_question = {answer.question_id: answer for answer in attempt.answers}
    raw_score = Decimal("0")
    max_score = Decimal("0")
    needs_grading = False

    for part in attempt.module.parts:
        if part.auto_marked:
            if part.max_marks is not None:
                max_score += Decimal(part.max_marks)
            part_points = Decimal("0")
            for question in part.questions:
                answer = answers_by_question.get(question.id)
                if answer is None:
                    answer = AttemptAnswer(attempt_id=attempt.id, question_id=question.id, part_id=part.id)
                    db.add(answer)
                is_correct, points = _grade_answer(
                    question,
                    answer.response,
                    _snapshot_question(attempt, part.id, question.id),
                )
                answer.is_correct = is_correct
                answer.points_awarded = points
                part_points += points
            raw_score += part_points
        else:
            needs_grading = True
            existing_grade = next((g for g in attempt.part_grades if g.part_id == part.id), None)
            if existing_grade is None:
                db.add(AttemptPartGrade(attempt_id=attempt.id, part_id=part.id, criteria=[]))

    attempt.raw_score = raw_score
    attempt.max_score = max_score if max_score > 0 else None

    if needs_grading:
        attempt.status = ATTEMPT_GRADING
    else:
        attempt.status = ATTEMPT_GRADED
        attempt.graded_at = _now()

    cefr_service.apply_evaluation(attempt)
    db.add(attempt)
    db.flush()
    if needs_grading:
        from app.services import grading_service

        grading_service.ensure_queue_entry(db, attempt)
    completed_now = attempt.status == ATTEMPT_GRADED
    attempt_id = attempt.id
    user_id = attempt.user_id
    db.commit()
    if completed_now:
        from app.services import achievement_service

        achievement_service.refresh_student_achievements(db, user_id, attempt_id)
    return get_student_view(db, get_attempt_or_404(db, db.get(User, user_id), attempt_id))


def get_attempt_for_grading_or_404(db: Session, actor: User, attempt_id: int) -> TestAttempt:
    from app.services import grading_service

    attempt = _attempt_query(db).filter(TestAttempt.id == attempt_id).first()
    if attempt is None or not grading_service.can_grade_attempt(db, actor, attempt):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    return attempt


def list_grading_queue(db: Session, actor: User, status_filter: Optional[str] = None) -> list[dict]:
    from app.services import grading_service

    return grading_service.list_queue(db, actor, status_filter)


def get_grading_detail(db: Session, actor: User, attempt_id: int) -> dict:
    from app.services import ai_evaluation_service, grading_service

    attempt = get_attempt_for_grading_or_404(db, actor, attempt_id)
    view = get_student_view(db, attempt)
    view["student_name"] = f"{attempt.user.first_name} {attempt.user.last_name}"
    view["student_email"] = attempt.user.email
    view["flags"] = [
        {
            "flag_type": flag.flag_type,
            "severity": flag.severity,
            "occurred_at": flag.occurred_at,
            "client_occurred_at": flag.client_occurred_at,
            "meta": flag.meta,
        }
        for flag in sorted(attempt.flags, key=lambda f: f.occurred_at)
    ]
    view["queue"] = grading_service.queue_metadata(db, attempt)
    view["reevaluation"] = grading_service.reevaluation_for_student(db, attempt)
    view["ai_assistance"] = ai_evaluation_service.config_status(db)
    return view


def _recompute_score(attempt: TestAttempt) -> None:
    auto_points = sum(
        (Decimal(a.points_awarded) for a in attempt.answers if a.points_awarded is not None), Decimal("0")
    )
    auto_max = sum(
        (Decimal(p.max_marks) for p in attempt.module.parts if p.auto_marked and p.max_marks is not None),
        Decimal("0"),
    )
    graded_points = sum(
        (Decimal(g.total_marks) for g in attempt.part_grades if g.total_marks is not None), Decimal("0")
    )
    graded_max = sum(
        (Decimal(str(c["max_marks"])) for g in attempt.part_grades for c in (g.criteria or [])), Decimal("0")
    )
    attempt.raw_score = auto_points + graded_points
    total_max = auto_max + graded_max
    attempt.max_score = total_max if total_max > 0 else None


def grade_part(
    db: Session,
    actor: User,
    attempt_id: int,
    part_id: int,
    criteria: list[dict],
    comment: Optional[str],
) -> dict:
    from app.services import grading_service

    attempt = get_attempt_for_grading_or_404(db, actor, attempt_id)
    if attempt.status not in (ATTEMPT_GRADING, ATTEMPT_GRADED):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This attempt has not been submitted yet")
    part = next((p for p in attempt.module.parts if p.id == part_id), None)
    if part is None or part.auto_marked:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This part is not human-graded")
    grading_service.require_or_claim(db, actor, attempt)

    rubric_by_criterion = {item["criterion"]: Decimal(str(item["max_marks"])) for item in (part.rubric or [])}
    if not rubric_by_criterion:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This part has no scoring rubric")

    normalized: list[dict] = []
    seen = set()
    for entry in criteria:
        name = entry.get("criterion")
        if name not in rubric_by_criterion or name in seen:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unexpected or duplicate criterion: {name}")
        seen.add(name)
        max_marks = rubric_by_criterion[name]
        try:
            awarded = Decimal(str(entry.get("marks_awarded")))
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid marks for {name}")
        if awarded < 0 or awarded > max_marks:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=f"{name} must be between 0 and {max_marks}"
            )
        normalized.append(
            {
                "criterion": name,
                "max_marks": str(max_marks),
                "marks_awarded": str(awarded),
                "cefr_level": cefr_service.criterion_level(awarded, max_marks),
            }
        )
    if seen != set(rubric_by_criterion):
        missing = set(rubric_by_criterion) - seen
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Missing scores for: {', '.join(missing)}")

    grade = next((g for g in attempt.part_grades if g.part_id == part_id), None)
    if grade is None:
        grade = AttemptPartGrade(attempt_id=attempt.id, part_id=part_id)
        db.add(grade)
        attempt.part_grades.append(grade)
    grade.criteria = normalized
    grade.total_marks = sum((Decimal(item["marks_awarded"]) for item in normalized), Decimal("0"))
    grade.comment = comment
    grade.grader_id = actor.id
    grade.status = "graded"
    grade.graded_at = _now()
    db.add(grade)

    just_completed = False
    if all(g.status == "graded" for g in attempt.part_grades):
        _recompute_score(attempt)
        if attempt.status != ATTEMPT_GRADED:
            just_completed = True
        attempt.status = ATTEMPT_GRADED
        attempt.graded_at = _now()
        grading_service.complete_if_ready(db, attempt)
    cefr_service.apply_evaluation(attempt)
    db.add(attempt)

    db.commit()
    attempt = get_attempt_for_grading_or_404(db, actor, attempt_id)
    if just_completed:
        from app.services import achievement_service, notification_service

        achievement_service.refresh_student_achievements(db, attempt.user_id, attempt.id)
        notification_service.send_grade_released_email(db, attempt)
    return get_grading_detail(db, actor, attempt_id)


def list_my_attempts(db: Session, user: User) -> list[dict]:
    attempts = (
        _attempt_query(db)
        .filter(TestAttempt.user_id == user.id)
        .order_by(TestAttempt.started_at.desc())
        .all()
    )
    return [
        {
            "id": attempt.id,
            "module_id": attempt.module_id,
            "module_type": attempt.module.module_type,
            "module_title": attempt.module.title,
            "status": attempt.status,
            "security_required": attempt.security_required,
            "security_risk_score": attempt.security_risk_score,
            "started_at": _utc_out(attempt.started_at),
            "submitted_at": _utc_out(attempt.submitted_at),
            "raw_score": str(attempt.raw_score) if attempt.raw_score is not None else None,
            "max_score": str(attempt.max_score) if attempt.max_score is not None else None,
            "band_label": attempt.band_label,
            "cefr_level": attempt.cefr_level,
            "cefr_profile": attempt.cefr_profile,
        }
        for attempt in attempts
    ]
