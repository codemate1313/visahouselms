from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.audit_log import AuditLog
from app.models.exam_module import ExamModule, InstituteModule
from app.models.institute import Institute
from app.models.plan import Plan
from app.models.role import INST_INSTRUCTOR, STUDENT, Role
from app.models.subscription import Subscription
from app.models.user import User
from app.services.plan_service import get_plan_or_404

STATE_NONE = "none"
STATE_ACTIVE = "active"
STATE_GRACE = "grace"
STATE_EXPIRED = "expired"


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


def get_institute_or_404(db: Session, institute_id: int) -> Institute:
    institute = db.get(Institute, institute_id)
    if institute is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institute not found")
    return institute


def current_subscription(db: Session, institute_id: int) -> Tuple[Optional[Subscription], str]:
    """Latest non-cancelled subscription and its derived state."""
    subscription = (
        db.query(Subscription)
        .options(joinedload(Subscription.plan))
        .filter(Subscription.institute_id == institute_id, Subscription.cancelled_at.is_(None))
        .order_by(Subscription.expires_at.desc())
        .first()
    )
    if subscription is None:
        return None, STATE_NONE

    now = _now()
    if now < subscription.expires_at:
        return subscription, STATE_ACTIVE
    if now < subscription.expires_at + timedelta(days=subscription.grace_days):
        return subscription, STATE_GRACE
    return subscription, STATE_EXPIRED


def current_user_subscription(db: Session, user_id: int) -> Tuple[Optional[Subscription], str]:
    """Personal (B2C direct-student) mirror of current_subscription - latest
    non-cancelled subscription owned by this user (not an institute) and its
    derived state."""
    subscription = (
        db.query(Subscription)
        .options(joinedload(Subscription.plan).joinedload(Plan.modules))
        .filter(Subscription.user_id == user_id, Subscription.cancelled_at.is_(None))
        .order_by(Subscription.expires_at.desc())
        .first()
    )
    if subscription is None:
        return None, STATE_NONE

    now = _now()
    if now < subscription.expires_at:
        return subscription, STATE_ACTIVE
    if now < subscription.expires_at + timedelta(days=subscription.grace_days):
        return subscription, STATE_GRACE
    return subscription, STATE_EXPIRED


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
    return {"students": students, "staff": staff, "tests": tests}


def _serialize(subscription: Subscription, state: str) -> dict:
    now = _now()
    days_remaining = None
    if state == STATE_ACTIVE:
        days_remaining = max(0, (subscription.expires_at - now).days)
    elif state == STATE_GRACE:
        grace_end = subscription.expires_at + timedelta(days=subscription.grace_days)
        days_remaining = max(0, (grace_end - now).days)
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
            "tests": None if subscription.plan.is_internal else subscription.plan.test_limit,
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
    result = []
    for row in rows:
        if row.cancelled_at is not None:
            state = "cancelled"
        elif now < row.expires_at:
            state = STATE_ACTIVE
        elif now < row.expires_at + timedelta(days=row.grace_days):
            state = STATE_GRACE
        else:
            state = STATE_EXPIRED
        result.append(_serialize(row, state))
    return result


def assign(
    db: Session,
    actor: User,
    institute_id: int,
    plan_id: int,
    starts_at: Optional[datetime],
    ip: Optional[str],
) -> dict:
    get_institute_or_404(db, institute_id)
    plan = get_plan_or_404(db, plan_id)
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
    _audit(db, actor, "subscription.assign", subscription.id, ip, {"institute_id": institute_id, "plan": plan.name})
    db.commit()
    db.refresh(subscription)
    _, state = current_subscription(db, institute_id)
    return _serialize(subscription, state)


def renew(
    db: Session,
    actor: User,
    institute_id: int,
    plan_id: Optional[int],
    ip: Optional[str],
) -> dict:
    get_institute_or_404(db, institute_id)
    existing, state = current_subscription(db, institute_id)
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No subscription to renew - assign a plan first",
        )

    plan = get_plan_or_404(db, plan_id if plan_id is not None else existing.plan_id)
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
    _audit(db, actor, "subscription.renew", subscription.id, ip, {"institute_id": institute_id, "plan": plan.name})
    db.commit()
    db.refresh(subscription)
    _, new_state = current_subscription(db, institute_id)
    return _serialize(subscription, new_state)


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
) -> Subscription:
    """Personal (B2C) mirror of assign() - grants a direct student a
    subscription to a plan. Not exposed as a standalone endpoint; only
    reachable through payment_service.create_user_plan_payment, exactly how
    assign() itself is only reachable through create_b2b_plan_payment."""
    plan = get_plan_or_404(db, plan_id)
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
    db.commit()
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
    result = []
    for row in rows:
        if row.cancelled_at is not None:
            state = "cancelled"
        elif now < row.expires_at:
            state = STATE_ACTIVE
        elif now < row.expires_at + timedelta(days=row.grace_days):
            state = STATE_GRACE
        else:
            state = STATE_EXPIRED
        result.append(_serialize(row, state))
    return result


def my_current_plan_view(db: Session, user: User) -> dict:
    """What a student's 'My Plan' page renders: their current (institute or
    personal) subscription's plan and its modules, ready for a 'Start test'
    button, or plan=None if they have no active/grace subscription."""
    if user.institute_id is not None:
        subscription, state = current_subscription(db, user.institute_id)
    else:
        subscription, state = current_user_subscription(db, user.id)

    if subscription is None or state not in (STATE_ACTIVE, STATE_GRACE):
        return {
            "plan": None,
            "state": state,
            "expires_at": None,
            "access_type": "institute" if user.institute_id is not None else "direct",
        }

    plan = subscription.plan
    if user.institute_id is not None:
        modules = (
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
    else:
        modules = [
            module
            for module in plan.modules
            if module.status == "published" and module.is_visible and module.deleted_at is None
        ]
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
            "modules": [
                {
                    "module_id": module.id,
                    "title": module.title,
                    "module_type": module.module_type,
                    "duration_minutes": module.duration_minutes,
                }
                for module in modules
            ],
        },
        "state": state,
        "expires_at": subscription.expires_at,
        "access_type": "institute" if user.institute_id is not None else "direct",
    }
