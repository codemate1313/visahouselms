from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.exam_module import ExamModule, InstituteModule
from app.models.institute import Institute
from app.models.payment import Payment
from app.models.plan import Plan
from app.models.role import INSTITUTE_ADMIN
from app.models.subscription import Subscription
from app.models.user import User
from app.services import institute_service


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _admin(db: Session, institute_id: int) -> User:
    user = db.query(User).filter(User.institute_id == institute_id).join(User.role).filter_by(name=INSTITUTE_ADMIN).first()
    if user is None:
        raise HTTPException(status_code=500, detail="Institute admin is missing")
    return user


def _serialize(db: Session, institute: Institute) -> dict:
    payment = db.query(Payment).filter(Payment.institute_id == institute.id).order_by(Payment.id.desc()).first()
    modules = (
        db.query(InstituteModule)
        .filter(InstituteModule.institute_id == institute.id, InstituteModule.is_active.is_(True))
        .all()
    )
    members = db.query(User).filter(User.institute_id == institute.id, User.deleted_at.is_(None)).count()
    return {
        **institute_service._serialize(db, institute),
        "onboarding_status": institute.onboarding_status,
        "agreement_reference": institute.agreement_reference,
        "agreement_notes": institute.agreement_notes,
        "agreed_amount": str(institute.agreed_amount) if institute.agreed_amount is not None else None,
        "agreement_currency": institute.agreement_currency,
        "student_limit": institute.student_limit,
        "staff_limit": institute.staff_limit,
        "test_limit": institute.test_limit,
        "access_duration_days": institute.access_duration_days,
        "published_at": institute.published_at,
        "payment": ({
            "id": payment.id,
            "amount_paid": str(payment.amount_paid),
            "status": payment.status,
            "reference": payment.gateway_reference,
        } if payment else None),
        "course_count": len(modules),
        "module_ids": [link.module_id for link in modules],
        "branding": institute_service.get_branding(db, institute.id),
        "member_count": members,
    }


def list_onboardings(db: Session) -> list[dict]:
    rows = (
        db.query(Institute)
        .filter(Institute.agreed_amount.isnot(None))
        .order_by(Institute.created_at.desc())
        .all()
    )
    return [_serialize(db, row) for row in rows]


def get_onboarding(db: Session, institute_id: int) -> dict:
    return _serialize(db, institute_service.get_institute_or_404(db, institute_id))


def create_draft(db: Session, actor: User, data: dict, ip: Optional[str]) -> dict:
    received = Decimal(str(data["amount_received"]))
    agreed = Decimal(str(data["agreed_amount"]))
    if received > agreed:
        raise HTTPException(status_code=400, detail="Amount received cannot exceed the agreed amount")
    modules = db.query(ExamModule).filter(ExamModule.id.in_(data.get("module_ids") or []), ExamModule.deleted_at.is_(None)).all()
    if len(modules) != len(set(data.get("module_ids") or [])) or any(module.status != "published" for module in modules):
        raise HTTPException(status_code=400, detail="Every selected course must be published")

    created = institute_service.create_institute(
        db, actor, data["name"], data.get("contact_email"), data["admin_email"],
        data["admin_first_name"], data["admin_last_name"], data["admin_permissions"], ip,
        active=False, onboarding_status="draft",
    )
    institute = institute_service.get_institute_or_404(db, created["id"])
    institute.agreement_reference = data.get("agreement_reference")
    institute.agreement_notes = data.get("agreement_notes")
    institute.agreed_amount = agreed
    institute.agreement_currency = data.get("currency", "INR").upper()
    institute.student_limit = data["student_limit"]
    institute.staff_limit = data["staff_limit"]
    # Negotiated institute agreements do not meter test attempts.
    institute.test_limit = None
    institute.access_duration_days = data["access_duration_days"]
    admin = _admin(db, institute.id)
    admin.is_active = False
    db.add_all([institute, admin])

    status = "paid" if received >= agreed else "partial"
    payment = Payment(
        source="b2b", institute_id=institute.id, amount=agreed, discount_amount=0,
        final_amount=agreed, amount_paid=received, currency=institute.agreement_currency,
        payment_method_id=data.get("payment_method_id"), gateway="manual",
        gateway_reference=data.get("payment_reference"), status=status,
        paid_at=_now() if status == "paid" else None,
    )
    db.add(payment)
    db.flush()
    payment.invoice_number = f"INV-{payment.id:06d}"
    for module in modules:
        db.add(InstituteModule(institute_id=institute.id, module_id=module.id, assigned_by_id=actor.id, is_active=True))
    db.commit()
    institute_service.update_branding(db, actor, institute.id, data["primary_color"], data["secondary_color"], ip)
    result = get_onboarding(db, institute.id)
    result.update({"admin_email": created["admin_email"], "admin_temp_password": created["admin_temp_password"]})
    return result


def publish(db: Session, actor: User, institute_id: int, ip: Optional[str]) -> dict:
    institute = institute_service.get_institute_or_404(db, institute_id)
    if institute.onboarding_status == "published":
        return _serialize(db, institute)
    payment = db.query(Payment).filter(Payment.institute_id == institute.id).order_by(Payment.id.desc()).first()
    if payment is None or payment.amount_paid <= 0:
        raise HTTPException(status_code=400, detail="Record the physical payment before publishing")
    module_links = db.query(InstituteModule).filter(InstituteModule.institute_id == institute.id, InstituteModule.is_active.is_(True)).all()
    if not module_links:
        raise HTTPException(status_code=400, detail="Assign at least one course before publishing")
    plan = Plan(
        name=f"Agreement {institute.slug} {institute.id}", description="Internal negotiated institute agreement",
        price=institute.agreed_amount or 0, currency=institute.agreement_currency,
        duration_days=institute.access_duration_days or 365, student_limit=institute.student_limit or 0,
        staff_limit=institute.staff_limit or 0, test_limit=0,
        grace_days=0, is_active=True, audience="institutes", is_published=False, is_internal=True,
        modules=[link.module for link in module_links],
    )
    db.add(plan)
    db.flush()
    start = _now()
    subscription = Subscription(
        institute_id=institute.id, plan_id=plan.id, starts_at=start,
        expires_at=start + timedelta(days=plan.duration_days), grace_days=0,
    )
    db.add(subscription)
    db.flush()
    payment.plan_id = plan.id
    payment.subscription_id = subscription.id
    institute.onboarding_status = "published"
    institute.published_at = start
    institute.is_active = True
    db.query(User).filter(User.institute_id == institute.id, User.deleted_at.is_(None)).update({"is_active": True}, synchronize_session=False)
    db.add_all([payment, institute])
    db.commit()
    return _serialize(db, institute)
