from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.user import User


def _audit(db: Session, actor: User, action: str, plan_id: Optional[int], ip: Optional[str], details=None) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            action=action,
            entity_type="plan",
            entity_id=plan_id,
            details=details,
            ip_address=ip,
        )
    )


def list_plans(db: Session) -> List[dict]:
    plans = db.query(Plan).order_by(Plan.created_at).all()
    counts = {
        plan_id: count
        for plan_id, count in (
            db.query(Subscription.plan_id, func.count(Subscription.id))
            .group_by(Subscription.plan_id)
            .all()
        )
    }
    return [_serialize(plan, counts.get(plan.id, 0)) for plan in plans]


def _serialize(plan: Plan, subscription_count: Optional[int] = None) -> dict:
    data = {
        "id": plan.id,
        "name": plan.name,
        "description": plan.description,
        "price": str(plan.price),
        "currency": plan.currency,
        "duration_days": plan.duration_days,
        "student_limit": plan.student_limit,
        "test_limit": plan.test_limit,
        "staff_limit": plan.staff_limit,
        "grace_days": plan.grace_days,
        "is_active": plan.is_active,
        "created_at": plan.created_at,
    }
    if subscription_count is not None:
        data["subscription_count"] = subscription_count
    return data


def get_plan_or_404(db: Session, plan_id: int) -> Plan:
    plan = db.get(Plan, plan_id)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return plan


def get_plan(db: Session, plan_id: int) -> dict:
    plan = get_plan_or_404(db, plan_id)
    count = db.query(Subscription).filter(Subscription.plan_id == plan.id).count()
    return _serialize(plan, count)


def create_plan(db: Session, actor: User, data: dict, ip: Optional[str]) -> dict:
    if db.query(Plan).filter(Plan.name == data["name"]).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A plan with this name already exists")

    plan = Plan(
        name=data["name"],
        description=data.get("description"),
        price=Decimal(str(data["price"])),
        currency=data.get("currency") or "INR",
        duration_days=data["duration_days"],
        student_limit=data["student_limit"],
        test_limit=data["test_limit"],
        staff_limit=data["staff_limit"],
        grace_days=data.get("grace_days", 7),
        is_active=True,
    )
    db.add(plan)
    db.flush()
    _audit(db, actor, "plan.create", plan.id, ip, {"name": plan.name})
    db.commit()
    db.refresh(plan)
    return _serialize(plan, 0)


def update_plan(db: Session, actor: User, plan_id: int, data: dict, ip: Optional[str]) -> dict:
    plan = get_plan_or_404(db, plan_id)

    if "name" in data and data["name"] is not None and data["name"] != plan.name:
        if db.query(Plan).filter(Plan.name == data["name"], Plan.id != plan.id).first() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A plan with this name already exists")
        plan.name = data["name"]

    for field in ("description", "currency", "duration_days", "student_limit", "test_limit", "staff_limit", "grace_days"):
        if field in data and data[field] is not None:
            setattr(plan, field, data[field])
    if "price" in data and data["price"] is not None:
        plan.price = Decimal(str(data["price"]))

    db.add(plan)
    _audit(db, actor, "plan.update", plan.id, ip)
    db.commit()
    db.refresh(plan)
    count = db.query(Subscription).filter(Subscription.plan_id == plan.id).count()
    return _serialize(plan, count)


def set_plan_active(db: Session, actor: User, plan_id: int, active: bool, ip: Optional[str]) -> dict:
    plan = get_plan_or_404(db, plan_id)
    plan.is_active = active
    db.add(plan)
    _audit(db, actor, "plan.activate" if active else "plan.deactivate", plan.id, ip)
    db.commit()
    db.refresh(plan)
    count = db.query(Subscription).filter(Subscription.plan_id == plan.id).count()
    return _serialize(plan, count)


def delete_plan(db: Session, actor: User, plan_id: int, ip: Optional[str]) -> None:
    plan = get_plan_or_404(db, plan_id)
    has_subscriptions = (
        db.query(Subscription).filter(Subscription.plan_id == plan.id).count() > 0
    )
    if has_subscriptions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This plan has subscriptions and cannot be deleted - deactivate it instead",
        )
    _audit(db, actor, "plan.delete", plan.id, ip, {"name": plan.name})
    db.delete(plan)
    db.commit()
