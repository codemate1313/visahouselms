import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from random import SystemRandom
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.config import settings
from app.core.media_signing import sign_path
from app.core.uploads import MIN_SPEAKING_AUDIO_BYTES
from app.models.attempt import (
    ATTEMPT_GRADED,
    ATTEMPT_GRADING,
    ATTEMPT_IN_PROGRESS,
    ATTEMPT_READY,
    ATTEMPT_SUBMITTED,
    ATTEMPT_FLAG_TYPES,
    PART_GRADE_AI_GRADED,
    PART_GRADE_DRAFT,
    PART_GRADE_GRADED,
    PART_GRADE_PENDING,
    QUEUE_COMPLETED,
    REEVALUATION_IN_REVIEW,
    REEVALUATION_PENDING,
    REEVALUATION_RESOLVED,
    AttemptAnswer,
    AttemptFlag,
    AttemptPartGrade,
    ReevaluationRequest,
    TestAttempt,
)
from app.models.exam_module import ExamModule, ExamModuleAsset, ExamModulePart, ExamModuleQuestion
from app.models.user import User
from app.models.user_session import UserSession
from app.services import cefr_service

# Exact expiration matching the module's configured duration.
EXPIRY_BUFFER_MINUTES = 0
# The countdown is the candidate's answering time. Anything the system spends on
# their behalf - the examiner avatar speaking a prompt, a recording uploading -
# is credited back so it does not eat that time. Credits are keyed per event and
# granted once, and the total is capped so a replayed request cannot buy time.
MAX_CLOCK_CREDIT_SECONDS = 600
CLOCK_TRANSITION_ALLOWANCE_SECONDS = 3
FINAL_TEST_HEARTBEAT_GRACE_SECONDS = 30
FINAL_TEST_AUTO_SUBMIT_VIOLATION_LIMIT = 3

logger = logging.getLogger(__name__)
_randomizer = SystemRandom()
MAIN_PAPER_SECTION_TYPES = {"listening", "reading", "writing"}
SPEAKING_PHASE_MAIN = "main"
SPEAKING_PHASE_PENDING = "speaking_pending"
SPEAKING_PHASE_ACTIVE = "speaking"
SPEAKING_LOCKED_PHASES = {SPEAKING_PHASE_PENDING, SPEAKING_PHASE_ACTIVE}

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
AUTO_SUBMIT_FLAG_TYPES = {
    "blur",
    "visibility_change",
    "fullscreen_exit",
    "camera_stopped",
    "microphone_stopped",
    "screen_share_stopped",
    "screen_surface_invalid",
    "concurrent_tab",
    "ip_change",
}


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
    if _restore_deferred_speaking_attempt(db, attempt):
        attempt = _attempt_query(db).filter(TestAttempt.id == attempt_id).first()
    return attempt


def _build_content_snapshot(module: ExamModule, *, randomize: bool) -> dict:
    """Freeze student-visible content and marking keys for this sitting."""
    parts: dict[str, dict] = {}
    part_ids = [part.id for part in sorted(module.parts, key=lambda item: item.sort_order)]
    for part in module.parts:
        questions = sorted(part.questions, key=lambda item: item.sort_order)
        constraints = dict(part.answer_constraints or {})
        if randomize and not constraints.get("preserve_question_order"):
            questions = questions[:]
            _randomizer.shuffle(questions)
        # Authoring caps a part at question_limit, so this only ever trims
        # modules created before that cap existed - it keeps their marks adding
        # up to max_marks instead of overshooting it.
        if part.question_limit is not None and part.question_limit > 0:
            questions = questions[:part.question_limit]
        question_ids: list[int] = []
        question_data: dict[str, dict] = {}
        for question in questions:
            options = [dict(item) for item in (question.options or [])]
            if randomize and len(options) > 1 and not constraints.get("preserve_option_order"):
                _randomizer.shuffle(options)
            question_ids.append(question.id)
            question_data[str(question.id)] = {
                "question_type": question.question_type,
                "prompt": question.prompt,
                "instructions": question.instructions,
                "passage": question.passage,
                "image_path": question.image_path,
                "options": options,
                "correct_answers": list(question.correct_answers or []),
                "interaction": dict(question.interaction or {}),
                "explanation": question.explanation,
                "points": str(question.points),
                "sort_order": question.sort_order,
            }
        parts[str(part.id)] = {"question_ids": question_ids, "questions": question_data}
    return {"version": 1, "part_ids": part_ids, "parts": parts, "phase": SPEAKING_PHASE_MAIN}


def _attempt_phase(attempt: TestAttempt) -> str:
    phase = (attempt.content_snapshot or {}).get("phase")
    if phase in {SPEAKING_PHASE_MAIN, SPEAKING_PHASE_PENDING, SPEAKING_PHASE_ACTIVE}:
        return phase
    return SPEAKING_PHASE_MAIN


def _set_attempt_phase(attempt: TestAttempt, phase: str) -> None:
    snapshot = dict(attempt.content_snapshot or {})
    snapshot["phase"] = phase
    attempt.content_snapshot = snapshot


def _restore_deferred_speaking_attempt(db: Session, attempt: TestAttempt) -> bool:
    if not attempt.module:
        return False
    if _attempt_phase(attempt) != SPEAKING_PHASE_PENDING:
        return False
    if attempt.status == ATTEMPT_IN_PROGRESS:
        return False

    # Prevent unique constraint violation if another attempt of the same module is already in_progress
    active_exists = db.query(TestAttempt).filter(
        TestAttempt.user_id == attempt.user_id,
        TestAttempt.module_id == attempt.module_id,
        TestAttempt.status == ATTEMPT_IN_PROGRESS,
        TestAttempt.id != attempt.id,
    ).first() is not None
    if active_exists:
        return False

    speaking_part_ids = {part.id for part in attempt.module.parts if part.section_type == "speaking"}
    if speaking_part_ids:
        db.query(AttemptPartGrade).filter(
            AttemptPartGrade.attempt_id == attempt.id,
            AttemptPartGrade.part_id.in_(speaking_part_ids),
        ).delete(synchronize_session=False)

    attempt.status = ATTEMPT_IN_PROGRESS
    attempt.submitted_at = None
    attempt.graded_at = None
    attempt.raw_score = None
    attempt.max_score = None
    attempt.band_label = None
    attempt.cefr_level = None
    attempt.cefr_profile = None
    attempt.cefr_policy_version = None
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return True


def _set_resume_part(attempt: TestAttempt, part_id: int) -> None:
    snapshot = dict(attempt.content_snapshot or {})
    snapshot["resume_part_id"] = part_id
    attempt.content_snapshot = snapshot


def _resume_part_id(attempt: TestAttempt) -> Optional[int]:
    value = (attempt.content_snapshot or {}).get("resume_part_id")
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _main_paper_is_locked(attempt: TestAttempt) -> bool:
    return _attempt_phase(attempt) in SPEAKING_LOCKED_PHASES


def _split_composite_has_speaking(attempt: TestAttempt) -> bool:
    return (
        attempt.module.module_type in {"full_mock", "final_test"}
        and any(part.section_type == "speaking" for part in attempt.module.parts)
    )


def _speaking_duration_minutes(attempt: TestAttempt) -> int:
    total = sum(
        part.duration_minutes or 0
        for part in attempt.module.parts
        if part.section_type == "speaking"
    )
    return total or 15


def _snapshot_question(attempt: TestAttempt, part_id: int, question_id: int) -> Optional[dict]:
    snapshot = attempt.content_snapshot or {}
    return snapshot.get("parts", {}).get(str(part_id), {}).get("questions", {}).get(str(question_id))


def _ordered_questions(attempt: TestAttempt, part: ExamModulePart) -> list[ExamModuleQuestion]:
    by_id = {question.id: question for question in part.questions}
    ids = (attempt.content_snapshot or {}).get("parts", {}).get(str(part.id), {}).get("question_ids")
    if ids:
        return [by_id[question_id] for question_id in ids if question_id in by_id]
    return sorted(part.questions, key=lambda item: item.sort_order)


ALREADY_ATTEMPTED_DETAIL = (
    "You have already attempted this test. If something went wrong, you can "
    "raise a Retake Request from your results page."
)


def _dev_unlimited_speaking_attempts(db: Session, module: ExamModule) -> bool:
    """Local QA escape hatch for repeatedly exercising the Speaking runner.

    This is intentionally disabled outside development and scoped to Speaking
    modules. The flag lives in the local DB so production plans/subscriptions
    and retake policy stay unchanged.
    """
    if settings.app_environment != "development" or module.module_type != "speaking":
        return False
    try:
        from app.services import settings_service

        value = settings_service.get_setting(db, "dev.unlimited_speaking_attempts")
    except Exception:
        logger.exception("Failed to read dev.unlimited_speaking_attempts")
        return False
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def start_attempt(db: Session, user: User, module: ExamModule) -> dict:
    from app.services import retake_service

    is_final = module.module_type == "final_test"
    dev_unlimited_speaking = _dev_unlimited_speaking_attempts(db, module)

    existing_in_progress = (
        db.query(TestAttempt)
        .filter(
            TestAttempt.user_id == user.id,
            TestAttempt.module_id == module.id,
            TestAttempt.status == ATTEMPT_IN_PROGRESS,
        )
        .first()
    )
    if existing_in_progress is not None:
        if dev_unlimited_speaking:
            _auto_expire(db, existing_in_progress)
        elif existing_in_progress.expires_at > _now():
            return get_student_view(db, get_attempt_or_404(db, user, existing_in_progress.id))
        else:
            _auto_expire(db, existing_in_progress)

    # An attempt already waiting at onboarding is that same start, pressed
    # again: a second Start click, a reopened tab, a candidate who backed out
    # and came straight back. Handing it back rather than opening another keeps
    # one onboarding per sitting - and a second row would take the sitting
    # number this one already holds and be refused by the unique index.
    waiting_at_onboarding = (
        db.query(TestAttempt)
        .filter(
            TestAttempt.user_id == user.id,
            TestAttempt.module_id == module.id,
            TestAttempt.status == ATTEMPT_READY,
        )
        .order_by(TestAttempt.id.desc())
        .first()
    )
    if waiting_at_onboarding is not None and not waiting_at_onboarding.answers:
        return get_student_view(db, get_attempt_or_404(db, user, waiting_at_onboarding.id))

    # Every module type allows exactly one original sitting; an approved,
    # unconsumed RetakeRequest is the only way to earn another (except final tests).
    prior_sittings = (
        db.query(TestAttempt)
        .filter(
            TestAttempt.user_id == user.id,
            TestAttempt.module_id == module.id,
            TestAttempt.is_retake.is_(False),
            TestAttempt.status.notin_(["cancelled", "ready"]),
        )
        .count()
    )
    original_attempt = prior_sittings > 0
    retake_request = None

    if original_attempt:
        # A direct student who bought the plan again bought another go at it.
        # Before this, a repeat purchase bought only more days to look at a
        # paper they had already sat - full price for no further sitting - and
        # the only way back in was a Retake Request, which is a goodwill
        # workflow for when something went wrong, not something money buys.
        #
        # Institute students are unaffected: they do not buy their own plans,
        # so a second institute plan must not silently reset every student's
        # sittings. Their route to another go remains the Retake Request.
        has_paid_sitting = False
        if user.institute_id is None:
            from app.services import entitlement_service

            has_paid_sitting = entitlement_service.sittings_remaining(db, user.id, module.id) > 0

        if is_final and not has_paid_sitting:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You have already attempted the final test. Final tests cannot be retaken.",
            )

        if not has_paid_sitting and not dev_unlimited_speaking:
            retake_request = retake_service.get_available_retake(db, user.id, module.id)
        if retake_request is None and not has_paid_sitting and not dev_unlimited_speaking:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=ALREADY_ATTEMPTED_DETAIL)

    now = _now()
    # Provisional only. The attempt is created READY - the candidate is at the
    # pre-exam onboarding, not in the paper - and `commence_attempt` sets both
    # of these again from the moment they actually enter it. Until then nothing
    # is counting down and no sitting has been spent.
    expires_at = now + timedelta(minutes=module.duration_minutes + EXPIRY_BUFFER_MINUTES)
    attempt = TestAttempt(
        user_id=user.id,
        module_id=module.id,
        status=ATTEMPT_READY,
        is_final=is_final,
        is_retake=retake_request is not None or (dev_unlimited_speaking and original_attempt is not None),
        retake_request_id=retake_request.id if retake_request is not None else None,
        security_required=is_final,
        started_at=now,
        expires_at=expires_at,
        content_snapshot=_build_content_snapshot(module, randomize=True),
        # A retake re-sits the sitting it was granted against; a purchased
        # sitting is a new one. Numbering them is what lets the unique index
        # keep guarding against double-clicks without capping the total.
        sitting_number=prior_sittings if retake_request is not None else prior_sittings + 1,
    )
    db.add(attempt)
    if retake_request is not None:
        retake_request.consumed_at = now
        db.add(retake_request)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing_in_progress = (
            db.query(TestAttempt)
            .filter(
                TestAttempt.user_id == user.id,
                TestAttempt.module_id == module.id,
                TestAttempt.status == ATTEMPT_IN_PROGRESS,
            )
            .first()
        )
        if existing_in_progress is not None:
            return get_student_view(db, get_attempt_or_404(db, user, existing_in_progress.id))
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=ALREADY_ATTEMPTED_DETAIL) from None
    return get_student_view(db, get_attempt_or_404(db, user, attempt.id))


def commence_attempt(db: Session, user: User, attempt: TestAttempt) -> dict:
    """Commence the attempt: starts the timer fresh and transitions from READY to IN_PROGRESS."""
    if attempt.status == ATTEMPT_READY:
        now = _now()
        attempt.status = ATTEMPT_IN_PROGRESS
        attempt.started_at = now
        attempt.expires_at = now + timedelta(
            minutes=attempt.module.duration_minutes + EXPIRY_BUFFER_MINUTES
        )
        if attempt.is_final and attempt.security_required:
            attempt.security_started_at = now
            attempt.security_last_heartbeat_at = now
        db.add(attempt)
        db.commit()
        attempt = get_attempt_or_404(db, user, attempt.id)
    elif attempt.status != ATTEMPT_IN_PROGRESS:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This test cannot be commenced")
    return get_student_view(db, attempt, security_authorized=True)


def cancel_onboarding_attempt(db: Session, user: User, attempt_id: int) -> dict:
    """If a candidate exits during pre-onboarding without commencing, discard the READY attempt so limits are not consumed."""
    attempt = db.query(TestAttempt).filter(TestAttempt.id == attempt_id, TestAttempt.user_id == user.id).first()
    if attempt is None:
        return {"cancelled": False, "message": "Attempt not found"}
    if attempt.status == ATTEMPT_READY and not attempt.answers:
        if attempt.retake_request_id:
            from app.models.retake_request import RetakeRequest

            retake = db.get(RetakeRequest, attempt.retake_request_id)
            if retake is not None:
                retake.consumed_at = None
                db.add(retake)
        db.delete(attempt)
        db.commit()
        return {"cancelled": True, "message": "Onboarding cancelled. Attempt quota preserved."}
    return {"cancelled": False, "message": "Attempt is already commenced or completed."}


def credit_clock(db: Session, attempt: TestAttempt, key: str, seconds: float) -> bool:
    """Give the candidate back time that was never theirs to spend.

    `key` identifies the event (for example `prompt:41` or `upload:41`) so the
    same examiner prompt or the same upload can never be credited twice, however
    many times the client asks for it. Returns True when the clock moved.
    """
    if attempt.status != ATTEMPT_IN_PROGRESS:
        return False
    seconds = int(max(0, min(seconds, MAX_CLOCK_CREDIT_SECONDS)))
    if seconds <= 0:
        return False

    credits = dict(attempt.clock_credits or {})
    if key in credits:
        return False
    already = sum(int(value or 0) for value in credits.values())
    remaining = MAX_CLOCK_CREDIT_SECONDS - already
    if remaining <= 0:
        return False
    seconds = min(seconds, remaining)

    credits[key] = seconds
    attempt.clock_credits = credits
    attempt.expires_at = attempt.expires_at + timedelta(seconds=seconds)
    db.add(attempt)
    db.commit()
    return True


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
        "url": None if asset.asset_type == "tts_text" else f"/storage/{asset.file_path}",
        "mime_type": asset.mime_type,
        "transcript": asset.transcript if reveal_transcript or asset.asset_type == "tts_text" else None,
        "tts_voice": asset.tts_voice,
        "tts_rate": asset.tts_rate,
    }


def _redacted_question(
    question: ExamModuleQuestion,
    answer: Optional[AttemptAnswer],
    frozen: Optional[dict] = None,
) -> dict:
    source = frozen or {}
    image_path = source.get("image_path", question.image_path)
    interaction = dict(source.get("interaction", question.interaction or {}))
    material_path = interaction.get("candidate_material_path")
    if material_path:
        # Exam content, not a public asset: hand back a short-lived signed URL
        # the same way the candidate's own recording is handled below, so the
        # material cannot be copied out and passed to the next candidate.
        interaction["candidate_material_url"] = sign_path(material_path)
    return {
        "id": question.id,
        "question_type": source.get("question_type", question.question_type),
        "prompt": source.get("runtime_prompt", source.get("prompt", question.prompt)),
        "instructions": source.get("instructions", question.instructions),
        "passage": source.get("passage", question.passage),
        "image_url": f"/storage/{image_path}" if image_path else None,
        "options": source.get("options", question.options),
        "interaction": interaction,
        "points": source.get("points", str(question.points)),
        "sort_order": source.get("sort_order", question.sort_order),
        "response": answer.response if answer else None,
        # Recordings are private: hand back a short-lived signed URL rather than
        # a permanently-public /storage path.
        "audio_path": sign_path(answer.audio_path) if answer and answer.audio_path else None,
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
    include_draft_grades: bool = False,
) -> dict:
    answers_by_question = {answer.question_id: answer for answer in attempt.answers}
    grades_by_part = {grade.part_id: grade for grade in attempt.part_grades}
    ordered_questions = _ordered_questions(attempt, part)
    question_fn = _revealed_question if reveal else _redacted_question
    grade = grades_by_part.get(part.id)
    # A "draft" is an instructor's in-progress scoring - never publish it to
    # the student, who should see either a real published grade or nothing,
    # never a partial/mid-edit one. The instructor's own grading view opts
    # in via include_draft_grades so it can resume an in-progress draft.
    if grade is not None and grade.status == PART_GRADE_DRAFT and not include_draft_grades:
        grade = None
    return {
        "id": part.id,
        "section_type": part.section_type,
        "part_code": part.part_code,
        "title": part.title,
        "skill_focus": part.skill_focus,
        "instructions": part.instructions,
        "duration_minutes": part.duration_minutes,
        "auto_marked": part.auto_marked,
        "ai_evaluation_enabled": part.ai_evaluation_enabled,
        "max_marks": str(part.max_marks) if part.max_marks is not None else None,
        "rubric": part.rubric,
        "answer_constraints": dict(part.answer_constraints or {}),
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
    include_draft_grades: bool = False,
) -> list[dict]:
    parts = sorted(attempt.module.parts, key=lambda item: item.sort_order)
    first_speaking_part_id = next((part.id for part in parts if part.section_type == "speaking"), None)
    default_part_id = (
        first_speaking_part_id
        if _main_paper_is_locked(attempt) and first_speaking_part_id
        else (parts[0].id if parts else None)
    )
    return [
        _serialize_part(
            attempt,
            part,
            reveal=reveal,
            include_questions=(
                not hide_content
                and (reveal or not _main_paper_is_locked(attempt) or part.section_type == "speaking")
                and (
                    not attempt.security_required
                    or reveal
                    or part.id == (question_part_id or default_part_id)
                )
            ),
            include_draft_grades=include_draft_grades,
        )
        for part in parts
    ]


def _ai_eligible_part_ids(attempt: TestAttempt) -> set[int]:
    """Parts of this module the AI is allowed to mark."""
    return {
        part.id
        for part in attempt.module.parts
        if not part.auto_marked and part.ai_evaluation_enabled
    }


def _ai_pending_part_ids(attempt: TestAttempt) -> set[int]:
    """Of those, the ones still without a published grade."""
    grades_by_part = {grade.part_id: grade for grade in attempt.part_grades}
    return {
        part_id
        for part_id in _ai_eligible_part_ids(attempt)
        if grades_by_part.get(part_id) is None or grades_by_part[part_id].status == PART_GRADE_PENDING
    }


def _ai_active_job(db: Session, attempt: TestAttempt):
    """The queued or running AI job for this attempt, if there is one. The
    attempt id lives inside a JSON payload, so the filter happens in Python
    over the (short) list of jobs that are actually active."""
    from app.models.job import JOB_PENDING, JOB_RUNNING, Job

    active_jobs = (
        db.query(Job)
        .filter(Job.type == "ai_auto_grade", Job.status.in_([JOB_PENDING, JOB_RUNNING]))
        .order_by(Job.id.asc())
        .all()
    )
    for job in active_jobs:
        if (job.payload or {}).get("attempt_id") == attempt.id:
            return job
    return None


def _ai_evaluation_status(db: Session, attempt: TestAttempt) -> str:
    if attempt.status == ATTEMPT_GRADED:
        return "completed"

    eligible_part_ids = _ai_eligible_part_ids(attempt)
    if not eligible_part_ids:
        return "disabled"
    if attempt.status != ATTEMPT_GRADING:
        return "not_started"

    pending_part_ids = _ai_pending_part_ids(attempt)
    if not pending_part_ids:
        return "completed"

    from app.models.attempt import AiEvaluation

    if _ai_active_job(db, attempt) is not None:
        return "pending"

    failed_ai_rows = (
        db.query(AiEvaluation.id)
        .filter(
            AiEvaluation.attempt_id == attempt.id,
            AiEvaluation.part_id.in_(pending_part_ids),
            AiEvaluation.status == "failed",
        )
        .first()
    )
    if failed_ai_rows is not None:
        return "manual_required"

    return "manual_required"


def _ai_evaluation_progress(db: Session, attempt: TestAttempt) -> Optional[dict]:
    """What the student's spinner needs: when the AI started on this attempt,
    how long their submission should take, and how much of it is already done.

    Only built while an evaluation is actually in flight - every other state
    has a result to show instead of a wait to describe.
    """
    from app.models.attempt import AiEvaluation
    from app.services import ai_evaluation_service

    pending_part_ids = _ai_pending_part_ids(attempt)
    if not pending_part_ids:
        return None
    eligible_part_ids = _ai_eligible_part_ids(attempt)

    # The clock starts when the work was queued, not when the student opened
    # this page - they may have arrived a minute late, or reloaded.
    job = _ai_active_job(db, attempt)
    started_at = (job.started_at or job.created_at) if job else None
    if started_at is None:
        started_at = (
            db.query(func.min(AiEvaluation.created_at))
            .filter(
                AiEvaluation.attempt_id == attempt.id,
                AiEvaluation.part_id.in_(pending_part_ids),
                AiEvaluation.status == "pending",
            )
            .scalar()
        )
    if started_at is None:
        started_at = attempt.submitted_at

    estimate = ai_evaluation_service.estimate_evaluation(db, attempt, pending_part_ids)
    return {
        **estimate,
        "started_at": _utc_out(started_at),
        "parts_total": len(eligible_part_ids),
        "parts_done": len(eligible_part_ids - pending_part_ids),
    }


def get_student_view(
    db: Session,
    attempt: TestAttempt,
    *,
    security_authorized: bool = False,
    question_part_id: Optional[int] = None,
    include_draft_grades: bool = False,
) -> dict:
    from app.services import grading_service, retake_service

    if (
        attempt.status == ATTEMPT_IN_PROGRESS
        and attempt.expires_at <= _now()
        and _attempt_phase(attempt) != SPEAKING_PHASE_PENDING
    ):
        _auto_expire(db, attempt)
        attempt = get_attempt_or_404(db, db.get(User, attempt.user_id), attempt.id)
    if attempt.status in (ATTEMPT_GRADING, ATTEMPT_GRADED) and (
        attempt.cefr_profile is None or attempt.cefr_policy_version != cefr_service.POLICY_VERSION
    ):
        cefr_service.apply_evaluation(attempt)
        db.add(attempt)
        db.commit()
    reveal = attempt.status in (ATTEMPT_GRADING, ATTEMPT_GRADED)
    ai_status = _ai_evaluation_status(db, attempt)
    effective_expires_at = attempt.expires_at
    if attempt.started_at and attempt.module and attempt.module.duration_minutes:
        max_expiry = attempt.started_at + timedelta(minutes=attempt.module.duration_minutes)
        if attempt.expires_at > max_expiry:
            effective_expires_at = max_expiry

    return {
        "id": attempt.id,
        "module_id": attempt.module_id,
        "module_type": attempt.module.module_type,
        "module_title": attempt.module.title,
        "duration_minutes": attempt.module.duration_minutes,
        "show_onboarding_instructions": attempt.module.show_onboarding_instructions if attempt.module.show_onboarding_instructions is not None else True,
        "onboarding_instructions": attempt.module.onboarding_instructions,
        "course_id": attempt.course_id,
        "status": attempt.status,
        "is_final": attempt.is_final,
        "security_required": attempt.security_required,
        "security_authorized": security_authorized or not attempt.security_required or reveal,
        "security_started_at": _utc_out(attempt.security_started_at),
        "security_last_heartbeat_at": _utc_out(attempt.security_last_heartbeat_at),
        "security_heartbeat_sequence": attempt.security_heartbeat_sequence,
        "security_risk_score": attempt.security_risk_score,
        "started_at": _utc_out(attempt.started_at),
        "expires_at": _utc_out(effective_expires_at),
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
        "retake_request": retake_service.get_retake_for_student(db, attempt),
        "ai_evaluation_status": ai_status,
        # Present only while the AI is working, so the student's wait can be a
        # timer sized to what they wrote rather than an open-ended spinner.
        "ai_evaluation_progress": _ai_evaluation_progress(db, attempt) if ai_status == "pending" else None,
        "phase": _attempt_phase(attempt),
        "resume_part_id": _resume_part_id(attempt),
        "parts": _serialize_parts(
            attempt,
            reveal=reveal,
            hide_content=(attempt.security_required and not security_authorized and not reveal),
            question_part_id=question_part_id,
            include_draft_grades=include_draft_grades,
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
    """Kept, but nothing calls it any more - see `note_security_lapse`. Restore
    a call here to make a lapse block a request again."""
    if not attempt.security_required:
        return
    state = attempt.security_media_state or {}
    required_active = all(
        state.get(key)
        for key in ("camera_active", "microphone_active", "fullscreen_active", "screen_share_active")
    )
    heartbeat_fresh = (
        attempt.security_last_heartbeat_at is not None
        and (_now() - attempt.security_last_heartbeat_at).total_seconds() <= FINAL_TEST_HEARTBEAT_GRACE_SECONDS
    )
    if not required_active or not heartbeat_fresh:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Restore camera, microphone, and full screen before continuing",
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
        attempt=attempt,
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


def _final_test_violation_count(attempt: TestAttempt) -> int:
    if not attempt.is_final:
        return 0
    return sum(1 for flag in attempt.flags if flag.flag_type in AUTO_SUBMIT_FLAG_TYPES)


def _violation_policy_payload(attempt: TestAttempt) -> dict:
    count = _final_test_violation_count(attempt)
    return {
        "violation_count": count,
        "violation_limit": FINAL_TEST_AUTO_SUBMIT_VIOLATION_LIMIT,
        "auto_submitted": bool(
            attempt.security_media_state
            and attempt.security_media_state.get("auto_submitted_for_violations")
        ),
    }


def _maybe_auto_submit_for_violations(db: Session, attempt: TestAttempt) -> None:
    if not attempt.is_final or attempt.status != ATTEMPT_IN_PROGRESS:
        return
    count = _final_test_violation_count(attempt)
    if count < FINAL_TEST_AUTO_SUBMIT_VIOLATION_LIMIT:
        return
    attempt.security_media_state = {
        **(attempt.security_media_state or {}),
        "auto_submitted_for_violations": True,
        "auto_submit_reason": "final_test_rule_violations",
        "auto_submit_violation_count": count,
        "auto_submitted_at": _now().isoformat(),
    }
    submit_attempt(db, attempt, require_complete_speaking=False)


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
    if payload.get("rules_consent") is not True:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must accept the Final Test security rules before starting",
        )
    if not all(
        payload.get(key)
        for key in ("camera_active", "microphone_active", "fullscreen_active", "screen_share_active")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Camera, microphone, screen share, and full screen must all be active",
        )
    if payload.get("display_surface") and payload.get("display_surface") != "monitor":
        _add_security_flag(
            db,
            attempt,
            "screen_surface_invalid",
            {"display_surface": payload.get("display_surface")},
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Share your entire screen, not a browser tab or single window",
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

    # An address that differs from the last sitting is a candidate on a
    # different network - home instead of the centre, or a phone that changed
    # cell. Flagging it here greeted everyone who came back for their Speaking
    # section with "1 of 3 violations" before they had done anything. A change
    # *during* a live session is still flagged, by the heartbeat.
    if attempt.security_ip_address and ip_address and attempt.security_ip_address != ip_address:
        logger.info(
            "Final Test %s resumed from a new address; recording it without a violation", attempt.id
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
        "fullscreen_active": True,
        "screen_share_active": True,
        "visible": True,
        "focused": True,
        "rules_consent": True,
        "rules_consented_at": _now().isoformat(),
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
        for key in ("camera_active", "microphone_active", "fullscreen_active", "screen_share_active")
    ):
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
    elif _attempt_phase(attempt) == SPEAKING_PHASE_PENDING:
        now = _now()
        _set_attempt_phase(attempt, SPEAKING_PHASE_ACTIVE)
        attempt.security_started_at = now
        attempt.security_last_heartbeat_at = now
        attempt.expires_at = now + timedelta(
            minutes=_speaking_duration_minutes(attempt) + EXPIRY_BUFFER_MINUTES
        )
        db.add(attempt)
        db.commit()
        attempt = get_attempt_or_404(db, db.get(User, attempt.user_id), attempt.id)
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
        ("fullscreen_active", "fullscreen_exit"),
        ("screen_share_active", "screen_share_stopped"),
    )
    for key, flag_type in transitions:
        if previous.get(key, True) and not payload.get(key):
            _add_security_flag(db, attempt, flag_type, {"source": "heartbeat"})
    if payload.get("screen_share_active") and payload.get("display_surface") and payload.get("display_surface") != "monitor":
        _add_security_flag(
            db,
            attempt,
            "screen_surface_invalid",
            {"source": "heartbeat", "display_surface": payload.get("display_surface")},
        )
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
            "fullscreen_active",
            "screen_share_active",
            "visible",
            "focused",
            "current_part_id",
        )
    }
    db.add(attempt)
    _maybe_auto_submit_for_violations(db, attempt)
    db.commit()
    return {
        "received": True,
        "server_at": _utc_out(attempt.security_last_heartbeat_at),
        "risk_score": attempt.security_risk_score,
        **_violation_policy_payload(attempt),
    }


def get_attempt_part_view(attempt: TestAttempt, part_id: int) -> dict:
    _require_in_progress(attempt)
    part = next((item for item in attempt.module.parts if item.id == part_id), None)
    if part is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test part not found")
    if _main_paper_is_locked(attempt) and part.section_type != "speaking":
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="The Listening, Reading and Writing paper is closed. Resume from Speaking.",
        )
    return _serialize_part(attempt, part, reveal=False, include_questions=True)


def save_resume_progress(db: Session, attempt: TestAttempt, part_id: int) -> dict:
    if attempt.status != ATTEMPT_IN_PROGRESS:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This attempt is not in progress")
    part = next((item for item in attempt.module.parts if item.id == part_id), None)
    if part is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test part not found")
    if _main_paper_is_locked(attempt) and part.section_type != "speaking":
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="The Listening, Reading and Writing paper is closed. Resume from Speaking.",
        )
    _set_resume_part(attempt, part.id)
    db.add(attempt)
    db.commit()
    return {"resume_part_id": part.id}


def _require_in_progress(attempt: TestAttempt) -> None:
    if attempt.status == ATTEMPT_READY:
        now = _now()
        attempt.status = ATTEMPT_IN_PROGRESS
        attempt.started_at = now
        duration = attempt.module.duration_minutes if attempt.module and attempt.module.duration_minutes else 15
        attempt.expires_at = now + timedelta(minutes=duration + EXPIRY_BUFFER_MINUTES)
    if attempt.status != ATTEMPT_IN_PROGRESS:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This attempt is no longer in progress")
    if attempt.expires_at <= _now() and _attempt_phase(attempt) != SPEAKING_PHASE_PENDING:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Time is up for this attempt")


def note_security_lapse(db: Session, attempt: TestAttempt, where: str) -> None:
    """Note a proctoring lapse instead of refusing the request.

    This used to raise 423: every one of camera, microphone, full screen and
    screen share had to be flagged active and the heartbeat under thirty
    seconds old, or the request was refused. Heartbeats run every five seconds,
    so a few dropped ones - or a share flag that blinked - stopped a candidate
    entering their Speaking section, and, worse, stopped their answers saving
    while they carried on typing.

    Now that the candidate is no longer shown a screen explaining the block,
    blocking is the one thing that must not happen: it would lose their work
    silently. The lapse is still recorded, with the same severity it carries
    anywhere else in the exam, so the grader sees exactly what happened. The
    device and token binding checked by the callers still stands - this relaxes
    what the browser is doing, never who is doing it.
    """
    if not attempt.security_required:
        return
    state = attempt.security_media_state or {}
    lapses = {
        "camera_stopped": not state.get("camera_active"),
        "microphone_stopped": not state.get("microphone_active"),
        "screen_share_stopped": not state.get("screen_share_active"),
        "fullscreen_exit": not state.get("fullscreen_active"),
    }
    stale_heartbeat = (
        attempt.security_last_heartbeat_at is None
        or (_now() - attempt.security_last_heartbeat_at).total_seconds() > FINAL_TEST_HEARTBEAT_GRACE_SECONDS
    )
    for flag_type, missing in lapses.items():
        if missing:
            _add_security_flag(db, attempt, flag_type, {"at": where})
    if stale_heartbeat:
        _add_security_flag(db, attempt, "visibility_change", {"at": where, "reason": "stale_heartbeat"})


def seal_main_paper_for_speaking(db: Session, attempt: TestAttempt, *, start_now: bool) -> TestAttempt:
    _require_in_progress(attempt)
    note_security_lapse(db, attempt, "speaking_handover")
    if not _split_composite_has_speaking(attempt):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This attempt does not have a separate Speaking phase",
        )

    answers_by_question = {answer.question_id for answer in attempt.answers}
    incomplete_parts: list[str] = []
    for part in sorted(attempt.module.parts, key=lambda item: item.sort_order):
        if part.section_type not in MAIN_PAPER_SECTION_TYPES:
            continue
        question_ids = [question.id for question in _ordered_questions(attempt, part)]
        if question_ids and any(question_id not in answers_by_question for question_id in question_ids):
            incomplete_parts.append(part.title or part.part_code or part.section_type.title())

    if incomplete_parts:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Complete {', '.join(incomplete_parts)} before moving to Speaking",
        )

    # `start_now` was accepted and then ignored - every seal started the
    # interview immediately, so a candidate who wanted to come back to Speaking
    # later had no way to say so. Pending is the phase for that: the main paper
    # is closed either way, but the Speaking clock does not start, and
    # `get_student_view` deliberately skips auto-expiry while an attempt sits
    # in it, so the candidate can return in their own time.
    _set_attempt_phase(attempt, SPEAKING_PHASE_ACTIVE if start_now else SPEAKING_PHASE_PENDING)
    first_speaking_part = next(
        (part for part in sorted(attempt.module.parts, key=lambda item: item.sort_order) if part.section_type == "speaking"),
        None,
    )
    if first_speaking_part:
        _set_resume_part(attempt, first_speaking_part.id)
    if start_now:
        attempt.expires_at = _now() + timedelta(
            minutes=_speaking_duration_minutes(attempt) + EXPIRY_BUFFER_MINUTES
        )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


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
    part, question = _question_or_404(attempt, question_id)
    if _main_paper_is_locked(attempt) and part.section_type != "speaking":
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="The Listening, Reading and Writing paper is closed. Resume from Speaking.",
        )
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
    return {"question_id": question_id, "audio_url": sign_path(relative.as_posix())}


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
        "fullscreen_exit": "fullscreen_active",
        "screen_share_stopped": "screen_share_active",
        "screen_surface_invalid": "screen_share_active",
    }.get(flag_type)
    if state_key and attempt.security_media_state:
        attempt.security_media_state = {**attempt.security_media_state, state_key: False}
        db.add(attempt)
    _maybe_auto_submit_for_violations(db, attempt)
    db.commit()
    return {"recorded": True, "risk_score": attempt.security_risk_score, **_violation_policy_payload(attempt)}


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

    if qtype in (
        "mcq_single",
        "true_false_not_given",
        "yes_no_not_given",
        "matching_unique",
        "matching_reusable",
    ):
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


def _missing_speaking_recordings(attempt: TestAttempt) -> list[str]:
    answers_by_question = {answer.question_id: answer for answer in attempt.answers}
    missing: list[str] = []
    for part in attempt.module.parts:
        if part.section_type != "speaking":
            continue
        for question in _ordered_questions(attempt, part):
            answer = answers_by_question.get(question.id)
            audio_path = settings.storage_path / answer.audio_path if answer and answer.audio_path else None
            if (
                audio_path is None
                or not audio_path.is_file()
                or audio_path.stat().st_size < MIN_SPEAKING_AUDIO_BYTES
            ):
                missing.append(f"{part.title}: {question.prompt}")
    return missing


def submit_attempt(
    db: Session,
    attempt: TestAttempt,
    *,
    require_complete_speaking: bool = True,
) -> dict:
    if _restore_deferred_speaking_attempt(db, attempt):
        return get_student_view(db, attempt)
    if _attempt_phase(attempt) == SPEAKING_PHASE_PENDING:
        return get_student_view(db, attempt)
    if attempt.status == ATTEMPT_READY:
        attempt.status = ATTEMPT_IN_PROGRESS
        now = _now()
        attempt.started_at = now
        duration = attempt.module.duration_minutes if attempt.module and attempt.module.duration_minutes else 15
        attempt.expires_at = now + timedelta(minutes=duration + EXPIRY_BUFFER_MINUTES)
    if attempt.status != ATTEMPT_IN_PROGRESS:
        # idempotent: a retried submit just returns the current state
        return get_student_view(db, attempt)

    is_expired = attempt.expires_at is not None and attempt.expires_at - timedelta(seconds=15) <= _now()
    if require_complete_speaking and not is_expired:
        missing_recordings = _missing_speaking_recordings(attempt)
        if missing_recordings:
            count = len(missing_recordings)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"{count} Speaking recording{'s are' if count != 1 else ' is'} missing. "
                    "Complete every Speaking response before submitting the test."
                ),
            )

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
                try:
                    is_correct, points = _grade_answer(
                        question,
                        answer.response,
                        _snapshot_question(attempt, part.id, question.id),
                    )
                except (InvalidOperation, TypeError, ValueError):
                    logger.warning(
                        "Failed to grade question %s on attempt %s; scoring as unanswered",
                        question.id,
                        attempt.id,
                        exc_info=True,
                    )
                    is_correct, points = False, Decimal("0")
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
    ai_evaluation_pending = False
    grading_routing_reason = None
    ai_eligible_parts = [part for part in attempt.module.parts if not part.auto_marked and part.ai_evaluation_enabled]
    if needs_grading:
        from app.services import ai_evaluation_service, grading_service

        queue_entry = grading_service.ensure_queue_entry(db, attempt)
        grading_routing_reason = queue_entry.routing_reason
        # Writing/Speaking parts are auto-evaluated by AI (quota permitting)
        # right after submission so the student gets a real result without
        # waiting on an instructor - see job_service's "ai_auto_grade" handler.
        # It runs as a background job rather than inline here because a
        # provider call can take tens of seconds per part, which is too slow
        # to hold this request open for.
        # Empty and silent answers are settled here, in the submit request, not
        # in the background job: there is nothing to send anywhere, so making
        # the student wait on a queue for a zero only delays their result.
        settled_now = ai_evaluation_service.settle_unanswered_parts(db, attempt)
        if settled_now:
            db.flush()
            db.refresh(attempt)
            # Every subjective part may now be settled, in which case the
            # attempt is finished and must not sit in the grading queue.
            _finalize_if_all_graded(db, attempt)
            db.flush()
        remaining_ai_parts = [
            part
            for part in ai_eligible_parts
            if not any(
                grade.part_id == part.id and grade.status != PART_GRADE_PENDING
                for grade in attempt.part_grades
            )
        ]
        ai_evaluation_pending = bool(remaining_ai_parts) and ai_evaluation_service.config_status(db)["configured"]
    completed_now = attempt.status == ATTEMPT_GRADED
    attempt_id = attempt.id
    user_id = attempt.user_id
    db.commit()
    if ai_evaluation_pending:
        from app.services import job_service

        job_service.enqueue_ai_auto_grade(db, attempt_id)
    # While the AI still has the attempt, nobody knows yet whether a person is
    # needed - so nobody is told. The ai_auto_grade job sends this once the
    # outcome is known, and skips the graders if the AI marked everything.
    if needs_grading and not ai_evaluation_pending:
        from app.services import notification_service

        try:
            notification_service.notify_grading_queue_routed(
                db,
                get_attempt_or_404(db, db.get(User, user_id), attempt_id),
                grading_routing_reason,
            )
        except Exception:
            logger.exception("Failed to notify grading queue routing for attempt %s", attempt_id)
    if completed_now:
        from app.services import achievement_service

        achievement_service.refresh_student_achievements(db, user_id, attempt_id)
    view = get_student_view(db, get_attempt_or_404(db, db.get(User, user_id), attempt_id))
    view["ai_evaluation_pending"] = ai_evaluation_pending
    return view


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
    grading_service.ensure_available_to_open(db, actor, attempt)
    view = get_student_view(db, attempt, include_draft_grades=True)
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


def start_grading(db: Session, actor: User, attempt_id: int) -> dict:
    from app.services import grading_service

    attempt = get_attempt_for_grading_or_404(db, actor, attempt_id)
    entry = grading_service.queue_entry_for_attempt(db, attempt)
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This submission does not require instructor grading",
        )
    if entry.status != QUEUE_COMPLETED or grading_service.latest_open_reevaluation(db, attempt.id):
        grading_service.claim(db, actor, attempt)
    return get_grading_detail(db, actor, attempt_id)


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


def _speaking_was_never_attempted(attempt: TestAttempt) -> bool:
    """True when the module has a Speaking section and nothing was recorded.

    Not "some answers missing" - none at all, which is what a candidate who
    deferred their interview and never came back looks like.
    """
    speaking_question_ids = {
        question.id
        for part in attempt.module.parts
        if part.section_type == "speaking"
        for question in part.questions
    }
    if not speaking_question_ids:
        return False
    return not any(
        answer.question_id in speaking_question_ids and (answer.audio_path or answer.response)
        for answer in attempt.answers
    )


def _finalize_if_all_graded(db: Session, attempt: TestAttempt) -> bool:
    """Marks the attempt ATTEMPT_GRADED once every human-graded part carries a
    published grade - human ("graded") or automatic AI ("ai_graded") -
    recomputing the score/CEFR profile and firing the grade-released
    notification/email. Shared by human grading (submit_grading) and
    automatic AI grading (ai_evaluation_service.auto_evaluate_submission), so
    a result looks and behaves the same to the student regardless of who/what
    produced it. A part sitting in "draft" doesn't count as published yet -
    that's the whole point of the draft/submit split, so the attempt can't
    slip into ATTEMPT_GRADED with some parts only half-reviewed."""
    if attempt.status != ATTEMPT_GRADING:
        return False
    if not attempt.part_grades or any(
        g.status not in (PART_GRADE_GRADED, PART_GRADE_AI_GRADED) for g in attempt.part_grades
    ):
        return False

    _recompute_score(attempt)
    attempt.status = ATTEMPT_GRADED
    attempt.graded_at = _now()
    cefr_service.apply_evaluation(attempt)
    db.add(attempt)

    from app.services import grading_service

    grading_service.complete_if_ready(db, attempt)
    db.commit()

    from app.services import achievement_service, notification_service

    # A paper whose Speaking section was never sat is not a result worth
    # announcing: the score is whatever the written half came to, and telling
    # the candidate their Final Test "has been graded" at 2 out of 164 reads
    # as a verdict on them rather than on an interview they have not given.
    # The grade is still recorded, and still visible from their results - it
    # is only the announcement that waits.
    if _speaking_was_never_attempted(attempt):
        logger.info(
            "Attempt %s graded without its Speaking section; holding the grade-released notice",
            attempt.id,
        )
        return True

    # Achievements and the in-app notification are best-effort: a failure here
    # must never turn an already-saved grade into an error for the caller, and
    # must never prevent the grade-released email below from being attempted.
    try:
        achievement_service.refresh_student_achievements(db, attempt.user_id, attempt.id)
        notification_service.create_grade_released_notification(db, attempt)
    except Exception:
        logger.exception("Failed to record achievements/notification for attempt %s", attempt.id)
    notification_service.send_grade_released_email(db, attempt)
    return True


def save_part_draft(
    db: Session,
    actor: User,
    attempt_id: int,
    part_id: int,
    criteria: list[dict],
    comment: Optional[str],
) -> dict:
    """Saves an instructor's in-progress scoring for one part.

    This never publishes a grade by itself - it only writes a "draft" row
    (partial criteria are fine) so an instructor can work through a
    multi-part submission across several sessions without any part going
    live to the student piecemeal. The whole attempt is only published in
    one shot via submit_grading, once every part has a complete draft.

    The exception is editing a part that is already published - either a
    correction made during an open reevaluation (attempt already
    ATTEMPT_GRADED), or overriding an AI-graded part before the rest of the
    attempt is done. Both are edits to a grade the student can already see,
    so they keep the old atomic save-and-publish-immediately behavior
    instead of going through the draft/submit-all flow meant for bringing a
    not-yet-published part to a first score.
    """
    from app.services import grading_service

    attempt = get_attempt_for_grading_or_404(db, actor, attempt_id)
    if attempt.status not in (ATTEMPT_GRADING, ATTEMPT_GRADED):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This attempt has not been submitted yet")
    part = next((p for p in attempt.module.parts if p.id == part_id), None)
    if part is None or part.auto_marked:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This part is not human-graded")
    grading_service.require_or_claim(db, actor, attempt)

    existing_grade = next((g for g in attempt.part_grades if g.part_id == part_id), None)
    is_correction = attempt.status == ATTEMPT_GRADED or (
        existing_grade is not None and existing_grade.status in (PART_GRADE_GRADED, PART_GRADE_AI_GRADED)
    )

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
        crit_dict = {
            "criterion": name,
            "max_marks": str(max_marks),
            "marks_awarded": str(awarded),
            "cefr_level": cefr_service.criterion_level(awarded, max_marks),
        }
        rat = entry.get("rationale") or entry.get("comment") or entry.get("feedback")
        if rat:
            crit_dict["rationale"] = str(rat)[:2000]
        normalized.append(crit_dict)
    # First-pass drafts may be partial; a reevaluation correction still has to
    # cover every criterion since it publishes immediately below.
    if is_correction and seen != set(rubric_by_criterion):
        missing = set(rubric_by_criterion) - seen
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Missing scores for: {', '.join(missing)}")

    grade = existing_grade
    if grade is None:
        grade = AttemptPartGrade(attempt_id=attempt.id, part_id=part_id)
        db.add(grade)
        attempt.part_grades.append(grade)
    grade.criteria = normalized
    grade.total_marks = sum((Decimal(item["marks_awarded"]) for item in normalized), Decimal("0")) if normalized else None
    grade.comment = comment
    grade.grader_id = actor.id
    grade.status = PART_GRADE_GRADED if is_correction else PART_GRADE_DRAFT
    grade.graded_at = _now() if is_correction else None
    db.add(grade)

    # Partial-progress visibility: recompute CEFR now even if other parts are
    # still draft/pending, so the student sees an updating profile once a
    # part is actually published, not just on the final one. Draft rows are
    # excluded from this by cefr_service (only "graded"/"ai_graded" count).
    cefr_service.apply_evaluation(attempt)
    db.add(attempt)
    db.commit()

    if is_correction:
        attempt = get_attempt_for_grading_or_404(db, actor, attempt_id)
        _finalize_if_all_graded(db, attempt)
    return get_grading_detail(db, actor, attempt_id)


def submit_grading(db: Session, actor: User, attempt_id: int) -> dict:
    """Publishes every drafted part grade at once, finishing the first-pass
    manual evaluation for this attempt in a single action - this is the only
    way an attempt moves ATTEMPT_GRADING -> ATTEMPT_GRADED, so an instructor
    can never leave a submission half-graded and have it read as complete."""
    from app.services import grading_service

    attempt = get_attempt_for_grading_or_404(db, actor, attempt_id)
    if attempt.status != ATTEMPT_GRADING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This attempt is not awaiting grading")
    grading_service.require_or_claim(db, actor, attempt)

    gradable_parts = [p for p in attempt.module.parts if not p.auto_marked]
    grades_by_part = {g.part_id: g for g in attempt.part_grades}
    incomplete = []
    for part in gradable_parts:
        grade = grades_by_part.get(part.id)
        rubric_criteria = {item["criterion"] for item in (part.rubric or [])}
        scored_criteria = {item["criterion"] for item in (grade.criteria or [])} if grade else set()
        if not rubric_criteria <= scored_criteria:
            incomplete.append(part.title)
    if incomplete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Finish scoring every part before submitting: {', '.join(incomplete)}",
        )

    now = _now()
    for grade in attempt.part_grades:
        if grade.status == PART_GRADE_DRAFT:
            grade.status = PART_GRADE_GRADED
            grade.grader_id = actor.id
            grade.graded_at = now
            db.add(grade)
    db.commit()

    attempt = get_attempt_for_grading_or_404(db, actor, attempt_id)
    _finalize_if_all_graded(db, attempt)
    return get_grading_detail(db, actor, attempt_id)


def list_my_attempts(db: Session, user: User) -> list[dict]:
    # A READY attempt is a candidate standing at pre-exam onboarding. It has no
    # answers, no score and no elapsed time, and it may still be walked away
    # from without spending the sitting, so it is not part of their history.
    attempts = (
        _attempt_query(db)
        .filter(TestAttempt.user_id == user.id, TestAttempt.status != ATTEMPT_READY)
        .order_by(TestAttempt.started_at.desc())
        .all()
    )
    restored = False
    for attempt in attempts:
        restored = _restore_deferred_speaking_attempt(db, attempt) or restored
    if restored:
        attempts = (
            _attempt_query(db)
            .filter(TestAttempt.user_id == user.id, TestAttempt.status != ATTEMPT_READY)
            .order_by(TestAttempt.started_at.desc())
            .all()
        )
    attempt_ids = [attempt.id for attempt in attempts]
    reevaluations = (
        db.query(ReevaluationRequest)
        .filter(ReevaluationRequest.attempt_id.in_(attempt_ids))
        .all()
    ) if attempt_ids else []
    reeval_by_attempt: dict[int, ReevaluationRequest] = {}
    for r in reevaluations:
        existing = reeval_by_attempt.get(r.attempt_id)
        if not existing or r.id > existing.id:
            reeval_by_attempt[r.attempt_id] = r

    result = []
    for attempt in attempts:
        reeval = reeval_by_attempt.get(attempt.id)
        has_requested_instructor = reeval is not None
        reeval_status = reeval.status if reeval else None

        part_grades = attempt.part_grades or []
        has_ai_grade = any(g.status == PART_GRADE_AI_GRADED for g in part_grades)
        has_instructor_grade = any(
            g.status == PART_GRADE_GRADED and g.grader_id is not None for g in part_grades
        ) or any(g.status == PART_GRADE_GRADED for g in part_grades) or (
            reeval is not None and reeval.status == REEVALUATION_RESOLVED
        )

        is_open_reeval = reeval is not None and reeval.status in (REEVALUATION_PENDING, REEVALUATION_IN_REVIEW)
        is_pending_grading = (
            attempt.status in (ATTEMPT_SUBMITTED, ATTEMPT_GRADING)
            or any(g.status in (PART_GRADE_PENDING, PART_GRADE_DRAFT) for g in part_grades)
            or is_open_reeval
        )

        if is_open_reeval:
            grading_type = "instructor_requested"
        elif is_pending_grading:
            grading_type = "pending_grading"
        elif has_instructor_grade:
            grading_type = "instructor_graded"
        elif has_ai_grade:
            grading_type = "ai_graded"
        elif attempt.status == ATTEMPT_GRADED:
            grading_type = "auto_marked"
        else:
            grading_type = None

        result.append({
            "id": attempt.id,
            "module_id": attempt.module_id,
            "module_type": attempt.module.module_type,
            "module_title": attempt.module.title,
            "status": attempt.status,
            "security_required": attempt.security_required,
            "security_risk_score": attempt.security_risk_score,
            "phase": _attempt_phase(attempt),
            "resume_part_id": _resume_part_id(attempt),
            "started_at": _utc_out(attempt.started_at),
            "submitted_at": _utc_out(attempt.submitted_at),
            "raw_score": str(attempt.raw_score) if attempt.raw_score is not None else None,
            "max_score": str(attempt.max_score) if attempt.max_score is not None else None,
            "band_label": attempt.band_label,
            "cefr_level": attempt.cefr_level,
            "cefr_profile": attempt.cefr_profile,
            "is_ai_graded": has_ai_grade,
            "is_instructor_graded": has_instructor_grade,
            "instructor_requested": has_requested_instructor,
            "is_pending_grading": is_pending_grading,
            "grading_type": grading_type,
            "reevaluation_status": reeval_status,
        })
    return result
