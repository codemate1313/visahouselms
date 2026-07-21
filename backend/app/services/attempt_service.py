from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload, selectinload

from app.config import settings
from app.models.attempt import (
    ATTEMPT_GRADED,
    ATTEMPT_GRADING,
    ATTEMPT_IN_PROGRESS,
    ATTEMPT_SUBMITTED,
    AttemptAnswer,
    AttemptFlag,
    AttemptPartGrade,
    TestAttempt,
)
from app.models.exam_module import ExamModule, ExamModuleAsset, ExamModulePart, ExamModuleQuestion
from app.models.user import User
from app.services.module_blueprint_service import SECTION_BLUEPRINTS

# Small buffer so a slow network round-trip near the deadline doesn't cost
# the student their last answer - the server clock is still authoritative.
EXPIRY_BUFFER_MINUTES = 2


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


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

    expires_at = _now() + timedelta(minutes=module.duration_minutes + EXPIRY_BUFFER_MINUTES)
    attempt = TestAttempt(
        user_id=user.id,
        module_id=module.id,
        status=ATTEMPT_IN_PROGRESS,
        is_final=is_final,
        started_at=_now(),
        expires_at=expires_at,
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


def _redacted_question(question: ExamModuleQuestion, answer: Optional[AttemptAnswer]) -> dict:
    return {
        "id": question.id,
        "question_type": question.question_type,
        "prompt": question.prompt,
        "instructions": question.instructions,
        "passage": question.passage,
        "options": question.options,
        "points": str(question.points),
        "sort_order": question.sort_order,
        "response": answer.response if answer else None,
        "audio_path": (f"/storage/{answer.audio_path}" if answer and answer.audio_path else None),
    }


def _revealed_question(question: ExamModuleQuestion, answer: Optional[AttemptAnswer]) -> dict:
    out = _redacted_question(question, answer)
    out["correct_answers"] = question.correct_answers
    out["explanation"] = question.explanation
    out["is_correct"] = answer.is_correct if answer else None
    out["points_awarded"] = str(answer.points_awarded) if answer and answer.points_awarded is not None else None
    return out


def _serialize_parts(attempt: TestAttempt, reveal: bool) -> list[dict]:
    answers_by_question = {answer.question_id: answer for answer in attempt.answers}
    grades_by_part = {grade.part_id: grade for grade in attempt.part_grades}
    parts = []
    for part in sorted(attempt.module.parts, key=lambda p: p.sort_order):
        question_fn = _revealed_question if reveal else _redacted_question
        grade = grades_by_part.get(part.id)
        parts.append(
            {
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
                "sort_order": part.sort_order,
                "assets": [_asset_out(asset, reveal_transcript=reveal) for asset in part.assets],
                "questions": [
                    question_fn(question, answers_by_question.get(question.id))
                    for question in sorted(part.questions, key=lambda q: q.sort_order)
                ],
                "grade": (
                    {
                        "criteria": grade.criteria,
                        "total_marks": str(grade.total_marks) if grade.total_marks is not None else None,
                        "comment": grade.comment,
                        "status": grade.status,
                    }
                    if grade
                    else None
                ),
            }
        )
    return parts


def get_student_view(db: Session, attempt: TestAttempt) -> dict:
    if attempt.status == ATTEMPT_IN_PROGRESS and attempt.expires_at <= _now():
        _auto_expire(db, attempt)
        attempt = get_attempt_or_404(db, db.get(User, attempt.user_id), attempt.id)
    reveal = attempt.status in (ATTEMPT_GRADING, ATTEMPT_GRADED)
    return {
        "id": attempt.id,
        "module_id": attempt.module_id,
        "module_type": attempt.module.module_type,
        "module_title": attempt.module.title,
        "course_id": attempt.course_id,
        "status": attempt.status,
        "is_final": attempt.is_final,
        "started_at": attempt.started_at,
        "expires_at": attempt.expires_at,
        "submitted_at": attempt.submitted_at,
        "raw_score": str(attempt.raw_score) if attempt.raw_score is not None else None,
        "max_score": str(attempt.max_score) if attempt.max_score is not None else None,
        "band_label": attempt.band_label,
        "graded_at": attempt.graded_at,
        "flag_count": len(attempt.flags),
        "parts": _serialize_parts(attempt, reveal=reveal),
    }


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


def save_answer(db: Session, attempt: TestAttempt, question_id: int, response: Optional[dict]) -> dict:
    _require_in_progress(attempt)
    part, _question = _question_or_404(attempt, question_id)
    answer = next((item for item in attempt.answers if item.question_id == question_id), None)
    if answer is None:
        answer = AttemptAnswer(attempt_id=attempt.id, question_id=question_id, part_id=part.id)
        db.add(answer)
    answer.response = response
    db.commit()
    return {"question_id": question_id, "saved_at": _now()}


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
    try:
        db.commit()
    except Exception:
        db.rollback()
        destination.unlink(missing_ok=True)
        raise
    if old_path is not None:
        old_path.unlink(missing_ok=True)
    return {"question_id": question_id, "audio_url": f"/storage/{relative.as_posix()}"}


def record_flag(db: Session, attempt: TestAttempt, flag_type: str, meta: Optional[dict]) -> dict:
    flag = AttemptFlag(attempt_id=attempt.id, flag_type=flag_type, meta=meta)
    db.add(flag)
    db.commit()
    return {"recorded": True}


def _normalize(value) -> str:
    return " ".join(str(value).strip().upper().split())


def _grade_answer(question: ExamModuleQuestion, response: Optional[dict]) -> tuple[Optional[bool], Decimal]:
    correct = {_normalize(item) for item in (question.correct_answers or [])}
    qtype = question.question_type
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

    return is_correct, (Decimal(question.points) if is_correct else Decimal("0"))


def _band_for_reading(raw_marks: Decimal) -> Optional[str]:
    for band in SECTION_BLUEPRINTS["reading"]["assessment"]["score_bands"]:
        if band["minimum"] <= raw_marks <= band["maximum"]:
            return band["level"]
    return None


def submit_attempt(db: Session, attempt: TestAttempt) -> dict:
    if attempt.status != ATTEMPT_IN_PROGRESS:
        # idempotent: a retried submit just returns the current state
        return get_student_view(db, attempt)

    attempt.status = ATTEMPT_SUBMITTED
    attempt.submitted_at = _now()

    answers_by_question = {answer.question_id: answer for answer in attempt.answers}
    raw_score = Decimal("0")
    max_score = Decimal("0")
    reading_raw = Decimal("0")
    reading_max = Decimal("0")
    has_reading = False
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
                is_correct, points = _grade_answer(question, answer.response)
                answer.is_correct = is_correct
                answer.points_awarded = points
                part_points += points
            raw_score += part_points
            if part.section_type == "reading":
                has_reading = True
                reading_raw += part_points
                if part.max_marks is not None:
                    reading_max += Decimal(part.max_marks)
        else:
            needs_grading = True
            existing_grade = next((g for g in attempt.part_grades if g.part_id == part.id), None)
            if existing_grade is None:
                db.add(AttemptPartGrade(attempt_id=attempt.id, part_id=part.id, criteria=[]))

    attempt.raw_score = raw_score
    attempt.max_score = max_score if max_score > 0 else None
    if has_reading:
        attempt.band_label = _band_for_reading(reading_raw)

    if needs_grading:
        attempt.status = ATTEMPT_GRADING
    else:
        attempt.status = ATTEMPT_GRADED
        attempt.graded_at = _now()

    db.add(attempt)
    db.commit()
    return get_student_view(db, get_attempt_or_404(db, db.get(User, attempt.user_id), attempt.id))


def get_attempt_for_grading_or_404(db: Session, actor: User, attempt_id: int) -> TestAttempt:
    attempt = _attempt_query(db).filter(TestAttempt.id == attempt_id).first()
    if attempt is None or attempt.module.created_by_id != actor.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    return attempt


def list_grading_queue(db: Session, actor: User, status_filter: Optional[str] = None) -> list[dict]:
    query = (
        _attempt_query(db)
        .join(ExamModule, TestAttempt.module_id == ExamModule.id)
        .filter(ExamModule.created_by_id == actor.id)
    )
    if status_filter:
        query = query.filter(TestAttempt.status == status_filter)
    else:
        query = query.filter(TestAttempt.status.in_((ATTEMPT_GRADING, ATTEMPT_GRADED)))
    attempts = query.order_by(TestAttempt.submitted_at.asc()).all()
    return [
        {
            "id": attempt.id,
            "user_id": attempt.user_id,
            "student_name": f"{attempt.user.first_name} {attempt.user.last_name}",
            "module_id": attempt.module_id,
            "module_title": attempt.module.title,
            "module_type": attempt.module.module_type,
            "status": attempt.status,
            "submitted_at": attempt.submitted_at,
            "flag_count": len(attempt.flags),
            "parts_to_grade": sum(1 for g in attempt.part_grades if g.status == "pending"),
        }
        for attempt in attempts
    ]


def get_grading_detail(db: Session, actor: User, attempt_id: int) -> dict:
    attempt = get_attempt_for_grading_or_404(db, actor, attempt_id)
    view = get_student_view(db, attempt)
    view["student_name"] = f"{attempt.user.first_name} {attempt.user.last_name}"
    view["student_email"] = attempt.user.email
    view["flags"] = [
        {"flag_type": flag.flag_type, "occurred_at": flag.occurred_at, "meta": flag.meta}
        for flag in sorted(attempt.flags, key=lambda f: f.occurred_at)
    ]
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
    attempt = get_attempt_for_grading_or_404(db, actor, attempt_id)
    if attempt.status not in (ATTEMPT_GRADING, ATTEMPT_GRADED):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This attempt has not been submitted yet")
    part = next((p for p in attempt.module.parts if p.id == part_id), None)
    if part is None or part.auto_marked:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This part is not human-graded")

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
        normalized.append({"criterion": name, "max_marks": str(max_marks), "marks_awarded": str(awarded)})
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
        db.add(attempt)

    db.commit()
    attempt = get_attempt_for_grading_or_404(db, actor, attempt_id)
    if just_completed:
        from app.services import notification_service

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
            "started_at": attempt.started_at,
            "submitted_at": attempt.submitted_at,
            "raw_score": str(attempt.raw_score) if attempt.raw_score is not None else None,
            "max_score": str(attempt.max_score) if attempt.max_score is not None else None,
            "band_label": attempt.band_label,
        }
        for attempt in attempts
    ]
