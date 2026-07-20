from typing import Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.schemas.payment import CouponCreate, CouponUpdate
from app.services import coupon_service

router = APIRouter(
    prefix="/super-admin/coupons",
    tags=["coupons"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.get("")
def list_coupons(
    search: Optional[str] = None,
    scope: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    return coupon_service.list_coupons(db, search, scope, is_active)


@router.post("", status_code=201)
def create_coupon(
    payload: CouponCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return coupon_service.create_coupon(db, actor, payload.model_dump(), _client_ip(request))


@router.get("/{coupon_id}")
def get_coupon(coupon_id: int, db: Session = Depends(get_db)):
    return coupon_service.get_coupon(db, coupon_id)


@router.patch("/{coupon_id}")
def update_coupon(
    coupon_id: int,
    payload: CouponUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return coupon_service.update_coupon(db, actor, coupon_id, payload.model_dump(exclude_unset=True), _client_ip(request))


@router.post("/{coupon_id}/deactivate")
def deactivate_coupon(
    coupon_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return coupon_service.set_coupon_active(db, actor, coupon_id, False, _client_ip(request))


@router.post("/{coupon_id}/reactivate")
def reactivate_coupon(
    coupon_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return coupon_service.set_coupon_active(db, actor, coupon_id, True, _client_ip(request))


@router.delete("/{coupon_id}", status_code=204)
def delete_coupon(
    coupon_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    coupon_service.delete_coupon(db, actor, coupon_id, _client_ip(request))
