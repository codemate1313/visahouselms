from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.payment_gateway import get_gateway
from app.models.audit_log import AuditLog
from app.models.institute import Institute
from app.models.payment import Payment
from app.models.plan import Plan
from app.models.user import User
from app.services import coupon_service, institute_service, plan_service, subscription_service

STATUS_PENDING = "pending"
STATUS_PARTIAL = "partial"
STATUS_PAID = "paid"
STATUS_FAILED = "failed"
STATUS_REFUNDED = "refunded"


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _audit(db: Session, actor: Optional[User], action: str, payment_id: Optional[int], ip: Optional[str], details=None) -> None:
    db.add(
        AuditLog(
            user_id=actor.id if actor else None,
            action=action,
            entity_type="payment",
            entity_id=payment_id,
            details=details,
            ip_address=ip,
        )
    )


def _append_reference(existing: Optional[str], note: str) -> str:
    return f"{existing}; {note}" if existing else note


def _status_for_amount(amount_paid: Decimal, final_amount: Decimal) -> str:
    if amount_paid >= final_amount:
        return STATUS_PAID
    if amount_paid > 0:
        return STATUS_PARTIAL
    return STATUS_PENDING


def _serialize(payment: Payment) -> dict:
    due = payment.final_amount - payment.amount_paid
    return {
        "id": payment.id,
        "source": payment.source,
        "institute_id": payment.institute_id,
        "institute_name": payment.institute.name if payment.institute else None,
        "user_id": payment.user_id,
        "plan_id": payment.plan_id,
        "plan_name": payment.plan.name if payment.plan else None,
        "course_id": payment.course_id,
        "amount": str(payment.amount),
        "discount_amount": str(payment.discount_amount),
        "final_amount": str(payment.final_amount),
        "amount_paid": str(payment.amount_paid),
        "due_amount": str(due if due > 0 else Decimal("0")),
        "currency": payment.currency,
        "coupon_id": payment.coupon_id,
        "coupon_code": payment.coupon.code if payment.coupon else None,
        "payment_method_id": payment.payment_method_id,
        "payment_method_name": payment.payment_method.name if payment.payment_method else None,
        "gateway": payment.gateway,
        "gateway_reference": payment.gateway_reference,
        "status": payment.status,
        "subscription_id": payment.subscription_id,
        "invoice_number": payment.invoice_number,
        "created_at": payment.created_at,
        "paid_at": payment.paid_at,
    }


def _query_with_relations(db: Session):
    return db.query(Payment).options(
        joinedload(Payment.institute),
        joinedload(Payment.plan),
        joinedload(Payment.coupon),
        joinedload(Payment.payment_method),
    )


def create_b2b_plan_payment(
    db: Session,
    actor: User,
    institute_id: int,
    plan_id: int,
    coupon_code: Optional[str],
    gateway_reference: Optional[str],
    payment_method_id: Optional[int] = None,
    amount_received: Optional[Decimal] = None,
    ip: Optional[str] = None,
) -> dict:
    institute_service.get_institute_or_404(db, institute_id)
    plan = plan_service.get_plan_or_404(db, plan_id)
    if not plan.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This plan is deactivated")

    discount, coupon = coupon_service.validate_and_price(db, coupon_code, plan.price, "plan", plan_id)
    final_amount = plan.price - discount

    # defaults to a full one-shot payment, exactly today's behavior, unless a
    # smaller amount is explicitly recorded (a partial/installment payment)
    received = final_amount if amount_received is None else amount_received
    if received <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount received must be greater than zero")
    if received > final_amount:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount received cannot exceed the final amount")

    payment_status = _status_for_amount(received, final_amount)

    payment = Payment(
        source="b2b",
        institute_id=institute_id,
        plan_id=plan_id,
        amount=plan.price,
        discount_amount=discount,
        final_amount=final_amount,
        amount_paid=received,
        currency=plan.currency,
        coupon_id=coupon.id if coupon else None,
        payment_method_id=payment_method_id,
        gateway="manual",
        gateway_reference=gateway_reference,
        status=payment_status,
        paid_at=_now() if payment_status == STATUS_PAID else None,
    )
    db.add(payment)
    db.flush()

    gateway = get_gateway("manual")
    if not gateway.verify_payment(gateway_reference):
        payment.status = STATUS_FAILED
        payment.paid_at = None
        db.add(payment)
        _audit(db, actor, "payment.create", payment.id, ip, {"institute_id": institute_id, "plan": plan.name, "result": "failed"})
        db.commit()
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Payment verification failed")

    payment.invoice_number = f"INV-{payment.id:06d}"
    db.add(payment)

    # discount is priced in regardless of how much has actually been received
    if coupon is not None:
        coupon_service.redeem(db, coupon)

    _audit(
        db, actor, "payment.create", payment.id, ip,
        {"institute_id": institute_id, "plan": plan.name, "status": payment_status},
    )
    db.commit()

    # subscription activates immediately on any recorded payment (partial or
    # full) - the due balance is tracked for collection, access isn't gated
    subscription = subscription_service.assign(db, actor, institute_id, plan_id, None, ip)
    payment.subscription_id = subscription["id"]
    db.add(payment)
    db.commit()

    payment = _query_with_relations(db).filter(Payment.id == payment.id).first()
    return _serialize(payment)


def add_installment(
    db: Session,
    actor: User,
    payment_id: int,
    amount: Decimal,
    payment_method_id: Optional[int],
    reference: Optional[str],
    ip: Optional[str],
) -> dict:
    payment = get_payment_or_404(db, payment_id)
    if payment.status not in (STATUS_PENDING, STATUS_PARTIAL):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot record a due payment on a '{payment.status}' payment",
        )
    due = payment.final_amount - payment.amount_paid
    if amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount must be greater than zero")
    if amount > due:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Amount exceeds the remaining due of {due}")

    payment.amount_paid += amount
    payment.status = _status_for_amount(payment.amount_paid, payment.final_amount)
    if payment.status == STATUS_PAID:
        payment.paid_at = _now()
    if payment_method_id is not None:
        payment.payment_method_id = payment_method_id
    note = f"+{amount} on {_now().date().isoformat()}"
    if reference:
        note += f" ({reference})"
    payment.gateway_reference = _append_reference(payment.gateway_reference, note)

    db.add(payment)
    _audit(db, actor, "payment.add_installment", payment.id, ip, {"amount": str(amount), "new_status": payment.status})
    db.commit()

    payment = _query_with_relations(db).filter(Payment.id == payment.id).first()
    return _serialize(payment)


def create_user_plan_payment(
    db: Session,
    user_id: int,
    plan_id: int,
    coupon_code: Optional[str],
    gateway_reference: Optional[str],
    ip: Optional[str] = None,
) -> dict:
    """B2C direct-student self-service plan purchase - same shape as
    create_b2b_plan_payment but for an individual user's personal
    subscription instead of an institute's, and full-payment-only (no
    partial/installment support, matching this flow's B2C-only precedent)."""
    plan = plan_service.get_plan_or_404(db, plan_id)
    if not plan.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This plan is deactivated")

    discount, coupon = coupon_service.validate_and_price(db, coupon_code, plan.price, "plan", plan_id)
    final_amount = plan.price - discount

    payment = Payment(
        source="b2c",
        user_id=user_id,
        plan_id=plan_id,
        amount=plan.price,
        discount_amount=discount,
        final_amount=final_amount,
        amount_paid=final_amount,
        currency=plan.currency,
        coupon_id=coupon.id if coupon else None,
        gateway="manual",
        gateway_reference=gateway_reference,
        status=STATUS_PENDING,
    )
    db.add(payment)
    db.flush()
    _audit(db, None, "payment.create", payment.id, ip, {"plan": plan.name, "source": "b2c"})
    db.commit()

    gateway = get_gateway("manual")
    if not gateway.verify_payment(gateway_reference):
        payment.status = STATUS_FAILED
        db.add(payment)
        db.commit()
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Payment verification failed")

    payment.status = STATUS_PAID
    payment.paid_at = _now()
    payment.invoice_number = f"INV-{payment.id:06d}"
    db.add(payment)
    if coupon is not None:
        coupon_service.redeem(db, coupon)
    db.commit()

    subscription = subscription_service.subscribe_user(db, user_id, plan_id, ip)
    payment.subscription_id = subscription.id
    db.add(payment)
    db.commit()

    payment = _query_with_relations(db).filter(Payment.id == payment.id).first()
    return _serialize(payment)


def get_payment_or_404(db: Session, payment_id: int) -> Payment:
    payment = _query_with_relations(db).filter(Payment.id == payment_id).first()
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    return payment


def get_payment(db: Session, payment_id: int) -> dict:
    return _serialize(get_payment_or_404(db, payment_id))


def list_payments(
    db: Session,
    institute_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    search: Optional[str] = None,
) -> List[dict]:
    query = _query_with_relations(db)
    if institute_id is not None:
        query = query.filter(Payment.institute_id == institute_id)
    if status_filter is not None:
        query = query.filter(Payment.status == status_filter)
    if date_from is not None:
        query = query.filter(Payment.created_at >= date_from)
    if date_to is not None:
        query = query.filter(Payment.created_at <= date_to)
    if search:
        pattern = f"%{search}%"
        query = (
            query.outerjoin(Institute, Payment.institute_id == Institute.id)
            .outerjoin(Plan, Payment.plan_id == Plan.id)
            .filter(
                or_(
                    Payment.invoice_number.like(pattern),
                    Payment.gateway_reference.like(pattern),
                    Institute.name.like(pattern),
                    Plan.name.like(pattern),
                )
            )
        )
    payments = query.order_by(Payment.created_at.desc()).all()
    return [_serialize(p) for p in payments]
