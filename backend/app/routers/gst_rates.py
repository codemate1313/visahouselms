from typing import Optional

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_monetary_analytics_access, require_role
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.schemas.gst_rate import GstRateCreate, GstRateUpdate
from app.services import gst_service

router = APIRouter(
    prefix="/super-admin/gst-rates",
    tags=["gst-rates"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.get("")
def list_gst_rates(active_only: bool = False, db: Session = Depends(get_db)):
    return gst_service.list_gst_rates(db, active_only)


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_monetary_analytics_access)])
def create_gst_rate(
    payload: GstRateCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return gst_service.create_gst_rate(db, actor, payload.model_dump(), _client_ip(request))


@router.patch("/{rate_id}", dependencies=[Depends(require_monetary_analytics_access)])
def update_gst_rate(
    rate_id: int,
    payload: GstRateUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return gst_service.update_gst_rate(db, actor, rate_id, payload.model_dump(exclude_unset=True), _client_ip(request))


@router.post("/{rate_id}/toggle-active")
def toggle_gst_rate_active(
    rate_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return gst_service.toggle_gst_rate_active(db, actor, rate_id, _client_ip(request))


@router.delete("/{rate_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_monetary_analytics_access)])
def delete_gst_rate(
    rate_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    gst_service.delete_gst_rate(db, actor, rate_id, _client_ip(request))
