from typing import List, Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies.auth import get_current_user, require_verified_developer
from app.models.user import User
from app.schemas.user import (
    ChangePasswordRequest,
    DeveloperAccountCreate,
    DeveloperAccountUpdate,
    ForceResetRequest,
    SuperAdminAccountCreate,
    SuperAdminAccountOut,
)
from app.services import account_service, super_admin_service

router = APIRouter(
    prefix=f"/developer/{settings.developer_access_slug}",
    tags=["developer"],
    dependencies=[Depends(require_verified_developer)],
)


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.get("/accounts", response_model=List[SuperAdminAccountOut])
def list_accounts(db: Session = Depends(get_db)):
    return super_admin_service.list_developer_managed_accounts(db)


@router.post("/me/change-password", status_code=204)
def change_my_password(
    payload: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    if actor.force_password_reset:
        account_service.set_initial_password(db, actor, payload.new_password, _client_ip(request))
        return
    super_admin_service.change_password(
        db, actor, payload.current_password, payload.new_password, _client_ip(request)
    )


@router.post("/super-admins", response_model=SuperAdminAccountOut, status_code=201)
def create_super_admin(
    payload: SuperAdminAccountCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return super_admin_service.create_super_admin(
        db,
        actor,
        payload.email,
        payload.password,
        payload.first_name,
        payload.last_name,
        _client_ip(request),
        dob=payload.dob,
        phone_number=payload.phone_number,
        address=payload.address,
        avatar_path=payload.avatar_path,
    )


@router.post("/developers", response_model=SuperAdminAccountOut, status_code=201)
def create_developer(
    payload: DeveloperAccountCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return super_admin_service.create_developer(
        db,
        actor,
        payload.email,
        payload.password,
        payload.first_name,
        payload.last_name,
        _client_ip(request),
        verified=payload.is_developer_verified,
    )


@router.patch("/accounts/{account_id}", response_model=SuperAdminAccountOut)
def update_account(
    account_id: int,
    payload: DeveloperAccountUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return super_admin_service.update_developer_account(
        db,
        actor,
        account_id,
        payload.email,
        payload.first_name,
        payload.last_name,
        payload.is_developer_verified,
        _client_ip(request),
    )


@router.post("/accounts/{account_id}/force-password-reset", response_model=SuperAdminAccountOut)
def force_password_reset(
    account_id: int,
    payload: ForceResetRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return super_admin_service.set_managed_force_password_reset(
        db, actor, account_id, payload.enabled, _client_ip(request)
    )
