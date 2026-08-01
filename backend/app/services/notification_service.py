import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.attempt import ATTEMPT_GRADED, AttemptPartGrade, TestAttempt
from app.models.notification import (
    AI_EVALUATION_FAILED,
    GRADE_RELEASED,
    GRADING_CLAIMED,
    GRADING_QUEUE_ROUTED,
    GRADING_RELEASED,
    REEVALUATION_CLAIMED,
    REEVALUATION_REQUESTED,
    REEVALUATION_RESOLVED,
    SUPPORT_TICKET_ASSIGNED,
    SYSTEM_JOB_FAILED,
    SYSTEM_SECURITY_EVENT,
    StudentNotification,
)
from app.models.role import DEVELOPER, INST_INSTRUCTOR, INSTITUTE_ADMIN, SA_INSTRUCTOR, STUDENT, SUPER_ADMIN, Role
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
    attempt_id: Optional[int] = None,
    push: bool = True,
) -> StudentNotification:
    """Generic in-app notification creator for producers outside grading/announcements
    (e.g. support tickets). Also attempts a best-effort push to the same user."""
    if attempt_id is not None:
        existing = (
            db.query(StudentNotification)
            .filter(
                StudentNotification.attempt_id == attempt_id,
                StudentNotification.kind == kind,
            )
            .first()
        )
        if existing is not None:
            return existing
    notification = StudentNotification(
        user_id=user_id,
        attempt_id=attempt_id,
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


def active_users_for_roles(
    db: Session,
    role_names: set[str],
    *,
    institute_id: Optional[int] = None,
) -> list[User]:
    query = (
        db.query(User)
        .join(User.role)
        .filter(
            User.deleted_at.is_(None),
            User.is_active.is_(True),
            Role.name.in_(role_names),
        )
    )
    if institute_id is not None:
        query = query.filter(User.institute_id == institute_id)
    return query.all()


def notify_users(
    db: Session,
    users: list[User],
    *,
    kind: str,
    title: str,
    message: str,
    link_url: Optional[str] = None,
    attempt_id: Optional[int] = None,
) -> list[StudentNotification]:
    notifications: list[StudentNotification] = []
    seen: set[int] = set()
    for user in users:
        if user.id in seen:
            continue
        seen.add(user.id)
        notifications.append(
            create_notification(
                db,
                user_id=user.id,
                kind=kind,
                title=title,
                message=message,
                link_url=link_url,
                attempt_id=attempt_id,
            )
        )
    return notifications


def notify_roles(
    db: Session,
    role_names: set[str],
    *,
    kind: str,
    title: str,
    message: str,
    link_url: Optional[str] = None,
    institute_id: Optional[int] = None,
    attempt_id: Optional[int] = None,
) -> list[StudentNotification]:
    return notify_users(
        db,
        active_users_for_roles(db, role_names, institute_id=institute_id),
        kind=kind,
        title=title,
        message=message,
        link_url=link_url,
        attempt_id=attempt_id,
    )


def _student_name(attempt: TestAttempt) -> str:
    return f"{attempt.user.first_name} {attempt.user.last_name}".strip() or attempt.user.email


def _grading_link_for_role(role_name: str) -> str:
    if role_name == INST_INSTRUCTOR:
        return "/institute-instructor/grading"
    if role_name == SA_INSTRUCTOR:
        return "/super-admin/instructor/grading"
    if role_name == INSTITUTE_ADMIN:
        return "/institute-portal/dashboard"
    return "/super-admin/grading"


def notify_grading_queue_routed(db: Session, attempt: TestAttempt, routing_reason: Optional[str]) -> None:
    title = f"New submission needs grading: {attempt.module.title}"
    message = f"{_student_name(attempt)} submitted {attempt.module.title} for instructor review."
    if attempt.user.institute_id is not None and routing_reason != "sa_fallback":
        notify_roles(
            db,
            {INST_INSTRUCTOR},
            kind=GRADING_QUEUE_ROUTED,
            title=title,
            message=message,
            link_url="/institute-instructor/grading",
            institute_id=attempt.user.institute_id,
        )
        notify_roles(
            db,
            {INSTITUTE_ADMIN},
            kind=GRADING_QUEUE_ROUTED,
            title="Institute student submitted a test",
            message=message,
            link_url="/institute-portal/dashboard",
            institute_id=attempt.user.institute_id,
        )
        return
    notify_roles(
        db,
        {SA_INSTRUCTOR},
        kind=GRADING_QUEUE_ROUTED,
        title=title,
        message=message,
        link_url="/super-admin/instructor/grading",
    )
    if routing_reason == "sa_fallback":
        notify_roles(
            db,
            {SUPER_ADMIN},
            kind=GRADING_QUEUE_ROUTED,
            title="Institute grading routed to SA fallback",
            message=message,
            link_url="/super-admin/grading",
        )


def notify_ai_evaluation_failed(db: Session, attempt: TestAttempt) -> None:
    title = f"AI evaluation failed: {attempt.module.title}"
    message = f"{_student_name(attempt)}'s result needs manual instructor review because AI evaluation failed."
    create_notification(
        db,
        user_id=attempt.user_id,
        kind=AI_EVALUATION_FAILED,
        title="AI evaluation needs manual review",
        message="Automatic AI evaluation could not complete. Your submission remains in instructor review.",
        link_url=f"/student/attempts/{attempt.id}/result/details",
    )
    if attempt.user.institute_id is not None:
        notify_roles(
            db,
            {INSTITUTE_ADMIN},
            kind=AI_EVALUATION_FAILED,
            title=title,
            message=message,
            link_url="/institute-portal/dashboard",
            institute_id=attempt.user.institute_id,
        )
        notify_roles(
            db,
            {INST_INSTRUCTOR},
            kind=AI_EVALUATION_FAILED,
            title=title,
            message=message,
            link_url="/institute-instructor/grading",
            institute_id=attempt.user.institute_id,
        )
    else:
        notify_roles(
            db,
            {SA_INSTRUCTOR},
            kind=AI_EVALUATION_FAILED,
            title=title,
            message=message,
            link_url="/super-admin/instructor/grading",
        )
    notify_roles(
        db,
        {SUPER_ADMIN, DEVELOPER},
        kind=AI_EVALUATION_FAILED,
        title=title,
        message="Check AI provider configuration and failed ai_evaluations rows.",
        link_url="/super-admin/dev-settings",
    )


def notify_grading_claimed(db: Session, attempt: TestAttempt, actor: User) -> None:
    create_notification(
        db,
        user_id=attempt.user_id,
        kind=GRADING_CLAIMED,
        title=f"Review started: {attempt.module.title}",
        message=f"{actor.first_name} {actor.last_name} has started reviewing your submission.",
        link_url=f"/student/attempts/{attempt.id}/result/details",
    )


def notify_grading_released(db: Session, attempt: TestAttempt) -> None:
    create_notification(
        db,
        user_id=attempt.user_id,
        kind=GRADING_RELEASED,
        title=f"Review returned to queue: {attempt.module.title}",
        message="Your submission is waiting for another instructor to continue the review.",
        link_url=f"/student/attempts/{attempt.id}/result/details",
    )


def notify_reevaluation_requested(db: Session, attempt: TestAttempt) -> None:
    title = f"Human review requested: {attempt.module.title}"
    message = f"{_student_name(attempt)} requested instructor review after the result was released."
    create_notification(
        db,
        user_id=attempt.user_id,
        kind=REEVALUATION_REQUESTED,
        title="Human review request submitted",
        message="Your request has been sent to the appropriate instructor queue.",
        link_url=f"/student/attempts/{attempt.id}/result/details",
    )
    if attempt.user.institute_id is not None:
        notify_roles(
            db,
            {INSTITUTE_ADMIN, INST_INSTRUCTOR},
            kind=REEVALUATION_REQUESTED,
            title=title,
            message=message,
            link_url="/institute-instructor/grading",
            institute_id=attempt.user.institute_id,
        )
    else:
        notify_roles(
            db,
            {SA_INSTRUCTOR},
            kind=REEVALUATION_REQUESTED,
            title=title,
            message=message,
            link_url="/super-admin/instructor/grading",
        )


def notify_reevaluation_claimed(db: Session, attempt: TestAttempt, actor: User) -> None:
    create_notification(
        db,
        user_id=attempt.user_id,
        kind=REEVALUATION_CLAIMED,
        title=f"Human review in progress: {attempt.module.title}",
        message=f"{actor.first_name} {actor.last_name} is reviewing your request.",
        link_url=f"/student/attempts/{attempt.id}/result/details",
    )


def notify_reevaluation_resolved(db: Session, attempt: TestAttempt, resolution: str) -> None:
    create_notification(
        db,
        user_id=attempt.user_id,
        kind=REEVALUATION_RESOLVED,
        title=f"Human review {resolution}: {attempt.module.title}",
        message="Your instructor has completed the requested review.",
        link_url=f"/student/attempts/{attempt.id}/result/details",
    )


def notify_system_job_failed(db: Session, job_type: str, detail: str) -> None:
    notify_roles(
        db,
        {DEVELOPER, SUPER_ADMIN},
        kind=SYSTEM_JOB_FAILED,
        title=f"System job failed: {job_type}",
        message=detail[:500],
        link_url="/super-admin/logs",
    )


def notify_security_event(db: Session, title: str, message: str, *, link_url: str = "/super-admin/logs") -> None:
    notify_roles(
        db,
        {DEVELOPER, SUPER_ADMIN},
        kind=SYSTEM_SECURITY_EVENT,
        title=title,
        message=message,
        link_url=link_url,
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
