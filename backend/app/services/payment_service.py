import hashlib
import hmac
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
import requests

from fastapi import HTTPException, status
from sqlalchemy import and_, or_

from sqlalchemy.orm import Session, joinedload

from app.core.payment_gateway import get_gateway
from app.models.audit_log import AuditLog
from app.models.coupon import Coupon
from app.models.institute import Institute
from app.models.payment import Payment
from app.models.plan import AUDIENCE_DIRECT, AUDIENCE_INSTITUTES, Plan
from app.models.user import User
from app.services import coupon_service, institute_service, plan_service, subscription_service
from app.services.settings_service import get_settings_group


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
    sub_data = None
    if payment.subscription:
        sub_data = {
            "id": payment.subscription.id,
            "starts_at": payment.subscription.starts_at,
            "expires_at": payment.subscription.expires_at,
            "grace_days": payment.subscription.grace_days,
            "status": subscription_service.state_of_subscription(payment.subscription),
        }
    return {
        "id": payment.id,
        "source": payment.source,
        "institute_id": payment.institute_id,
        "institute_name": (
            payment.institute.name if payment.institute else payment.institute_name_snapshot
        ),
        "user_id": payment.user_id,
        "plan_id": payment.plan_id,
        "plan_name": payment.plan.name if payment.plan else None,
        "validity_days": payment.plan.duration_days if payment.plan else None,
        "course_id": payment.course_id,

        "amount": str(payment.amount),
        "discount_amount": str(payment.discount_amount),
        "subtotal_amount": str(payment.subtotal_amount or 0),
        "gst_rate_id": payment.gst_rate_id,
        "gst_percentage": str(payment.gst_percentage or 0),
        "gst_tax_type": payment.gst_tax_type or "exclusive",
        "gst_amount": str(payment.gst_amount or 0),
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
        "subscription": sub_data,
        "invoice_number": payment.invoice_number,
        "created_at": payment.created_at,
        "paid_at": payment.paid_at,
    }


def calculate_gst_and_totals(plan, discount: Decimal = Decimal("0.00")) -> dict:
    base_price = Decimal(str(plan.price))
    discount_val = Decimal(str(discount))
    taxable_before_gst = max(Decimal("0.00"), base_price - discount_val)

    gst_rate = plan.gst_rate
    if not gst_rate or not gst_rate.is_active or gst_rate.percentage <= 0:
        return {
            "gst_rate_id": gst_rate.id if gst_rate else None,
            "gst_percentage": Decimal("0.00"),
            "gst_tax_type": "exclusive",
            "subtotal_amount": taxable_before_gst,
            "gst_amount": Decimal("0.00"),
            "final_amount": taxable_before_gst,
        }

    pct = Decimal(str(gst_rate.percentage))
    tax_type = gst_rate.tax_type or "exclusive"

    if tax_type == "inclusive":
        final_total = taxable_before_gst
        subtotal = (final_total / (Decimal("1.00") + (pct / Decimal("100.00")))).quantize(Decimal("0.01"))
        gst_amt = (final_total - subtotal).quantize(Decimal("0.01"))
    else:  # exclusive
        subtotal = taxable_before_gst
        gst_amt = (subtotal * (pct / Decimal("100.00"))).quantize(Decimal("0.01"))
        final_total = (subtotal + gst_amt).quantize(Decimal("0.01"))

    return {
        "gst_rate_id": gst_rate.id,
        "gst_percentage": pct,
        "gst_tax_type": tax_type,
        "subtotal_amount": subtotal,
        "gst_amount": gst_amt,
        "final_amount": final_total,
    }



def _query_with_relations(db: Session):
    return db.query(Payment).options(
        joinedload(Payment.institute),
        joinedload(Payment.plan),
        joinedload(Payment.coupon),
        joinedload(Payment.payment_method),
        joinedload(Payment.subscription),
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
    renew_if_current: bool = False,
) -> dict:
    institute = institute_service.get_institute_or_404(db, institute_id)
    plan = plan_service.get_plan_or_404(db, plan_id)
    plan_service.assert_audience(plan, AUDIENCE_INSTITUTES)
    if not plan.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This plan is deactivated")

    coupon_email = institute.contact_email or f"institute-{institute_id}@internal.local"
    discount, coupon = coupon_service.validate_and_price(db, coupon_code, plan.price, "plan", plan_id, coupon_email)
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
        coupon_service.redeem(db, coupon, coupon_email, payment_id=payment.id)

    _audit(
        db, actor, "payment.create", payment.id, ip,
        {"institute_id": institute_id, "plan": plan.name, "status": payment_status},
    )

    # Subscription activates immediately on any recorded payment (partial or
    # full). Institute self-service renews the current plan from its existing
    # expiry; Super Admin plan changes retain the established assign behavior.
    try:
        current, current_state = subscription_service.current_subscription(db, institute_id)
        if (
            renew_if_current
            and current is not None
            and current.plan_id == plan_id
            and current_state in (subscription_service.STATE_ACTIVE, subscription_service.STATE_GRACE)
        ):
            subscription = subscription_service.renew(
                db, actor, institute_id, plan_id, ip, commit=False
            )
        else:
            subscription = subscription_service.assign(
                db, actor, institute_id, plan_id, None, ip, commit=False
            )
        payment.subscription_id = subscription["id"]
        db.add(payment)
        db.commit()
    except Exception:
        db.rollback()
        raise

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
    plan_service.assert_audience(plan, AUDIENCE_DIRECT)
    if not plan.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This plan is deactivated")

    buyer = db.query(User).filter(User.id == user_id).first()
    discount, coupon = coupon_service.validate_and_price(db, coupon_code, plan.price, "plan", plan_id, buyer.email)
    gst_calc = calculate_gst_and_totals(plan, discount)

    payment = Payment(
        source="b2c",
        user_id=user_id,
        plan_id=plan_id,
        amount=plan.price,
        discount_amount=discount,
        subtotal_amount=gst_calc["subtotal_amount"],
        gst_rate_id=gst_calc["gst_rate_id"],
        gst_percentage=gst_calc["gst_percentage"],
        gst_tax_type=gst_calc["gst_tax_type"],
        gst_amount=gst_calc["gst_amount"],
        final_amount=gst_calc["final_amount"],
        amount_paid=gst_calc["final_amount"],
        currency=plan.currency,
        coupon_id=coupon.id if coupon else None,
        gateway="manual",
        gateway_reference=gateway_reference,
        status=STATUS_PENDING,
    )

    db.add(payment)
    db.flush()
    _audit(db, None, "payment.create", payment.id, ip, {"plan": plan.name, "source": "b2c"})

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
    try:
        if coupon is not None:
            coupon_service.redeem(db, coupon, buyer.email, user_id=user_id, payment_id=payment.id)
        subscription = subscription_service.subscribe_user(
            db, user_id, plan_id, ip, commit=False
        )
        payment.subscription_id = subscription.id
        db.add(payment)
        db.commit()
    except Exception:
        db.rollback()
        raise

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
                    Payment.institute_name_snapshot.like(pattern),
                    Plan.name.like(pattern),
                )
            )
        )
    payments = query.order_by(Payment.created_at.desc()).all()
    return [_serialize(p) for p in payments]


def list_user_payments(db: Session, user_id: int) -> List[dict]:
    query = _query_with_relations(db).filter(
        Payment.user_id == user_id,
        or_(
            Payment.status == STATUS_PAID,
            and_(
                Payment.status == STATUS_PENDING,
                Payment.gateway_reference.isnot(None),
                Payment.gateway_reference != "",
            ),
        ),
    )
    payments = query.order_by(Payment.created_at.desc()).all()
    return [_serialize(p) for p in payments]



def get_user_payment_invoice(db: Session, user_id: int, payment_id: int) -> dict:
    payment = _query_with_relations(db).filter(Payment.id == payment_id, Payment.user_id == user_id).first()
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment invoice not found")
    data = _serialize(payment)
    user = payment.user
    if user:
        data["user_details"] = {
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "id": user.id,
        }
    return data


def get_public_payment_config(db: Session) -> dict:
    gw_settings = get_settings_group(db, "payment_gateways", mask_secrets=True)
    return {
        "razorpay_enabled": gw_settings.get("razorpay_enabled") == "true",
        "razorpay_key_id": gw_settings.get("razorpay_key_id") if gw_settings.get("razorpay_enabled") == "true" else None,
        "stripe_enabled": gw_settings.get("stripe_enabled") == "true",
        "stripe_publishable_key": gw_settings.get("stripe_publishable_key") if gw_settings.get("stripe_enabled") == "true" else None,
    }


def create_user_plan_order(
    db: Session,
    user_id: int,
    plan_id: int,
    coupon_code: Optional[str],
    ip: Optional[str] = None,
    target_currency: Optional[str] = None,
) -> dict:
    plan = plan_service.get_plan_or_404(db, plan_id)
    plan_service.assert_audience(plan, AUDIENCE_DIRECT)
    if not plan.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This plan is deactivated")

    buyer = db.query(User).filter(User.id == user_id).first()

    # Resolve currency: USD if requested or plan is international-only, otherwise plan default (INR)
    requested_currency = (target_currency or plan.currency or "INR").upper()
    is_usd = requested_currency == "USD" and plan.is_international_enabled and plan.usd_price is not None
    effective_currency = "USD" if is_usd else (plan.currency or "INR").upper()
    effective_base_price = plan.usd_price if is_usd else plan.price

    gw_settings = get_settings_group(db, "payment_gateways", mask_secrets=False)

    # 1. Stripe Checkout for USD / International
    if is_usd:
        stripe_enabled = gw_settings.get("stripe_enabled") == "true"
        secret_key = gw_settings.get("stripe_secret_key")
        if not stripe_enabled or not secret_key:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stripe payment gateway is not configured for international USD payments.")

        discount, coupon = coupon_service.validate_and_price(db, coupon_code, effective_base_price, "plan", plan_id, buyer.email)
        final_amount = effective_base_price - discount

        payment = Payment(
            source="b2c",
            user_id=user_id,
            plan_id=plan_id,
            amount=effective_base_price,
            discount_amount=discount,
            subtotal_amount=final_amount,
            gst_rate_id=None,
            gst_percentage=Decimal("0.00"),
            gst_tax_type="exclusive",
            gst_amount=Decimal("0.00"),
            final_amount=final_amount,
            amount_paid=Decimal("0.00"),
            currency="USD",
            coupon_id=coupon.id if coupon else None,
            gateway="stripe",
            status=STATUS_PENDING,
        )
        db.add(payment)
        db.flush()

        stripe_gw = get_gateway("stripe", secret_key=secret_key)
        stripe_order = stripe_gw.create_order(
            amount=final_amount,
            currency="usd",
            meta={
                "payment_id": payment.id,
                "plan_id": plan_id,
                "user_id": user_id,
                "plan_name": plan.name,
            },
        )

        payment.gateway_reference = stripe_order["id"]
        db.add(payment)
        db.commit()

        return {
            "online_payment": True,
            "gateway": "stripe",
            "payment_intent_id": stripe_order["id"],
            "client_secret": stripe_order["client_secret"],
            "publishable_key": gw_settings.get("stripe_publishable_key"),
            "amount": stripe_order["amount"],
            "currency": "USD",
            "plan_name": plan.name,
            "payment_id": payment.id,
        }

    # 2. Razorpay Checkout for Domestic INR
    razorpay_enabled = gw_settings.get("razorpay_enabled") == "true"
    key_id = gw_settings.get("razorpay_key_id")
    key_secret = gw_settings.get("razorpay_key_secret")

    # If Razorpay is NOT enabled or missing credentials, fallback to instant purchase
    if not razorpay_enabled or not key_id or not key_secret:
        payment_result = create_user_plan_payment(db, user_id, plan_id, coupon_code, None, ip)
        return {
            "online_payment": False,
            "payment": payment_result,
        }

    discount, coupon = coupon_service.validate_and_price(db, coupon_code, plan.price, "plan", plan_id, buyer.email)
    gst_calc = calculate_gst_and_totals(plan, discount)
    final_amount = gst_calc["final_amount"]
    amount_paise = int(final_amount * 100)

    payment = Payment(
        source="b2c",
        user_id=user_id,
        plan_id=plan_id,
        amount=plan.price,
        discount_amount=discount,
        subtotal_amount=gst_calc["subtotal_amount"],
        gst_rate_id=gst_calc["gst_rate_id"],
        gst_percentage=gst_calc["gst_percentage"],
        gst_tax_type=gst_calc["gst_tax_type"],
        gst_amount=gst_calc["gst_amount"],
        final_amount=final_amount,
        amount_paid=Decimal("0.00"),
        currency=plan.currency or "INR",
        coupon_id=coupon.id if coupon else None,
        gateway="razorpay",
        status=STATUS_PENDING,
    )

    db.add(payment)
    db.flush()

    try:
        res = requests.post(
            "https://api.razorpay.com/v1/orders",
            auth=(key_id, key_secret),
            json={
                "amount": amount_paise,
                "currency": (plan.currency or "INR").upper(),
                "receipt": f"rcpt_{payment.id}",
                "notes": {
                    "plan_id": str(plan_id),
                    "user_id": str(user_id),
                    "payment_id": str(payment.id),
                },
            },
            timeout=10,
        )
        if res.status_code != 200:
            err_msg = res.json().get("error", {}).get("description", "Razorpay order creation failed")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Razorpay error: {err_msg}")
        
        order_data = res.json()
        payment.gateway_reference = order_data["id"]
        db.add(payment)
        db.commit()
    except requests.RequestException as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Failed to connect to Razorpay: {str(e)}")

    return {
        "online_payment": True,
        "gateway": "razorpay",
        "order_id": order_data["id"],
        "key_id": key_id,
        "amount": amount_paise,
        "currency": (plan.currency or "INR").upper(),
        "plan_name": plan.name,
        "payment_id": payment.id,
    }


def verify_stripe_payment(
    db: Session,
    user_id: int,
    payment_id: int,
    payment_intent_id: str,
    ip: Optional[str] = None,
) -> dict:
    payment = get_payment_or_404(db, payment_id)
    if payment.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Payment does not belong to user")
    if payment.status == STATUS_PAID:
        return _serialize(payment)

    gw_settings = get_settings_group(db, "payment_gateways", mask_secrets=False)
    secret_key = gw_settings.get("stripe_secret_key")
    if not secret_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stripe secret key not configured")

    stripe_gw = get_gateway("stripe", secret_key=secret_key)
    if not stripe_gw.verify_payment(payment_intent_id):
        payment.status = STATUS_FAILED
        db.add(payment)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stripe payment verification failed or pending")

    payment.status = STATUS_PAID
    payment.paid_at = _now()
    payment.amount_paid = payment.final_amount
    payment.gateway_reference = payment_intent_id
    payment.invoice_number = f"INV-{payment.id:06d}"
    db.add(payment)

    try:
        if payment.coupon_id:
            coupon = db.query(Coupon).filter(Coupon.id == payment.coupon_id).first()
            if coupon:
                buyer = db.query(User).filter(User.id == user_id).first()
                coupon_service.redeem(db, coupon, buyer.email, user_id=user_id, payment_id=payment.id)

        subscription = subscription_service.subscribe_user(
            db, user_id, payment.plan_id, ip, commit=False
        )
        payment.subscription_id = subscription.id
        db.add(payment)
        db.commit()
    except Exception:
        db.rollback()
        raise

    payment = _query_with_relations(db).filter(Payment.id == payment.id).first()
    return _serialize(payment)


def verify_razorpay_payment(
    db: Session,
    user_id: int,
    payment_id: int,
    razorpay_payment_id: str,
    razorpay_order_id: str,
    razorpay_signature: str,
    ip: Optional[str] = None,
) -> dict:
    payment = get_payment_or_404(db, payment_id)
    if payment.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Payment does not belong to user")
    if payment.status == STATUS_PAID:
        return _serialize(payment)

    gw_settings = get_settings_group(db, "payment_gateways", mask_secrets=False)
    key_secret = gw_settings.get("razorpay_key_secret")
    if not key_secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Razorpay secret key not configured")

    msg = f"{razorpay_order_id}|{razorpay_payment_id}"
    expected_signature = hmac.new(
        key_secret.encode("utf-8"),
        msg.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    if expected_signature != razorpay_signature:
        payment.status = STATUS_FAILED
        db.add(payment)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payment signature from Razorpay")

    # Payment verified!
    payment.status = STATUS_PAID
    payment.paid_at = _now()
    payment.amount_paid = payment.final_amount
    payment.gateway_reference = f"Order: {razorpay_order_id} | Payment: {razorpay_payment_id}"
    payment.invoice_number = f"INV-{payment.id:06d}"
    db.add(payment)


    try:
        if payment.coupon_id:
            coupon = db.query(Coupon).filter(Coupon.id == payment.coupon_id).first()
            if coupon:
                buyer = db.query(User).filter(User.id == user_id).first()
                coupon_service.redeem(db, coupon, buyer.email, user_id=user_id, payment_id=payment.id)

        subscription = subscription_service.subscribe_user(
            db, user_id, payment.plan_id, ip, commit=False
        )
        payment.subscription_id = subscription.id
        db.add(payment)
        db.commit()
    except Exception:
        db.rollback()
        raise

    payment = _query_with_relations(db).filter(Payment.id == payment.id).first()
    return _serialize(payment)



