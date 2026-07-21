from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.audit_log import AuditLog
from app.models.exam_module import ExamModule
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
    plans = db.query(Plan).filter(Plan.is_internal.is_(False)).order_by(Plan.created_at).all()
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
        "audience": plan.audience,
        "is_published": plan.is_published,
        "is_internal": plan.is_internal,
        "created_at": plan.created_at,
        "module_count": len(plan.modules),
        "modules": [
            {
                "id": module.id,
                "title": module.title,
                "module_type": module.module_type,
                "duration_minutes": module.duration_minutes,
                "status": module.status,
                "is_visible": module.is_visible,
            }
            for module in plan.modules
        ],
    }
    if subscription_count is not None:
        data["subscription_count"] = subscription_count
    return data


def _resolve_modules(db: Session, module_ids: List[int]) -> List[ExamModule]:
    if not module_ids:
        return []
    modules = db.query(ExamModule).filter(ExamModule.id.in_(module_ids), ExamModule.deleted_at.is_(None)).all()
    found_ids = {module.id for module in modules}
    missing = [mid for mid in module_ids if mid not in found_ids]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Module id(s) not found: {', '.join(str(m) for m in missing)}",
        )
    not_published = [module.id for module in modules if module.status != "published"]
    if not_published:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only published modules can be added to a plan (not published: {', '.join(str(m) for m in not_published)})",
        )
    return modules


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

    modules = _resolve_modules(db, data.get("module_ids") or [])
    if data.get("is_published") and not modules:
        raise HTTPException(status_code=400, detail="Add at least one course before publishing the plan")
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
        audience=data.get("audience", "both"),
        is_published=data.get("is_published", False),
        modules=modules,
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

    for field in ("description", "currency", "duration_days", "student_limit", "test_limit", "staff_limit", "grace_days", "audience", "is_published"):
        if field in data and data[field] is not None:
            setattr(plan, field, data[field])
    if "price" in data and data["price"] is not None:
        plan.price = Decimal(str(data["price"]))
    if "module_ids" in data and data["module_ids"] is not None:
        plan.modules = _resolve_modules(db, data["module_ids"])
    if plan.is_published and not plan.modules:
        raise HTTPException(status_code=400, detail="Add at least one course before publishing the plan")

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


def list_available_modules_for_plans(
    db: Session, search: Optional[str] = None, module_type: Optional[str] = None
) -> List[dict]:
    """Cross-instructor listing of published modules for the Super Admin's
    plan-module picker. Deliberately unscoped by created_by_id - unlike
    module_authoring_service.list_modules (author-private), Super Admin needs
    visibility into every instructor's published content to bundle it into a
    plan."""
    query = db.query(ExamModule).filter(ExamModule.status == "published", ExamModule.deleted_at.is_(None))
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(ExamModule.title.ilike(term), ExamModule.description.ilike(term)))
    if module_type:
        query = query.filter(ExamModule.module_type == module_type)
    modules = query.order_by(ExamModule.module_type, ExamModule.title).all()
    return [
        {
            "id": module.id,
            "title": module.title,
            "module_type": module.module_type,
            "duration_minutes": module.duration_minutes,
            "status": module.status,
            "is_visible": module.is_visible,
            "created_by_name": f"{module.created_by.first_name} {module.created_by.last_name}".strip(),
        }
        for module in modules
    ]


def list_public_plans(db: Session, user: User) -> List[dict]:
    """Active plans with each plan's module bundle plus whether this student
    (institute-linked or direct/B2C) is currently entitled to it."""
    from app.services.subscription_service import (  # local import: avoids a
        STATE_ACTIVE,  # circular import, since subscription_service already
        STATE_GRACE,  # imports plan_service.get_plan_or_404
        current_subscription,
        current_user_subscription,
    )

    if user.institute_id is not None:
        subscription, state = current_subscription(db, user.institute_id)
    else:
        subscription, state = current_user_subscription(db, user.id)
    entitled_plan_id = subscription.plan_id if subscription and state in (STATE_ACTIVE, STATE_GRACE) else None

    plans = (
        db.query(Plan)
        .options(joinedload(Plan.modules))
        .filter(Plan.is_active.is_(True), Plan.is_published.is_(True), Plan.audience.in_(("both", "direct_students")))
        .order_by(Plan.price)
        .all()
    )
    result = []
    for plan in plans:
        data = _serialize(plan)
        data["modules"] = [module for module in data["modules"] if module["status"] == "published" and module["is_visible"]]
        data["module_count"] = len(data["modules"])
        data["entitled"] = plan.id == entitled_plan_id
        result.append(data)
    return result
