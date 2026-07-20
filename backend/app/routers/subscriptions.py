from typing import Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.schemas.plan import AssignSubscriptionRequest, RenewSubscriptionRequest
from app.services import subscription_service

router = APIRouter(
    prefix="/super-admin",
    tags=["subscriptions"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.get("/institutes/{institute_id}/subscription")
def get_subscription_status(institute_id: int, db: Session = Depends(get_db)):
    return subscription_service.subscription_status(db, institute_id)


@router.post("/institutes/{institute_id}/subscription", status_code=201)
def assign_subscription(
    institute_id: int,
    payload: AssignSubscriptionRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return subscription_service.assign(
        db, actor, institute_id, payload.plan_id, payload.starts_at, _client_ip(request)
    )


@router.post("/institutes/{institute_id}/subscription/renew", status_code=201)
def renew_subscription(
    institute_id: int,
    payload: RenewSubscriptionRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return subscription_service.renew(db, actor, institute_id, payload.plan_id, _client_ip(request))


@router.get("/institutes/{institute_id}/subscriptions")
def subscription_history(institute_id: int, db: Session = Depends(get_db)):
    return subscription_service.history(db, institute_id)


@router.post("/subscriptions/{subscription_id}/cancel")
def cancel_subscription(
    subscription_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return subscription_service.cancel(db, actor, subscription_id, _client_ip(request))
