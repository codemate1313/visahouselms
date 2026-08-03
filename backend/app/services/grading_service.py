import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import or_, update
from sqlalchemy.orm import Session

from app.models.attempt import (
    ATTEMPT_GRADED,
    ATTEMPT_GRADING,
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
from app.models.role import INST_INSTRUCTOR, SA_INSTRUCTOR, Role
from app.models.user import User

logger = logging.getLogger(__name__)

OPEN_REEVALUATION_STATUSES = (REEVALUATION_PENDING, REEVALUATION_IN_REVIEW)
GRADING_CLAIM_TTL = timedelta(minutes=5)


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _institute_has_active_instructor(db: Session, institute_id: int) -> bool:
    return (
        db.query(User)
        .filter(
            User.institute_id == institute_id,
            User.is_active.is_(True),
            User.deleted_at.is_(None),
            User.role.has(Role.name == INST_INSTRUCTOR),
        )
        .first()
        is not None
    )


def can_grade_attempt(db: Session, actor: User, attempt: TestAttempt) -> bool:
    if actor.role.name == INST_INSTRUCTOR:
        return actor.institute_id is not None and attempt.user.institute_id == actor.institute_id
    if actor.role.name != SA_INSTRUCTOR:
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
        "created_at": entry.created_at,
    }


def _claim_cutoff() -> datetime:
    return _now() - GRADING_CLAIM_TTL


def _expire_stale_entry(db: Session, entry: GradingQueueEntry) -> bool:
    if (
        entry.status != QUEUE_CLAIMED
        or entry.claimed_at is None
        or entry.claimed_at >= _claim_cutoff()
    ):
        return False
    entry.status = QUEUE_PENDING
    entry.assigned_to_id = None
    entry.claimed_at = None
    request = latest_open_reevaluation(db, entry.attempt_id)
    if request:
        request.status = REEVALUATION_PENDING
        request.assigned_to_id = None
        db.add(request)
    db.add(entry)
    db.flush()
    return True


def _expire_stale_claims(db: Session) -> None:
    stale_entries = (
        db.query(GradingQueueEntry)
        .filter(
            GradingQueueEntry.status == QUEUE_CLAIMED,
            GradingQueueEntry.claimed_at.is_not(None),
            GradingQueueEntry.claimed_at < _claim_cutoff(),
        )
        .all()
    )
    for entry in stale_entries:
        _expire_stale_entry(db, entry)


def claim(db: Session, actor: User, attempt: TestAttempt) -> dict:
    if not can_grade_attempt(db, actor, attempt):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    entry = ensure_queue_entry(db, attempt)
    if entry.status == QUEUE_COMPLETED and not latest_open_reevaluation(db, attempt.id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This grading item is already complete")
    entry = _claim_entry(db, entry, actor)
    request = latest_open_reevaluation(db, attempt.id)
    had_reevaluation = request is not None
    if request:
        request.status = REEVALUATION_IN_REVIEW
        request.assigned_to_id = actor.id
        db.add(request)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    from app.services import notification_service

    try:
        if had_reevaluation:
            notification_service.notify_reevaluation_claimed(db, attempt, actor)
    except Exception:
        logger.exception("Failed to send reevaluation-claimed notification for attempt %s", attempt.id)
    return _entry_out(entry)


def release(db: Session, actor: User, attempt: TestAttempt) -> dict:
    entry = ensure_queue_entry(db, attempt)
    if entry.assigned_to_id != actor.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You have not claimed this submission")
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
    from app.services import notification_service

    try:
        notification_service.notify_grading_released(db, attempt)
    except Exception:
        logger.exception("Failed to send grading-released notification for attempt %s", attempt.id)
    return _entry_out(entry)


def require_or_claim(db: Session, actor: User, attempt: TestAttempt) -> GradingQueueEntry:
    entry = ensure_queue_entry(db, attempt)
    if entry.status == QUEUE_COMPLETED and not latest_open_reevaluation(db, attempt.id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Completed grading is read-only unless a reevaluation is open")
    return _claim_entry(db, entry, actor)


def _claim_entry(
    db: Session, entry: GradingQueueEntry, actor: User
) -> GradingQueueEntry:
    claimed_at = _now()
    claim_cutoff = claimed_at - GRADING_CLAIM_TTL
    result = db.execute(
        update(GradingQueueEntry)
        .where(
            GradingQueueEntry.id == entry.id,
            or_(
                GradingQueueEntry.assigned_to_id.is_(None),
                GradingQueueEntry.assigned_to_id == actor.id,
                GradingQueueEntry.claimed_at < claim_cutoff,
            ),
        )
        .values(
            status=QUEUE_CLAIMED,
            assigned_to_id=actor.id,
            claimed_at=claimed_at,
        )
    )
    if result.rowcount != 1:
        db.expire(entry)
        db.refresh(entry)
        owner = (
            f"{entry.assigned_to.first_name} {entry.assigned_to.last_name}"
            if entry.assigned_to
            else "another instructor"
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This submission is currently being evaluated by {owner}.",
        )
    db.expire(entry)
    db.refresh(entry)
    return entry


def ensure_available_to_open(
    db: Session, actor: User, attempt: TestAttempt
) -> None:
    entry = ensure_queue_entry(db, attempt)
    if _expire_stale_entry(db, entry):
        db.commit()
        db.refresh(entry)
    if entry.status == QUEUE_CLAIMED and entry.assigned_to_id not in (None, actor.id):
        owner = (
            f"{entry.assigned_to.first_name} {entry.assigned_to.last_name}"
            if entry.assigned_to
            else "another instructor"
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This submission is currently being evaluated by {owner}.",
        )


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

    _expire_stale_claims(db)
    # Inner join on User (rather than relying on the lazy-loaded relationship)
    # so an attempt whose student account was hard-deleted - e.g. by a data
    # reset script that didn't go through the ORM cascade - is excluded here
    # instead of crashing can_grade_attempt below on a None `attempt.user`.
    query = (
        _attempt_query(db)
        .join(ExamModule, TestAttempt.module_id == ExamModule.id)
        .join(User, TestAttempt.user_id == User.id)
    )
    if actor.role.name == INST_INSTRUCTOR:
        query = query.filter(User.institute_id == actor.institute_id)
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
            "parts_to_grade": sum(1 for grade in attempt.part_grades if grade.status in ("pending", "draft")),
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found")
    if attempt.status not in (ATTEMPT_GRADING, ATTEMPT_GRADED) or not attempt.part_grades:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only submitted instructor-reviewable results can be sent for review")
    if latest_open_reevaluation(db, attempt.id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A reevaluation request is already open for this result")
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
    from app.services import notification_service

    try:
        notification_service.notify_reevaluation_requested(db, attempt)
    except Exception:
        logger.exception("Failed to send reevaluation-requested notification for attempt %s", attempt.id)
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No open reevaluation request was found")
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
    from app.services import notification_service

    try:
        notification_service.notify_reevaluation_resolved(db, attempt, request.status)
    except Exception:
        logger.exception("Failed to send reevaluation-resolved notification for attempt %s", attempt.id)
    return _reevaluation_out(request)


def usage_summary(db: Session) -> dict:
    period = _now().strftime("%Y-%m")
    # One bucket per student - institute or direct - so every row can be
    # totalled without double-counting.
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
