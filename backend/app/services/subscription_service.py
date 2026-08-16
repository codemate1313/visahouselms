from datetime import datetime, timedelta, timezone
from math import ceil
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.models.audit_log import AuditLog
from app.models.exam_module import ExamModule, InstituteModule
from app.models.institute import Institute
from app.models.plan import AUDIENCE_DIRECT, AUDIENCE_INSTITUTES, Plan
from app.models.role import DEVELOPER, INSTITUTE_ADMIN, INST_INSTRUCTOR, STUDENT, SUPER_ADMIN, Role
from app.models.subscription import Subscription
from app.models.user import User
from app.services.plan_service import assert_audience, get_plan_or_404

STATE_NONE = "none"
STATE_ACTIVE = "active"
STATE_GRACE = "grace"
STATE_EXPIRED = "expired"
# A term bought before the running one ends starts at that expiry, so it sits
# in the future. It is not access yet - only the term covering *now* is.
STATE_SCHEDULED = "scheduled"
STATE_CANCELLED = "cancelled"

# stamped on the audit row when the expiry sweep suspends an institute, so a
# later renewal can tell its own suspension apart from a manual Super Admin one
SUSPENSION_REASON = "subscription_expired"


def _audit(db: Session, actor: User, action: str, entity_id: Optional[int], ip: Optional[str], details=None) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            action=action,
            entity_type="subscription",
            entity_id=entity_id,
            details=details,
            ip_address=ip,
        )
    )


def _now() -> datetime:
    # DB stores naive UTC datetimes (existing convention across the app)
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _dev_unlimited_speaking_attempts(db: Session, module: ExamModule) -> bool:
    if settings.app_environment != "development" or module.module_type != "speaking":
        return False
    try:
        from app.services import settings_service

        value = settings_service.get_setting(db, "dev.unlimited_speaking_attempts")
    except Exception:
        return False
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def get_institute_or_404(db: Session, institute_id: int) -> Institute:
    institute = db.get(Institute, institute_id)
    if institute is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institute not found")
    return institute


def _state_of(subscription: Subscription, now: datetime) -> str:
    """The one place a stored row is turned into a lifecycle state, so every
    screen that shows a term agrees about what it is."""
    if subscription.cancelled_at is not None:
        return STATE_CANCELLED
    if now < subscription.starts_at:
        return STATE_SCHEDULED
    if now < subscription.expires_at:
        return STATE_ACTIVE
    if now < subscription.expires_at + timedelta(days=subscription.grace_days):
        return STATE_GRACE
    return STATE_EXPIRED


def state_of_subscription(subscription: Subscription) -> str:
    return _state_of(subscription, _now())


def _pick_current(rows: List[Subscription], now: datetime) -> Tuple[Optional[Subscription], str]:
    """The term that governs access right now. Renewing early leaves two open
    rows, so "latest expiry" is not the answer - the one that has actually
    started is, and only if none has does a scheduled term stand in."""
    started = [row for row in rows if row.starts_at <= now]
    if started:
        current = max(started, key=lambda row: row.expires_at)
    elif rows:
        current = min(rows, key=lambda row: row.starts_at)
    else:
        return None, STATE_NONE
    return current, _state_of(current, now)


def current_subscription(db: Session, institute_id: int) -> Tuple[Optional[Subscription], str]:
    """The institute's governing subscription and its derived state."""
    rows = (
        db.query(Subscription)
        .options(joinedload(Subscription.plan))
        .filter(Subscription.institute_id == institute_id, Subscription.cancelled_at.is_(None))
        .all()
    )
    return _pick_current(rows, _now())


def current_subscription_map(
    db: Session, institute_ids: List[int]
) -> dict[int, Tuple[Optional[Subscription], str]]:
    """`current_subscription` for many institutes in one query.

    Lets a list endpoint resolve every institute's subscription state without a
    query per row. The picking is the same pure-Python `_pick_current`; only the
    fetch is batched.
    """
    if not institute_ids:
        return {}
    now = _now()
    rows = (
        db.query(Subscription)
        .options(joinedload(Subscription.plan))
        .filter(Subscription.institute_id.in_(institute_ids), Subscription.cancelled_at.is_(None))
        .all()
    )
    grouped: dict[int, List[Subscription]] = {}
    for row in rows:
        grouped.setdefault(row.institute_id, []).append(row)
    return {iid: _pick_current(grouped.get(iid, []), now) for iid in institute_ids}


def current_user_subscription(db: Session, user_id: int) -> Tuple[Optional[Subscription], str]:
    """Personal (B2C direct-student) mirror of current_subscription - the
    governing subscription owned by this user (not an institute)."""
    rows = (
        db.query(Subscription)
        .options(joinedload(Subscription.plan).joinedload(Plan.modules))
        .filter(Subscription.user_id == user_id, Subscription.cancelled_at.is_(None))
        .all()
    )
    return _pick_current(rows, _now())


def _access_ends_at(subscription: Subscription) -> datetime:
    """The hard cut-off: grace days are still full access, so the institute and
    every account under it only lose access once grace has run out too."""
    return subscription.expires_at + timedelta(days=subscription.grace_days)


def access_window(db: Session, institute_id: int) -> dict:
    """Countdown payload for the institute admin dashboard deadline card. Always
    returned (unlike subscription_status, which is gated on view_billing) because
    losing access affects every account in the institute, not just billing."""
    institute = db.get(Institute, institute_id)
    suspended = institute is not None and not institute.is_active
    subscription, state = current_subscription(db, institute_id)
    if subscription is None:
        return {
            "state": state,
            "plan_name": None,
            "expires_at": None,
            "grace_days": 0,
            "access_ends_at": None,
            "seconds_remaining": None,
            "seconds_to_expiry": None,
            "institute_suspended": suspended,
        }

    now = _now()
    access_ends_at = _access_ends_at(subscription)
    return {
        "state": state,
        "plan_name": subscription.plan.name if subscription.plan else None,
        "expires_at": subscription.expires_at,
        "grace_days": subscription.grace_days,
        "access_ends_at": access_ends_at,
        "seconds_remaining": max(0, int((access_ends_at - now).total_seconds())),
        "seconds_to_expiry": max(0, int((subscription.expires_at - now).total_seconds())),
        "institute_suspended": suspended,
    }


def suspend_expired_institutes(db: Session) -> int:
    """Called from the job_service scheduler tick: once an institute's plan is
    past expiry *and* its grace window, the institute is suspended - which is
    what already blocks login for every downline account (admin, instructors and
    students all carry institute_id, and auth_service refuses a login whose
    institute is inactive). Live sessions are revoked too so access stops at the
    deadline instead of at the next token expiry."""
    from app.services import account_service, notification_service

    institutes = db.query(Institute).filter(Institute.is_active.is_(True)).all()
    suspended = 0
    suspended_institutes: list[Institute] = []
    for institute in institutes:
        subscription, state = current_subscription(db, institute.id)
        if subscription is None or state != STATE_EXPIRED:
            continue

        institute.is_active = False
        db.add(institute)
        member_ids = [
            user_id
            for (user_id,) in db.query(User.id).filter(User.institute_id == institute.id).all()
        ]
        for user_id in member_ids:
            account_service.revoke_all_sessions(db, user_id)
        db.add(
            AuditLog(
                user_id=None,
                action="institute.suspend",
                entity_type="institute",
                entity_id=institute.id,
                details={
                    "reason": SUSPENSION_REASON,
                    "subscription_id": subscription.id,
                    "access_ended_at": _access_ends_at(subscription).isoformat(),
                    "accounts_disabled": len(member_ids),
                },
                ip_address=None,
            )
        )
        suspended += 1
        suspended_institutes.append(institute)

    if suspended:
        db.commit()
        for institute in suspended_institutes:
            notification_service.notify_roles(
                db,
                {SUPER_ADMIN, DEVELOPER},
                kind="subscription_expired",
                title="Institute subscription expired",
                message=f"{institute.name} was suspended after its subscription and grace period ended.",
                link_url="/super-admin/subscriptions",
            )
            notification_service.notify_roles(
                db,
                {INSTITUTE_ADMIN},
                kind="subscription_expired",
                title="Subscription expired",
                message=f"{institute.name} access was suspended after the grace period ended.",
                link_url="/institute-portal/billing",
                institute_id=institute.id,
            )
    return suspended


def _reactivate_if_expiry_suspended(db: Session, institute: Institute) -> bool:
    """Undo an automatic expiry suspension when a plan is assigned or renewed.
    A suspension the Super Admin applied by hand is left alone - only the sweep's
    own suspension (the newest activity on the institute) is reversed."""
    if institute.is_active:
        return False

    last = (
        db.query(AuditLog)
        .filter(
            AuditLog.entity_type == "institute",
            AuditLog.entity_id == institute.id,
            AuditLog.action.in_(["institute.suspend", "institute.reactivate"]),
        )
        .order_by(AuditLog.id.desc())
        .first()
    )
    if last is None or last.action != "institute.suspend":
        return False
    if not isinstance(last.details, dict) or last.details.get("reason") != SUSPENSION_REASON:
        return False

    institute.is_active = True
    db.add(institute)
    db.add(
        AuditLog(
            user_id=None,
            action="institute.reactivate",
            entity_type="institute",
            entity_id=institute.id,
            details={"reason": "subscription_renewed"},
            ip_address=None,
        )
    )
    return True


def usage(db: Session, institute_id: int) -> dict:
    role_ids = {
        role.name: role.id
        for role in db.query(Role).filter(Role.name.in_([STUDENT, INST_INSTRUCTOR])).all()
    }
    students = (
        db.query(User)
        .filter(
            User.institute_id == institute_id,
            User.role_id == role_ids.get(STUDENT, -1),
            User.deleted_at.is_(None),
        )
        .count()
    )
    staff = (
        db.query(User)
        .filter(
            User.institute_id == institute_id,
            User.role_id == role_ids.get(INST_INSTRUCTOR, -1),
            User.deleted_at.is_(None),
        )
        .count()
    )
    from app.models.attempt import TestAttempt

    tests = (
        db.query(TestAttempt)
        .join(User, TestAttempt.user_id == User.id)
        .filter(User.institute_id == institute_id)
        .count()
    )
    courses = (
        db.query(InstituteModule)
        .join(ExamModule, InstituteModule.module_id == ExamModule.id)
        .filter(
            InstituteModule.institute_id == institute_id,
            InstituteModule.is_active.is_(True),
            ExamModule.deleted_at.is_(None),
        )
        .count()
    )
    return {"students": students, "staff": staff, "tests": tests, "courses": courses}


def days_until(deadline: datetime, now: Optional[datetime] = None) -> int:
    """Whole days a countdown should show. Rounded up, so a 30-day term reads
    "30 days left" on the day it is granted and "1" on its final day - a
    truncating subtraction loses a day at both ends and makes a fresh
    agreement look like it was issued yesterday."""
    seconds = (deadline - (now or _now())).total_seconds()
    return max(0, ceil(seconds / 86400))


def _publishable_course_count(db: Session) -> int:
    """Every course the Super Admin could hand to an institute - the pool the
    allocated ones are counted against."""
    return (
        db.query(ExamModule)
        .filter(ExamModule.status == "published", ExamModule.deleted_at.is_(None))
        .count()
    )


def _serialize(subscription: Subscription, state: str) -> dict:
    now = _now()
    days_remaining = None
    if state == STATE_ACTIVE:
        days_remaining = days_until(subscription.expires_at, now)
    elif state == STATE_GRACE:
        days_remaining = days_until(subscription.expires_at + timedelta(days=subscription.grace_days), now)
    elif state == STATE_SCHEDULED:
        # Days until this term takes over, not days of access it will grant.
        days_remaining = days_until(subscription.starts_at, now)
    return {
        "id": subscription.id,
        "institute_id": subscription.institute_id,
        "user_id": subscription.user_id,
        "plan_id": subscription.plan_id,
        "plan_name": subscription.plan.name if subscription.plan else None,
        "starts_at": subscription.starts_at,
        "expires_at": subscription.expires_at,
        "grace_days": subscription.grace_days,
        "cancelled_at": subscription.cancelled_at,
        "state": state,
        "days_remaining": days_remaining,
        "created_at": subscription.created_at,
    }


def subscription_status(db: Session, institute_id: int) -> dict:
    get_institute_or_404(db, institute_id)
    subscription, state = current_subscription(db, institute_id)
    counts = usage(db, institute_id)
    limits = None
    if subscription is not None and subscription.plan is not None:
        limits = {
            "students": subscription.plan.student_limit,
            "staff": subscription.plan.staff_limit,
            # Sittings are not metered - a student may take every test their
            # institute has been given, as many times as the module allows.
            # NULL reads as "unlimited" everywhere this is rendered.
            "tests": None,
            # Courses are allocated from a shared catalogue rather than capped,
            # so the "limit" is how many there are to give.
            "courses": _publishable_course_count(db),
        }
    return {
        "subscription": _serialize(subscription, state) if subscription else None,
        "state": state,
        "usage": counts,
        "limits": limits,
    }


def history(db: Session, institute_id: int) -> List[dict]:
    get_institute_or_404(db, institute_id)
    rows = (
        db.query(Subscription)
        .options(joinedload(Subscription.plan))
        .filter(Subscription.institute_id == institute_id)
        .order_by(Subscription.created_at.desc(), Subscription.id.desc())
        .all()
    )
    now = _now()
    return [_serialize(row, _state_of(row, now)) for row in rows]


def assign(
    db: Session,
    actor: User,
    institute_id: int,
    plan_id: int,
    starts_at: Optional[datetime],
    ip: Optional[str],
    *,
    commit: bool = True,
) -> dict:
    institute = get_institute_or_404(db, institute_id)
    plan = get_plan_or_404(db, plan_id)
    if not plan.is_internal:
        assert_audience(plan, AUDIENCE_INSTITUTES)
    if not plan.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This plan is deactivated and cannot be assigned",
        )

    start = starts_at.replace(tzinfo=None) if starts_at and starts_at.tzinfo else (starts_at or _now())
    subscription = Subscription(
        institute_id=institute_id,
        plan_id=plan.id,
        starts_at=start,
        expires_at=start + timedelta(days=plan.duration_days),
        grace_days=plan.grace_days,
    )
    db.add(subscription)
    db.flush()
    _reactivate_if_expiry_suspended(db, institute)
    _audit(db, actor, "subscription.assign", subscription.id, ip, {"institute_id": institute_id, "plan": plan.name})
    # (demo_service was removed in a previous commit)
    if commit:
        db.commit()
    else:
        db.flush()
    db.refresh(subscription)
    if commit:
        from app.services import notification_service

        notification_service.notify_roles(
            db,
            {SUPER_ADMIN, DEVELOPER},
            kind="subscription_assigned",
            title="Institute subscription assigned",
            message=f"{actor.email} assigned {plan.name} to {institute.name}.",
            link_url="/super-admin/subscriptions",
        )
        notification_service.notify_roles(
            db,
            {INSTITUTE_ADMIN},
            kind="subscription_assigned",
            title="Subscription assigned",
            message=f"{institute.name} is now on {plan.name}.",
            link_url="/institute-portal/billing",
            institute_id=institute.id,
        )
    _, state = current_subscription(db, institute_id)
    return _serialize(subscription, state)


def renew(
    db: Session,
    actor: User,
    institute_id: int,
    plan_id: Optional[int],
    ip: Optional[str],
    *,
    commit: bool = True,
) -> dict:
    institute = get_institute_or_404(db, institute_id)
    existing, state = current_subscription(db, institute_id)
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No subscription to renew - assign a plan first",
        )

    plan = get_plan_or_404(db, plan_id if plan_id is not None else existing.plan_id)
    if not plan.is_internal:
        assert_audience(plan, AUDIENCE_INSTITUTES)
    if not plan.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This plan is deactivated and cannot be assigned",
        )

    # renewal extends from current expiry if still running, otherwise from now
    start = max(_now(), existing.expires_at)
    subscription = Subscription(
        institute_id=institute_id,
        plan_id=plan.id,
        starts_at=start,
        expires_at=start + timedelta(days=plan.duration_days),
        grace_days=plan.grace_days,
    )
    db.add(subscription)
    db.flush()
    _reactivate_if_expiry_suspended(db, institute)
    _audit(db, actor, "subscription.renew", subscription.id, ip, {"institute_id": institute_id, "plan": plan.name})
    if commit:
        db.commit()
    else:
        db.flush()
    db.refresh(subscription)
    if commit:
        from app.services import notification_service

        notification_service.notify_roles(
            db,
            {SUPER_ADMIN, DEVELOPER},
            kind="subscription_renewed",
            title="Institute subscription renewed",
            message=f"{actor.email} renewed {institute.name} on {plan.name}.",
            link_url="/super-admin/subscriptions",
        )
        notification_service.notify_roles(
            db,
            {INSTITUTE_ADMIN},
            kind="subscription_renewed",
            title="Subscription renewed",
            message=f"{institute.name} has been renewed on {plan.name}.",
            link_url="/institute-portal/billing",
            institute_id=institute.id,
        )
    _, new_state = current_subscription(db, institute_id)
    return _serialize(subscription, new_state)


def sync_open_terms_to_plan(db: Session, institute_id: int, plan: Plan) -> int:
    """Point every term that has not ended yet at `plan` and re-read the terms
    a subscription copies rather than looks up.

    Editing an agreement rewrites its plan in place, so seats and courses reach
    the institute on their own. Three things do not: `grace_days` and the end
    date are stored on the row, and the row's plan_id can point at an older
    plan. Re-granting 30 days as 60 has to move the deadline the institute is
    counting down to, or the edit is only cosmetic.

    The start date is left alone, so the term is re-cut from where it began
    rather than restarted from today. Shortening an agreement therefore can
    end it - that is the edit doing what it says. Staged, not committed: the
    caller owns the transaction.
    """
    now = _now()
    touched = 0
    rows = (
        db.query(Subscription)
        .filter(Subscription.institute_id == institute_id, Subscription.cancelled_at.is_(None))
        .all()
    )
    # Oldest first, because a term renewed early begins where its predecessor
    # ends - move one deadline and the queue behind it has to follow.
    open_rows = sorted((row for row in rows if _access_ends_at(row) > now), key=lambda row: row.starts_at)
    handover: Optional[datetime] = None
    for row in open_rows:
        starts_at = handover if handover is not None else row.starts_at
        expires_at = starts_at + timedelta(days=plan.duration_days)
        handover = expires_at
        unchanged = (
            row.plan_id == plan.id
            and row.grace_days == plan.grace_days
            and row.starts_at == starts_at
            and row.expires_at == expires_at
        )
        if unchanged:
            continue
        row.plan_id = plan.id
        row.grace_days = plan.grace_days
        row.starts_at = starts_at
        row.expires_at = expires_at
        db.add(row)
        touched += 1
    return touched


def cancel(db: Session, actor: User, subscription_id: int, ip: Optional[str]) -> dict:
    subscription = (
        db.query(Subscription)
        .options(joinedload(Subscription.plan))
        .filter(Subscription.id == subscription_id)
        .first()
    )
    if subscription is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    if subscription.cancelled_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Subscription is already cancelled")

    subscription.cancelled_at = _now()
    db.add(subscription)
    _audit(db, actor, "subscription.cancel", subscription.id, ip, {"institute_id": subscription.institute_id})
    db.commit()
    db.refresh(subscription)
    return _serialize(subscription, "cancelled")


def subscribe_user(
    db: Session,
    user_id: int,
    plan_id: int,
    ip: Optional[str],
    *,
    commit: bool = True,
) -> Subscription:
    """Personal (B2C) mirror of assign() - grants a direct student a
    subscription to a plan. Not exposed as a standalone endpoint; only
    reachable through payment_service.create_user_plan_payment, exactly how
    assign() itself is only reachable through create_b2b_plan_payment."""
    plan = get_plan_or_404(db, plan_id)
    assert_audience(plan, AUDIENCE_DIRECT)
    if not plan.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This plan is deactivated and cannot be subscribed to",
        )

    start = _now()
    subscription = Subscription(
        user_id=user_id,
        plan_id=plan.id,
        starts_at=start,
        expires_at=start + timedelta(days=plan.duration_days),
        grace_days=plan.grace_days,
    )
    db.add(subscription)
    db.flush()
    db.add(
        AuditLog(
            user_id=user_id,
            action="subscription.subscribe",
            entity_type="subscription",
            entity_id=subscription.id,
            details={"plan": plan.name},
            ip_address=ip,
        )
    )
    if commit:
        db.commit()
    else:
        db.flush()
    db.refresh(subscription)
    return subscription


def user_subscription_history(db: Session, user_id: int) -> List[dict]:
    rows = (
        db.query(Subscription)
        .options(joinedload(Subscription.plan))
        .filter(Subscription.user_id == user_id)
        .order_by(Subscription.created_at.desc(), Subscription.id.desc())
        .all()
    )
    now = _now()
    return [_serialize(row, _state_of(row, now)) for row in rows]


def my_current_plan_view(db: Session, user: User) -> dict:
    """What a student's 'My Plan' page renders: their current (institute or
    personal) subscription's plan and its modules, ready for a 'Start test'
    button, plus locked indicators for modules outside their active plan."""
    if user.institute_id is not None:
        subscription, state = current_subscription(db, user.institute_id)
    else:
        subscription, state = current_user_subscription(db, user.id)

    all_published_modules = (
        db.query(ExamModule)
        .filter(
            ExamModule.status == "published",
            ExamModule.is_visible.is_(True),
            ExamModule.deleted_at.is_(None),
        )
        .order_by(ExamModule.created_at.desc(), ExamModule.id.desc())
        .all()
    )

    from app.services import ai_evaluation_service
    from app.models.attempt import TestAttempt, RetakeRequest

    ai_quota = ai_evaluation_service.get_student_ai_quota_summary(db, user)

    # Fetch attempts and retake statuses for this student
    attempt_rows = (
        db.query(TestAttempt.module_id, TestAttempt.id, TestAttempt.status)
        .filter(TestAttempt.user_id == user.id)
        .order_by(TestAttempt.id.desc())
        .all()
    )
    attempts_by_module: dict[int, list[dict]] = {}
    for mod_id, att_id, att_status in attempt_rows:
        if mod_id not in attempts_by_module:
            attempts_by_module[mod_id] = []
        attempts_by_module[mod_id].append({"id": att_id, "status": att_status})

    available_retake_module_ids = set(
        row[0]
        for row in db.query(TestAttempt.module_id)
        .join(RetakeRequest, RetakeRequest.attempt_id == TestAttempt.id)
        .filter(
            RetakeRequest.student_id == user.id,
            RetakeRequest.status == "approved",
            RetakeRequest.consumed_at.is_(None),
        )
        .all()
    )

    def _module_attempt_info(module: ExamModule) -> dict:
        mod_atts = attempts_by_module.get(module.id, [])
        has_att = len(mod_atts) > 0
        dev_unlimited_speaking = _dev_unlimited_speaking_attempts(db, module)
        retake_avail = module.id in available_retake_module_ids or dev_unlimited_speaking
        is_exh = has_att and not retake_avail
        latest = mod_atts[0] if mod_atts else None
        return {
            "has_attempted": has_att,
            "is_exhausted": is_exh,
            "latest_attempt_id": latest["id"] if latest else None,
            "latest_attempt_status": latest["status"] if latest else None,
            "retake_available": retake_avail,
        }

    if subscription is None or state not in (STATE_ACTIVE, STATE_GRACE):
        from app.services import trial_service

        # Trial Settings decide which modules are free and for how long.
        demo = trial_service.demo_state(db, user)
        demo_ids = set(demo["module_ids"]) if demo["state"] == "active" else set()
        modules_payload = [
            {
                "module_id": module.id,
                "title": module.title,
                "module_type": module.module_type,
                "duration_minutes": module.duration_minutes,
                # Free only while the trial allows it.
                "is_locked": module.id not in demo_ids,
                "is_demo": module.id in demo_ids,
                **_module_attempt_info(module),
            }
            for module in all_published_modules
        ]
        modules_payload.sort(key=lambda m: (m["is_locked"], m["title"]))

        return {
            "plan": {
                "id": 0,
                "name": "Available Practice & Mock Tests",
                "description": "Upgrade your plan subscription to unlock access to locked test modules.",
                "courses": [],
                "modules": modules_payload,
            },
            "state": state,
            "expires_at": None,
            "access_type": "institute" if user.institute_id is not None else "direct",
            "ai_evaluations": ai_quota,
            "demo": demo,
        }

    plan = subscription.plan
    if user.institute_id is not None:
        institute_modules = (
            db.query(ExamModule)
            .join(InstituteModule, InstituteModule.module_id == ExamModule.id)
            .filter(
                InstituteModule.institute_id == user.institute_id,
                InstituteModule.is_active.is_(True),
                ExamModule.status == "published",
                ExamModule.is_visible.is_(True),
                ExamModule.deleted_at.is_(None),
            )
            .order_by(ExamModule.created_at.desc(), ExamModule.id.desc())
            .all()
        )
        unlocked_ids = {m.id for m in institute_modules}
    else:
        # A direct student may have multiple active subscriptions (e.g. they
        # upgraded or were assigned an extra plan).  Unlock a module if ANY
        # of their active plans includes it, not just the single "governing"
        # subscription picked for billing/expiry purposes.
        all_user_subs = (
            db.query(Subscription)
            .options(joinedload(Subscription.plan).joinedload(Plan.modules))
            .filter(Subscription.user_id == user.id, Subscription.cancelled_at.is_(None))
            .all()
        )
        now = _now()
        unlocked_ids: set[int] = set()
        for sub in all_user_subs:
            sub_state = _state_of(sub, now)
            if sub_state in (STATE_ACTIVE, STATE_GRACE):
                unlocked_ids.update(
                    m.id for m in sub.plan.modules
                    if m.status == "published" and m.is_visible and m.deleted_at is None
                )

    # For direct students, return all published modules with is_locked status
    modules_list = []
    if user.institute_id is not None:
        for module in institute_modules:
            modules_list.append({
                "module_id": module.id,
                "title": module.title,
                "module_type": module.module_type,
                "duration_minutes": module.duration_minutes,
                "is_locked": False,
                "is_demo": False,
                **_module_attempt_info(module),
            })
    else:
        for module in all_published_modules:
            modules_list.append({
                "module_id": module.id,
                "title": module.title,
                "module_type": module.module_type,
                "duration_minutes": module.duration_minutes,
                # Subscribed: entitlement alone decides. The free-demo
                # affordance disappears once a plan is active.
                "is_locked": module.id not in unlocked_ids,
                "is_demo": False,
                **_module_attempt_info(module),
            })
        modules_list.sort(key=lambda m: (m["is_locked"], m["title"]))

    return {
        "plan": {
            "id": 0 if user.institute_id is not None else plan.id,
            "name": "Institute assigned tests" if user.institute_id is not None else plan.name,
            "description": (
                "Tests assigned to your institute by the Super Admin."
                if user.institute_id is not None
                else plan.description
            ),
            "courses": [],
            "modules": modules_list,
        },
        "state": state,
        "expires_at": subscription.expires_at,
        "access_type": "institute" if user.institute_id is not None else "direct",
        "ai_evaluations": ai_quota,
    }
