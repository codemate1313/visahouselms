from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.attempt import (
    ATTEMPT_GRADED,
    AiEvaluationLimit,
    GradingQueueEntry,
    QUEUE_CLAIMED,
    QUEUE_COMPLETED,
    QUEUE_PENDING,
    REEVALUATION_IN_REVIEW,
    REEVALUATION_PENDING,
    REEVALUATION_REJECTED,
    REEVALUATION_RESOLVED,
    ReevaluationRequest,
    TestAttempt,
)
from app.models.exam_module import ExamModule
from app.models.role import INST_INSTRUCTOR, SA_INSTRUCTOR
from app.models.user import User

OPEN_REEVALUATION_STATUSES = (REEVALUATION_PENDING, REEVALUATION_IN_REVIEW)


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _institute_has_active_instructor(db: Session, institute_id: int) -> bool:
    return (
        db.query(User)
        .filter(
            User.institute_id == institute_id,
            User.is_active.is_(True),
            User.deleted_at.is_(None),
            User.role.has(name=INST_INSTRUCTOR),
        )
        .first()
        is not None
    )


def can_grade_attempt(db: Session, actor: User, attempt: TestAttempt) -> bool:
    if actor.role.name == INST_INSTRUCTOR:
        return actor.institute_id is not None and attempt.user.institute_id == actor.institute_id
    if actor.role.name != SA_INSTRUCTOR or attempt.module.created_by_id != actor.id:
        return False
    return attempt.user.institute_id is None or not _institute_has_active_instructor(
        db, attempt.user.institute_id
    )


def ensure_queue_entry(
    db: Session,
    attempt: TestAttempt,
    *,
    routing_reason: Optional[str] = None,
) -> GradingQueueEntry:
    entry = db.query(GradingQueueEntry).filter(GradingQueueEntry.attempt_id == attempt.id).first()
    if entry is None:
        reason = routing_reason or (
            "direct_student"
            if attempt.user.institute_id is None
            else "institute_instructor"
            if _institute_has_active_instructor(db, attempt.user.institute_id)
            else "sa_fallback"
        )
        entry = GradingQueueEntry(
            attempt_id=attempt.id,
            status=QUEUE_PENDING,
            routing_reason=reason,
            priority=0,
            due_at=_now() + timedelta(days=2),
        )
        db.add(entry)
        db.flush()
    return entry


def queue_entry_for_attempt(db: Session, attempt: TestAttempt) -> Optional[GradingQueueEntry]:
    if not attempt.part_grades:
        return None
    return ensure_queue_entry(db, attempt)


def _entry_out(entry: Optional[GradingQueueEntry]) -> Optional[dict]:
    if entry is None:
        return None
    return {
        "id": entry.id,
        "status": entry.status,
        "assigned_to_id": entry.assigned_to_id,
        "assigned_to_name": (
            f"{entry.assigned_to.first_name} {entry.assigned_to.last_name}" if entry.assigned_to else None
        ),
        "routing_reason": entry.routing_reason,
        "priority": entry.priority,
        "due_at": entry.due_at,
        "claimed_at": entry.claimed_at,
        "completed_at": entry.completed_at,
    }


def claim(db: Session, actor: User, attempt: TestAttempt) -> dict:
    if not can_grade_attempt(db, actor, attempt):
        raise HTTPException(status_code=404, detail="Submission not found")
    entry = ensure_queue_entry(db, attempt)
    if entry.status == QUEUE_COMPLETED and not latest_open_reevaluation(db, attempt.id):
        raise HTTPException(status_code=409, detail="This grading item is already complete")
    if entry.assigned_to_id not in (None, actor.id):
        raise HTTPException(status_code=409, detail="This submission is claimed by another instructor")
    entry.status = QUEUE_CLAIMED
    entry.assigned_to_id = actor.id
    entry.claimed_at = entry.claimed_at or _now()
    request = latest_open_reevaluation(db, attempt.id)
    if request:
        request.status = REEVALUATION_IN_REVIEW
        request.assigned_to_id = actor.id
        db.add(request)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _entry_out(entry)


def release(db: Session, actor: User, attempt: TestAttempt) -> dict:
    entry = ensure_queue_entry(db, attempt)
    if entry.assigned_to_id != actor.id:
        raise HTTPException(status_code=409, detail="You have not claimed this submission")
    entry.status = QUEUE_PENDING
    entry.assigned_to_id = None
    entry.claimed_at = None
    request = latest_open_reevaluation(db, attempt.id)
    if request:
        request.status = REEVALUATION_PENDING
        request.assigned_to_id = None
        db.add(request)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _entry_out(entry)


def require_or_claim(db: Session, actor: User, attempt: TestAttempt) -> GradingQueueEntry:
    entry = ensure_queue_entry(db, attempt)
    if entry.status == QUEUE_COMPLETED and not latest_open_reevaluation(db, attempt.id):
        raise HTTPException(status_code=409, detail="Completed grading is read-only unless a reevaluation is open")
    if entry.assigned_to_id not in (None, actor.id):
        raise HTTPException(status_code=409, detail="This submission is claimed by another instructor")
    if entry.assigned_to_id is None:
        entry.assigned_to_id = actor.id
        entry.claimed_at = _now()
    entry.status = QUEUE_CLAIMED
    db.add(entry)
    return entry


def complete_if_ready(db: Session, attempt: TestAttempt) -> None:
    entry = ensure_queue_entry(db, attempt)
    if latest_open_reevaluation(db, attempt.id):
        entry.status = QUEUE_CLAIMED if entry.assigned_to_id else QUEUE_PENDING
        entry.completed_at = None
    else:
        entry.status = QUEUE_COMPLETED
        entry.completed_at = _now()
    db.add(entry)


def queue_metadata(db: Session, attempt: TestAttempt) -> Optional[dict]:
    entry = queue_entry_for_attempt(db, attempt)
    return _entry_out(entry)


def list_queue(db: Session, actor: User, status_filter: Optional[str] = None) -> list[dict]:
    from app.services.attempt_service import _attempt_query

    query = _attempt_query(db).join(ExamModule, TestAttempt.module_id == ExamModule.id)
    if actor.role.name == INST_INSTRUCTOR:
        query = query.join(User, TestAttempt.user_id == User.id).filter(User.institute_id == actor.institute_id)
    else:
        query = query.filter(ExamModule.created_by_id == actor.id)
    attempts = [attempt for attempt in query.order_by(TestAttempt.submitted_at.asc()).all() if can_grade_attempt(db, actor, attempt)]
    rows = []
    for attempt in attempts:
        if not attempt.part_grades:
            continue
        entry = ensure_queue_entry(db, attempt)
        if status_filter and entry.status != status_filter:
            continue
        reevaluation = latest_open_reevaluation(db, attempt.id)
        rows.append({
            "id": attempt.id,
            "user_id": attempt.user_id,
            "student_name": f"{attempt.user.first_name} {attempt.user.last_name}",
            "module_id": attempt.module_id,
            "module_title": attempt.module.title,
            "module_type": attempt.module.module_type,
            "status": attempt.status,
            "submitted_at": attempt.submitted_at,
            "flag_count": len(attempt.flags),
            "parts_to_grade": sum(1 for grade in attempt.part_grades if grade.status == "pending"),
            "queue": _entry_out(entry),
            "is_reevaluation": reevaluation is not None,
        })
    db.commit()
    return sorted(rows, key=lambda item: (-item["queue"]["priority"], item["submitted_at"] or _now()))


def _reevaluation_out(request: Optional[ReevaluationRequest]) -> Optional[dict]:
    if request is None:
        return None
    return {
        "id": request.id,
        "attempt_id": request.attempt_id,
        "student_name": f"{request.student.first_name} {request.student.last_name}",
        "module_title": request.attempt.module.title,
        "reason": request.reason,
        "status": request.status,
        "assigned_to_id": request.assigned_to_id,
        "assigned_to_name": (
            f"{request.assigned_to.first_name} {request.assigned_to.last_name}" if request.assigned_to else None
        ),
        "resolution_note": request.resolution_note,
        "created_at": request.created_at,
        "resolved_at": request.resolved_at,
    }


def latest_reevaluation(db: Session, attempt_id: int) -> Optional[ReevaluationRequest]:
    return (
        db.query(ReevaluationRequest)
        .filter(ReevaluationRequest.attempt_id == attempt_id)
        .order_by(ReevaluationRequest.created_at.desc(), ReevaluationRequest.id.desc())
        .first()
    )


def latest_open_reevaluation(db: Session, attempt_id: int) -> Optional[ReevaluationRequest]:
    return (
        db.query(ReevaluationRequest)
        .filter(
            ReevaluationRequest.attempt_id == attempt_id,
            ReevaluationRequest.status.in_(OPEN_REEVALUATION_STATUSES),
        )
        .order_by(ReevaluationRequest.created_at.desc(), ReevaluationRequest.id.desc())
        .first()
    )


def reevaluation_for_student(db: Session, attempt: TestAttempt) -> Optional[dict]:
    return _reevaluation_out(latest_reevaluation(db, attempt.id))


def request_reevaluation(db: Session, student: User, attempt: TestAttempt, reason: str) -> dict:
    if attempt.user_id != student.id:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.status != ATTEMPT_GRADED or not attempt.part_grades:
        raise HTTPException(status_code=409, detail="Only a completed instructor-graded result can be reevaluated")
    if latest_open_reevaluation(db, attempt.id):
        raise HTTPException(status_code=409, detail="A reevaluation request is already open for this result")
    request = ReevaluationRequest(attempt_id=attempt.id, student_id=student.id, reason=reason.strip())
    db.add(request)
    entry = ensure_queue_entry(db, attempt, routing_reason="reevaluation")
    entry.status = QUEUE_PENDING
    entry.assigned_to_id = None
    entry.claimed_at = None
    entry.completed_at = None
    entry.routing_reason = "reevaluation"
    entry.priority = 10
    entry.due_at = _now() + timedelta(days=2)
    db.add(entry)
    db.commit()
    db.refresh(request)
    return _reevaluation_out(request)


def resolve_reevaluation(
    db: Session,
    actor: User,
    attempt: TestAttempt,
    resolution: str,
    note: str,
) -> dict:
    request = latest_open_reevaluation(db, attempt.id)
    if request is None:
        raise HTTPException(status_code=404, detail="No open reevaluation request was found")
    entry = require_or_claim(db, actor, attempt)
    request.status = REEVALUATION_RESOLVED if resolution == "resolved" else REEVALUATION_REJECTED
    request.resolution_note = note.strip()
    request.assigned_to_id = actor.id
    request.resolved_at = _now()
    entry.status = QUEUE_COMPLETED
    entry.completed_at = _now()
    entry.priority = 0
    db.add_all([request, entry])
    db.commit()
    db.refresh(request)
    return _reevaluation_out(request)


def usage_summary(db: Session) -> dict:
    period = _now().strftime("%Y-%m")
    rows = db.query(AiEvaluationLimit).filter(AiEvaluationLimit.period_key == period).all()
    return {
        "period": period,
        "used": sum(row.used_count for row in rows),
        "limit": sum(row.monthly_limit for row in rows),
        "scopes": len(rows),
    }


def admin_overview(db: Session) -> dict:
    queue_counts = {
        state: db.query(GradingQueueEntry).filter(GradingQueueEntry.status == state).count()
        for state in (QUEUE_PENDING, QUEUE_CLAIMED, QUEUE_COMPLETED)
    }
    requests = (
        db.query(ReevaluationRequest)
        .order_by(ReevaluationRequest.created_at.desc(), ReevaluationRequest.id.desc())
        .limit(100)
        .all()
    )
    return {
        "queue": queue_counts,
        "ai_usage": usage_summary(db),
        "reevaluations": [_reevaluation_out(request) for request in requests],
    }
