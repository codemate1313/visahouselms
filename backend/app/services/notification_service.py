import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core import actor_context
from app.models.attempt import ATTEMPT_GRADED, AttemptPartGrade, RetakeRequest, TestAttempt
from app.models.notification import (
    AI_EVALUATION_FAILED,
    GRADE_RELEASED,
    GRADING_CLAIMED,
    GRADING_QUEUE_ROUTED,
    GRADING_RELEASED,
    REEVALUATION_CLAIMED,
    REEVALUATION_REQUESTED,
    REEVALUATION_RESOLVED,
    RETAKE_REQUESTED,
    RETAKE_RESOLVED,
    SUPPORT_TICKET_ASSIGNED,
    SYSTEM_JOB_FAILED,
    SYSTEM_SECURITY_EVENT,
    StudentNotification,
)
from app.models.role import DEVELOPER, INST_INSTRUCTOR, INSTITUTE_ADMIN, SA_INSTRUCTOR, STUDENT, SUPER_ADMIN, Role
from app.models.user import User
from app.services import fcm_service, smtp_service

logger = logging.getLogger(__name__)

NOTIFICATION_POLICY: dict[str, dict[str, set[str]]] = {
    "grading_queue_routed": {
        "institute": {INSTITUTE_ADMIN, INST_INSTRUCTOR},
        "direct": {SA_INSTRUCTOR},
        "sa_fallback": {SUPER_ADMIN, SA_INSTRUCTOR},
    },
    "ai_evaluation_failed": {
        "student": {STUDENT},
        "institute": {INSTITUTE_ADMIN, INST_INSTRUCTOR},
        "direct": {SA_INSTRUCTOR},
        "platform": {SUPER_ADMIN, DEVELOPER},
    },
    "reevaluation_requested": {
        "student": {STUDENT},
        "institute": {INSTITUTE_ADMIN, INST_INSTRUCTOR},
        "direct": {SA_INSTRUCTOR},
    },
}


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
        if smtp_service.is_configuration_error(exc):
            logger.info("Notification email skipped because SMTP is not configured")
            return
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
    # A developer's actions notify no one. This is the single choke point every
    # in-app notification passes through - notify_roles and notify_users both
    # land here, as do the direct callers - so guarding it once keeps the
    # developer layer invisible without threading the actor through every caller.
    # A transient, unsaved row is returned so callers that collect the result
    # keep working; nothing is persisted and no push is sent.
    if actor_context.is_developer_action():
        return StudentNotification(
            user_id=user_id,
            attempt_id=attempt_id,
            kind=kind,
            title=title,
            message=message,
            link_url=link_url,
            created_at=_now(),
        )
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
        return "/institute-instructor/dashboard"
    if role_name == SA_INSTRUCTOR:
        return "/super-admin/instructor/grading"
    if role_name == INSTITUTE_ADMIN:
        return "/institute-portal/dashboard"
    return "/super-admin/grading"


def _attempt_audience(event: str, attempt: TestAttempt, routing_reason: Optional[str] = None) -> tuple[set[str], Optional[int]]:
    policy = NOTIFICATION_POLICY[event]
    if routing_reason == "sa_fallback":
        return policy["sa_fallback"], None
    if attempt.user.institute_id is not None:
        return policy["institute"], attempt.user.institute_id
    return policy["direct"], None


def notify_grading_queue_routed(db: Session, attempt: TestAttempt, routing_reason: Optional[str]) -> None:
    title = f"New submission needs grading: {attempt.module.title}"
    message = f"{_student_name(attempt)} submitted {attempt.module.title} for instructor review."
    roles, institute_id = _attempt_audience("grading_queue_routed", attempt, routing_reason)
    for role_name in roles:
        notify_roles(
            db,
            {role_name},
            kind=GRADING_QUEUE_ROUTED,
            title="Institute student submitted a test" if role_name == INSTITUTE_ADMIN else title,
            message=message,
            link_url=_grading_link_for_role(role_name),
            institute_id=institute_id,
        )


def notify_ai_evaluation_failed(db: Session, attempt: TestAttempt) -> None:
    title = f"AI evaluation failed: {attempt.module.title}"
    message = f"{_student_name(attempt)}'s result needs manual instructor review because AI evaluation failed."
    if STUDENT in NOTIFICATION_POLICY["ai_evaluation_failed"]["student"]:
        create_notification(
            db,
            user_id=attempt.user_id,
            kind=AI_EVALUATION_FAILED,
            title="AI evaluation needs manual review",
            message="Automatic AI evaluation could not complete. Your submission remains in instructor review.",
            link_url=f"/student/attempts/{attempt.id}/result/details",
        )
    roles, institute_id = _attempt_audience("ai_evaluation_failed", attempt)
    for role_name in roles:
        notify_roles(
            db,
            {role_name},
            kind=AI_EVALUATION_FAILED,
            title=title,
            message=message,
            link_url=_grading_link_for_role(role_name),
            institute_id=institute_id,
        )
    notify_roles(
        db,
        NOTIFICATION_POLICY["ai_evaluation_failed"]["platform"],
        kind=AI_EVALUATION_FAILED,
        title=title,
        message="Check AI provider configuration and failed ai_evaluations rows.",
        link_url="/super-admin/platform-settings?tab=ai",
    )


def notify_grading_claimed(db: Session, attempt: TestAttempt, actor: User) -> None:
    create_notification(
        db,
        user_id=attempt.user_id,
        kind=GRADING_CLAIMED,
        title=f"Review started: {attempt.module.title}",
        message=f"{actor.first_name} {actor.last_name} has started reviewing your submission.",
        link_url=f"/student/attempts/{attempt.id}/result/details",
        attempt_id=attempt.id,
    )


def notify_grading_released(db: Session, attempt: TestAttempt) -> None:
    create_notification(
        db,
        user_id=attempt.user_id,
        kind=GRADING_RELEASED,
        title=f"Review returned to queue: {attempt.module.title}",
        message="Your submission is waiting for another instructor to continue the review.",
        link_url=f"/student/attempts/{attempt.id}/result/details",
        attempt_id=attempt.id,
    )


def notify_reevaluation_requested(db: Session, attempt: TestAttempt) -> None:
    title = f"Human review requested: {attempt.module.title}"
    message = f"{_student_name(attempt)} requested instructor review after the result was released."
    if STUDENT in NOTIFICATION_POLICY["reevaluation_requested"]["student"]:
        create_notification(
            db,
            user_id=attempt.user_id,
            kind=REEVALUATION_REQUESTED,
            title="Human review request submitted",
            message="Your request has been sent to the appropriate instructor queue.",
            link_url=f"/student/attempts/{attempt.id}/result/details",
            attempt_id=attempt.id,
        )
    roles, institute_id = _attempt_audience("reevaluation_requested", attempt)
    for role_name in roles:
        notify_roles(
            db,
            {role_name},
            kind=REEVALUATION_REQUESTED,
            title=title,
            message=message,
            link_url=_grading_link_for_role(role_name),
            institute_id=institute_id,
        )


def notify_reevaluation_claimed(db: Session, attempt: TestAttempt, actor: User) -> None:
    create_notification(
        db,
        user_id=attempt.user_id,
        kind=REEVALUATION_CLAIMED,
        title=f"Human review in progress: {attempt.module.title}",
        message=f"{actor.first_name} {actor.last_name} is reviewing your request.",
        link_url=f"/student/attempts/{attempt.id}/result/details",
        attempt_id=attempt.id,
    )


def notify_reevaluation_resolved(db: Session, attempt: TestAttempt, resolution: str) -> None:
    create_notification(
        db,
        user_id=attempt.user_id,
        kind=REEVALUATION_RESOLVED,
        title=f"Human review {resolution}: {attempt.module.title}",
        message="Your instructor has completed the requested review.",
        link_url=f"/student/attempts/{attempt.id}/result/details",
        attempt_id=attempt.id,
    )


def notify_retake_requested(db: Session, request: RetakeRequest) -> None:
    attempt = request.attempt
    student_name = f"{request.student.first_name} {request.student.last_name}".strip() or request.student.email
    create_notification(
        db,
        user_id=request.student_id,
        kind=RETAKE_REQUESTED,
        title="Retake request submitted",
        message="Your retake request has been sent to the Super Admin for review.",
        link_url=f"/student/attempts/{attempt.id}/result/details",
        attempt_id=attempt.id,
    )
    notify_roles(
        db,
        {SUPER_ADMIN},
        kind=RETAKE_REQUESTED,
        title=f"Retake request: {attempt.module.title}",
        message=f"{student_name} requested a retake after their attempt.",
        link_url="/super-admin/retake-requests",
    )


def notify_retake_resolved(db: Session, request: RetakeRequest) -> None:
    attempt = request.attempt
    create_notification(
        db,
        user_id=request.student_id,
        kind=RETAKE_RESOLVED,
        title=f"Retake request {request.status}: {attempt.module.title}",
        message=(
            "Your retake has been approved - you can start a new attempt from the module."
            if request.status == "approved"
            else "Your retake request was not approved."
        ),
        link_url=f"/student/attempts/{attempt.id}/result/details",
        attempt_id=attempt.id,
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
        .filter(
            StudentNotification.user_id == user.id,
            StudentNotification.kind != GRADING_CLAIMED,
        )
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
        if smtp_service.is_configuration_error(exc):
            logger.info("Grade-released email skipped because SMTP is not configured")
            return
        logger.exception("Failed to send grade-released email for attempt %s", attempt.id)
        record_send_failure(
            db,
            f"Grade-released email failed for attempt {attempt.id} ({attempt.user.email}): {exc}",
            user_id=attempt.user_id,
        )
