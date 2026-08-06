from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import BaseModel, Field
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
from app.services import (
    account_service,
    developer_analytics_service,
    developer_directory_service,
    maintenance_admin_service,
    super_admin_service,
)


class MaintenanceUpdate(BaseModel):
    enabled: bool
    message: Optional[str] = Field(default=None, max_length=280)
    # Required when enabling; verified against the stored shutdown-password hash.
    password: Optional[str] = Field(default=None, max_length=200)


class KillPasswordUpdate(BaseModel):
    new_password: str = Field(min_length=8, max_length=200)
    # Required only when a password already exists.
    current_password: Optional[str] = Field(default=None, max_length=200)

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


@router.post("/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
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


@router.post("/super-admins", response_model=SuperAdminAccountOut, status_code=status.HTTP_201_CREATED)
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
        can_view_monetary_analytics=False,
    )


@router.post("/developers", response_model=SuperAdminAccountOut, status_code=status.HTTP_201_CREATED)
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


# ---- Platform analytics -------------------------------------------------

@router.get("/analytics/overview")
def analytics_overview(
    traffic_days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    """Money, people and traffic across every tenant, in one payload."""
    return developer_analytics_service.overview(db, traffic_days=traffic_days)


# ---- Elevated access control -------------------------------------------
# The listing lives on the shared Users screen; only the elevated revoke and
# restore are here, because they act on accounts (Super Admins, the owner) that
# the Super Admin's own directory refuses to touch.

@router.post("/users/{user_id}/revoke")
def revoke_user_access(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    """Deactivate an account and end its sessions. Audited."""
    return developer_directory_service.revoke_access(db, actor, user_id, _client_ip(request))


@router.post("/users/{user_id}/restore")
def restore_user_access(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    """Lift a revoke. Audited."""
    return developer_directory_service.restore_access(db, actor, user_id, _client_ip(request))


# ---- Maintenance kill switch --------------------------------------------

@router.get("/maintenance")
def get_maintenance(db: Session = Depends(get_db)):
    return maintenance_admin_service.get_state(db)


@router.put("/maintenance")
def set_maintenance(
    payload: MaintenanceUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    """Open or close the whole platform. Audited with the actor and state.

    Closing requires the shutdown password; reopening does not. The developer
    role stays exempt from the gate this flips, so closing the site never locks
    the person who closed it out of reopening it.
    """
    return maintenance_admin_service.set_state(
        db, actor, payload.enabled, payload.message, payload.password, _client_ip(request)
    )


@router.put("/maintenance/password")
def set_maintenance_password(
    payload: KillPasswordUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    """Set or change the shutdown password. Stored only as a high-cost hash."""
    return maintenance_admin_service.set_kill_password(
        db, actor, payload.new_password, payload.current_password, _client_ip(request)
    )
