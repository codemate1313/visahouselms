from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.audit_log import AuditLog
from app.models.institute import Institute
from app.models.role import INST_INSTRUCTOR, INSTITUTE_ADMIN, STUDENT, Role
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


def usage(db: Session, institute_id: int) -> dict:
    role_ids = {
        role.name: role.id
        for role in db.query(Role).filter(Role.name.in_([STUDENT, INSTITUTE_ADMIN, INST_INSTRUCTOR])).all()
    }
    students = (
        db.query(User)
        .filter(User.institute_id == institute_id, User.role_id == role_ids.get(STUDENT, -1))
        .count()
    )
    staff = (
        db.query(User)
        .filter(
            User.institute_id == institute_id,
            User.role_id.in_([role_ids.get(INSTITUTE_ADMIN, -1), role_ids.get(INST_INSTRUCTOR, -1)]),
        )
        .count()
    )
    # tests don't exist until Phase 3 - the counter registry in
    # app/dependencies/limits.py is the single place to update when they do
    tests = 0
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
            "tests": subscription.plan.test_limit,
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
