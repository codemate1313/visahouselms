import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.attempt import RETAKE_APPROVED, RETAKE_PENDING, RETAKE_REJECTED, RetakeRequest, TestAttempt
from app.models.user import User

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _retake_out(request: Optional[RetakeRequest]) -> Optional[dict]:
    if request is None:
        return None
    return {
        "id": request.id,
        "attempt_id": request.attempt_id,
        "student_id": request.student_id,
        "student_name": f"{request.student.first_name} {request.student.last_name}",
        "student_email": request.student.email,
        "module_title": request.attempt.module.title,
        "module_type": request.attempt.module.module_type,
        "reason": request.reason,
        "status": request.status,
        "reviewed_by_id": request.reviewed_by_id,
        "reviewed_by_name": (
            f"{request.reviewed_by.first_name} {request.reviewed_by.last_name}" if request.reviewed_by else None
        ),
        "review_note": request.review_note,
        "created_at": request.created_at,
        "reviewed_at": request.reviewed_at,
        "consumed_at": request.consumed_at,
    }


def latest_retake(db: Session, attempt_id: int) -> Optional[RetakeRequest]:
    return (
        db.query(RetakeRequest)
        .filter(RetakeRequest.attempt_id == attempt_id)
        .order_by(RetakeRequest.created_at.desc(), RetakeRequest.id.desc())
        .first()
    )


def get_retake_for_student(db: Session, attempt: TestAttempt) -> Optional[dict]:
    return _retake_out(latest_retake(db, attempt.id))


def get_available_retake(db: Session, user_id: int, module_id: int) -> Optional[RetakeRequest]:
    """An approved-but-not-yet-used RetakeRequest for this student+module, if
    any - the one thing that lets attempt_service.start_attempt grant a
    second sitting."""
    return (
        db.query(RetakeRequest)
        .join(TestAttempt, RetakeRequest.attempt_id == TestAttempt.id)
        .filter(
            RetakeRequest.student_id == user_id,
            TestAttempt.module_id == module_id,
            RetakeRequest.status == RETAKE_APPROVED,
            RetakeRequest.consumed_at.is_(None),
        )
        .order_by(RetakeRequest.reviewed_at.asc())
        .first()
    )


def request_retake(db: Session, student: User, attempt: TestAttempt, reason: str) -> dict:
    if attempt.user_id != student.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found")
    if attempt.is_final or (attempt.module and attempt.module.module_type == "final_test"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Final tests cannot be retaken.",
        )

    existing = latest_retake(db, attempt.id)
    if existing is not None and existing.status == RETAKE_PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A retake request is already open for this attempt")
    if existing is not None and existing.status == RETAKE_APPROVED and existing.consumed_at is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A retake request for this attempt has already been approved",
        )

    request = RetakeRequest(attempt_id=attempt.id, student_id=student.id, reason=reason.strip())
    db.add(request)
    db.commit()
    db.refresh(request)

    from app.services import notification_service

    try:
        notification_service.notify_retake_requested(db, request)
    except Exception:
        logger.exception("Failed to send retake-requested notification for request %s", request.id)
    return _retake_out(request)


def resolve_retake(db: Session, actor: User, request_id: int, resolution: str, note: str) -> dict:
    request = db.query(RetakeRequest).filter(RetakeRequest.id == request_id).first()
    if request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retake request not found")
    if request.status != RETAKE_PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This retake request has already been reviewed")

    request.status = RETAKE_APPROVED if resolution == "approved" else RETAKE_REJECTED
    request.review_note = note.strip()
    request.reviewed_by_id = actor.id
    request.reviewed_at = _now()
    db.add(request)
    db.commit()
    db.refresh(request)

    from app.services import notification_service

    try:
        notification_service.notify_retake_resolved(db, request)
    except Exception:
        logger.exception("Failed to send retake-resolved notification for request %s", request.id)
    return _retake_out(request)


def list_retake_requests(db: Session, status_filter: Optional[str] = None) -> list[dict]:
    query = db.query(RetakeRequest)
    if status_filter:
        query = query.filter(RetakeRequest.status == status_filter)
    requests = query.order_by(RetakeRequest.created_at.desc(), RetakeRequest.id.desc()).limit(200).all()
    return [_retake_out(request) for request in requests]
