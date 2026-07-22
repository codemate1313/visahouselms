import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.attempt import ATTEMPT_GRADED, AttemptPartGrade, TestAttempt
from app.models.notification import GRADE_RELEASED, StudentNotification
from app.models.user import User
from app.services import smtp_service

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _utc_out(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _grade_notification(attempt: TestAttempt) -> StudentNotification:
    return StudentNotification(
        user_id=attempt.user_id,
        attempt_id=attempt.id,
        kind=GRADE_RELEASED,
        title=f'{attempt.module.title} has been graded',
        message=(
            "Your instructor has completed this assessment. Review your score, "
            "rubric feedback, and detailed analysis."
        ),
        created_at=attempt.graded_at or _now(),
    )


def create_grade_released_notification(db: Session, attempt: TestAttempt) -> StudentNotification:
    existing = (
        db.query(StudentNotification)
        .filter(
            StudentNotification.attempt_id == attempt.id,
            StudentNotification.kind == GRADE_RELEASED,
        )
        .first()
    )
    if existing is not None:
        return existing

    notification = _grade_notification(attempt)
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def _backfill_grade_notifications(db: Session, user: User) -> None:
    existing_attempt_ids = {
        attempt_id
        for (attempt_id,) in (
            db.query(StudentNotification.attempt_id)
            .filter(
                StudentNotification.user_id == user.id,
                StudentNotification.kind == GRADE_RELEASED,
                StudentNotification.attempt_id.is_not(None),
            )
            .all()
        )
    }
    query = (
        db.query(TestAttempt)
        .join(AttemptPartGrade, AttemptPartGrade.attempt_id == TestAttempt.id)
        .options(joinedload(TestAttempt.module))
        .filter(
            TestAttempt.user_id == user.id,
            TestAttempt.status == ATTEMPT_GRADED,
            AttemptPartGrade.grader_id.is_not(None),
        )
    )
    if existing_attempt_ids:
        query = query.filter(~TestAttempt.id.in_(existing_attempt_ids))
    attempts = query.distinct().all()
    if not attempts:
        return
    db.add_all([_grade_notification(attempt) for attempt in attempts])
    db.commit()


def _notification_out(notification: StudentNotification) -> dict:
    attempt = notification.attempt
    return {
        "id": notification.id,
        "kind": notification.kind,
        "attempt_id": notification.attempt_id,
        "title": notification.title,
        "message": notification.message,
        "read_at": _utc_out(notification.read_at),
        "created_at": _utc_out(notification.created_at),
        "module_title": attempt.module.title if attempt is not None else None,
        "module_type": attempt.module.module_type if attempt is not None else None,
        "raw_score": str(attempt.raw_score) if attempt is not None and attempt.raw_score is not None else None,
        "max_score": str(attempt.max_score) if attempt is not None and attempt.max_score is not None else None,
        "band_label": attempt.band_label if attempt is not None else None,
        "cefr_level": attempt.cefr_level if attempt is not None else None,
    }


def list_student_notifications(db: Session, user: User) -> list[dict]:
    _backfill_grade_notifications(db, user)
    notifications = (
        db.query(StudentNotification)
        .options(joinedload(StudentNotification.attempt).joinedload(TestAttempt.module))
        .filter(StudentNotification.user_id == user.id)
        .order_by(StudentNotification.created_at.desc(), StudentNotification.id.desc())
        .limit(50)
        .all()
    )
    return [_notification_out(notification) for notification in notifications]


def mark_notification_read(db: Session, user: User, notification_id: int) -> dict:
    notification = (
        db.query(StudentNotification)
        .options(joinedload(StudentNotification.attempt).joinedload(TestAttempt.module))
        .filter(StudentNotification.id == notification_id, StudentNotification.user_id == user.id)
        .first()
    )
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    if notification.read_at is None:
        notification.read_at = _now()
        db.add(notification)
        db.commit()
        db.refresh(notification)
    return _notification_out(notification)


def mark_all_notifications_read(db: Session, user: User) -> int:
    unread = (
        db.query(StudentNotification)
        .filter(StudentNotification.user_id == user.id, StudentNotification.read_at.is_(None))
        .all()
    )
    if not unread:
        return 0
    read_at = _now()
    for notification in unread:
        notification.read_at = read_at
        db.add(notification)
    db.commit()
    return len(unread)


def send_grade_released_email(db: Session, attempt: TestAttempt) -> None:
    """Best-effort notification once a Writing/Speaking submission is fully
    graded - failure (unconfigured SMTP, network error, ...) is logged and
    never raised, so it can never block the grading response the instructor
    is waiting on."""
    try:
        user = attempt.user
        module = attempt.module
        lines = [
            f"Hi {user.first_name},",
            "",
            f'Your submission for "{module.title}" has been graded.',
        ]
        if attempt.max_score is not None:
            lines.append(f"Score: {attempt.raw_score} / {attempt.max_score}")
        if attempt.band_label:
            lines.append(f"Band: {attempt.band_label}")
        lines += ["", "Log in to the student portal to see the full breakdown."]
        smtp_service.send_email(db, user.email, f'Your "{module.title}" result is ready', "\n".join(lines))
    except Exception:
        logger.exception("Failed to send grade-released email for attempt %s", attempt.id)
