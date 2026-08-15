import hashlib
import hmac
import traceback
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.payment import Payment
from app.services import payment_service, subscription_service
from app.services.log_service import record_error
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
    client_ip = request.client.host if request.client else None

    # Verification is unconditional. This previously ran only when BOTH the
    # secret and the header were present, so a caller could skip it entirely by
    # omitting the header - and an unverified webhook can mark an invoice paid
    # and switch on a paid subscription. A missing secret is a
    # misconfiguration, not a reason to trust the caller.
    if not webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Razorpay webhook secret is not configured",
        )
    if not x_razorpay_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Razorpay webhook signature",
        )
    expected_sig = hmac.new(
        webhook_secret.encode("utf-8"), raw_body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected_sig, x_razorpay_signature):
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
                        # `ip` is a required positional argument. Omitting it
                        # raised TypeError on every call, which the blanket
                        # except below swallowed - so no student subscription
                        # was ever activated through this webhook.
                        sub = subscription_service.subscribe_user(
                            db, payment.user_id, payment.plan_id, client_ip, commit=False
                        )
                        payment.subscription_id = sub.id
                        db.add(payment)

                    db.commit()
            except Exception as exc:
                # Answering 200 here told Razorpay the payment was handled, so
                # it never retried, and the failure left no trace: money taken
                # at the gateway, no subscription, nothing in the error log.
                # Record it and fail loudly so the gateway retries.
                db.rollback()
                try:
                    record_error(
                        db,
                        message=f"Razorpay webhook failed for payment {payment_id_str}: {exc}",
                        stack_trace=traceback.format_exc(),
                        path=request.url.path,
                        method=request.method,
                        user_id=None,
                        ip_address=client_ip,
                    )
                except Exception:
                    pass  # logging must never mask the original failure
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Webhook processing failed",
                ) from exc

    return {"status": "ok"}
