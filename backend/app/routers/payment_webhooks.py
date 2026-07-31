import hashlib
import hmac
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.payment import Payment
from app.services import payment_service, subscription_service
from app.services.settings_service import get_settings_group

router = APIRouter(prefix="/api/v1/payments/webhook", tags=["payment-webhooks"])


@router.post("/razorpay")
async def razorpay_webhook(

    request: Request,
    db: Session = Depends(get_db),
    x_razorpay_signature: Optional[str] = Header(None, alias="X-Razorpay-Signature"),
):
    raw_body = await request.body()
    gw_settings = get_settings_group(db, "payment_gateways", mask_secrets=False)
    webhook_secret = gw_settings.get("razorpay_webhook_secret")

    if webhook_secret and x_razorpay_signature:
        expected_sig = hmac.new(
            webhook_secret.encode("utf-8"), raw_body, hashlib.sha256
        ).hexdigest()
        if expected_sig != x_razorpay_signature:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Razorpay webhook signature",
            )

    try:
        data = await request.json()
    except Exception:
        return {"status": "ignored"}

    event = data.get("event")
    if event in ("payment.captured", "order.paid"):
        entity = data.get("payload", {}).get("payment", {}).get("entity", {})
        notes = entity.get("notes", {})
        payment_id_str = notes.get("payment_id")
        razorpay_payment_id = entity.get("id")

        if payment_id_str:
            try:
                payment_id = int(payment_id_str)
                payment = db.query(Payment).filter(Payment.id == payment_id).first()
                if payment and payment.status != payment_service.STATUS_PAID:
                    payment.status = payment_service.STATUS_PAID
                    payment.paid_at = payment_service._now()
                    payment.amount_paid = payment.final_amount
                    payment.gateway_reference = razorpay_payment_id
                    payment.invoice_number = f"INV-{payment.id:06d}"
                    db.add(payment)

                    if payment.user_id:
                        sub = subscription_service.subscribe_user(
                            db, payment.user_id, payment.plan_id, commit=False
                        )
                        payment.subscription_id = sub.id
                        db.add(payment)

                    db.commit()
            except Exception:
                db.rollback()

    return {"status": "ok"}
