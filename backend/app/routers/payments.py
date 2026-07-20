from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.schemas.payment import AddInstallmentRequest, RecordPaymentRequest
from app.services import payment_service

router = APIRouter(
    prefix="/super-admin/payments",
    tags=["payments"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.get("")
def list_payments(
    institute_id: Optional[int] = None,
    status: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return payment_service.list_payments(db, institute_id, status, date_from, date_to, search)


@router.post("", status_code=201)
def record_payment(
    payload: RecordPaymentRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    amount_received = Decimal(str(payload.amount_received)) if payload.amount_received is not None else None
    return payment_service.create_b2b_plan_payment(
        db,
        actor,
        payload.institute_id,
        payload.plan_id,
        payload.coupon_code,
        payload.gateway_reference,
        payload.payment_method_id,
        amount_received,
        _client_ip(request),
    )


@router.get("/{payment_id}")
def get_payment(payment_id: int, db: Session = Depends(get_db)):
    return payment_service.get_payment(db, payment_id)


@router.post("/{payment_id}/add-payment")
def add_installment(
    payment_id: int,
    payload: AddInstallmentRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return payment_service.add_installment(
        db, actor, payment_id, Decimal(str(payload.amount)), payload.payment_method_id, payload.reference, _client_ip(request)
    )
