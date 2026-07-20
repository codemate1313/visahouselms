from typing import Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.schemas.payment import PaymentMethodCreate
from app.services import payment_method_service

router = APIRouter(
    prefix="/super-admin/payment-methods",
    tags=["payment-methods"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.get("")
def list_methods(active_only: bool = False, db: Session = Depends(get_db)):
    return payment_method_service.list_methods(db, active_only)


@router.post("", status_code=201)
def create_method(
    payload: PaymentMethodCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return payment_method_service.create_method(db, actor, payload.name, _client_ip(request))


@router.post("/{method_id}/deactivate")
def deactivate_method(
    method_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return payment_method_service.set_method_active(db, actor, method_id, False, _client_ip(request))


@router.post("/{method_id}/reactivate")
def reactivate_method(
    method_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return payment_method_service.set_method_active(db, actor, method_id, True, _client_ip(request))


@router.delete("/{method_id}", status_code=204)
def delete_method(
    method_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    payment_method_service.delete_method(db, actor, method_id, _client_ip(request))
