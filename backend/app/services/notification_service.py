import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.attempt import ATTEMPT_GRADED, AttemptPartGrade, TestAttempt
from app.models.notification import GRADE_RELEASED, StudentNotification
from app.models.role import STUDENT
from app.models.user import User
from app.services import fcm_service, smtp_service

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
        link_url=f"/student/attempts/{attempt.id}/result/details",
        created_at=attempt.graded_at or _now(),
    )


def push_to_user(db: Session, user_id: int, title: str, body: str, link_url: Optional[str] = None) -> None:
    """Best-effort FCM push for a single user. No-ops quietly when FCM isn't
    configured (that's an intentional admin choice, not a failure); an actual
    send error is logged and recorded so it doesn't vanish silently."""
    if not fcm_service.get_config_status(db).get("configured"):
        return
    try:
        fcm_service.send_to_user(db, user_id, title, body, link_url=link_url)
    except Exception as exc:
        logger.exception("Failed to push notification to user %s", user_id)
        record_send_failure(db, f"Push notification failed for user {user_id}: {exc}", user_id=user_id)


def send_notification_email(db: Session, to_address: str, subject: str, body: str, *, user_id: Optional[int] = None) -> None:
    """Best-effort email send shared by non-grading notification producers
    (support tickets, etc.) - mirrors send_grade_released_email's failure handling."""
    try:
        smtp_service.send_email(db, to_address, subject, body)
    except Exception as exc:
        logger.exception("Failed to send notification email to %s", to_address)
        record_send_failure(db, f"Notification email to {to_address} failed: {exc}", user_id=user_id)


def create_notification(
    db: Session,
    *,
    user_id: int,
    kind: str,
    title: str,
    message: str,
    link_url: Optional[str] = None,
    push: bool = True,
) -> StudentNotification:
    """Generic in-app notification creator for producers outside grading/announcements
    (e.g. support tickets). Also attempts a best-effort push to the same user."""
    notification = StudentNotification(
        user_id=user_id,
        kind=kind,
        title=title,
        message=message,
        link_url=link_url,
        created_at=_now(),
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    if push:
        push_to_user(db, user_id, title, message, link_url=link_url)
    return notification


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
    push_to_user(db, notification.user_id, notification.title, notification.message, link_url=notification.link_url)
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
        "announcement_id": notification.announcement_id,
        "link_url": notification.link_url,
        "title": notification.title,
        "message": notification.message,
        "read_at": _utc_out(notification.read_at),
        "pinned_at": _utc_out(notification.pinned_at),
        "created_at": _utc_out(notification.created_at),
        "module_title": attempt.module.title if attempt is not None else None,
        "module_type": attempt.module.module_type if attempt is not None else None,
        "raw_score": str(attempt.raw_score) if attempt is not None and attempt.raw_score is not None else None,
        "max_score": str(attempt.max_score) if attempt is not None and attempt.max_score is not None else None,
        "band_label": attempt.band_label if attempt is not None else None,
        "cefr_level": attempt.cefr_level if attempt is not None else None,
    }


def list_user_notifications(db: Session, user: User) -> list[dict]:
    if user.role.name == STUDENT:
        _backfill_grade_notifications(db, user)
    notifications = (
        db.query(StudentNotification)
        .options(joinedload(StudentNotification.attempt).joinedload(TestAttempt.module))
        .filter(StudentNotification.user_id == user.id)
        # Pinned first (most recently pinned on top), then the usual newest-first feed.
        .order_by(
            StudentNotification.pinned_at.is_(None).asc(),
            StudentNotification.pinned_at.desc(),
            StudentNotification.created_at.desc(),
            StudentNotification.id.desc(),
        )
        .limit(50)
        .all()
    )
    return [_notification_out(notification) for notification in notifications]


def list_student_notifications(db: Session, user: User) -> list[dict]:
    return list_user_notifications(db, user)


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


def set_notification_pinned(db: Session, user: User, notification_id: int, pinned: bool) -> dict:
    """Pin/unpin a notification so it sticks to the top of the user's inbox."""
    notification = (
        db.query(StudentNotification)
        .options(joinedload(StudentNotification.attempt).joinedload(TestAttempt.module))
        .filter(StudentNotification.id == notification_id, StudentNotification.user_id == user.id)
        .first()
    )
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    desired = _now() if pinned else None
    if (notification.pinned_at is not None) != pinned:
        notification.pinned_at = desired
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


def record_send_failure(db: Session, message: str, *, user_id: Optional[int] = None) -> None:
    """Surface a swallowed notification-send failure in the admin-visible Logs UI.

    Outbound sends (email/push) are best-effort and must never raise into the
    caller, so without this they fail completely silently - an admin has no way
    to discover that "configured" notifications have stopped going out."""
    try:
        from app.services.log_service import record_error

        record_error(
            db,
            message=message,
            stack_trace=None,
            path=None,
            method=None,
            user_id=user_id,
            ip_address=None,
            level="WARNING",
        )
    except Exception:
        logger.exception("Failed to record notification-send failure to ErrorLog")


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
    except Exception as exc:
        logger.exception("Failed to send grade-released email for attempt %s", attempt.id)
        record_send_failure(
            db,
            f"Grade-released email failed for attempt {attempt.id} ({attempt.user.email}): {exc}",
            user_id=attempt.user_id,
        )
