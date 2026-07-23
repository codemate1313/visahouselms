from typing import List, Optional

from fastapi import APIRouter, Depends, File, Header, Request, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.auth_cookies import find_refresh_token, get_refresh_token
from app.dependencies.auth import get_current_user, require_role
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.schemas.auth import CurrentUser
from app.schemas.user import (
    ChangePasswordRequest,
    ForceResetRequest,
    ProfileUpdateRequest,
    RevokeOthersRequest,
    SessionOut,
    SuperAdminAccountCreate,
    SuperAdminAccountOut,
    SuperAdminAccountUpdate,
)
from app.services import account_service, super_admin_service

router = APIRouter(
    prefix="/super-admin",
    tags=["super-admin"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.get("/accounts", response_model=List[SuperAdminAccountOut])
def list_accounts(db: Session = Depends(get_db)):
    return super_admin_service.list_super_admins(db)


@router.get("/accounts/{account_id}", response_model=SuperAdminAccountOut)
def get_account(account_id: int, db: Session = Depends(get_db)):
    return super_admin_service.get_super_admin_or_404(db, account_id)


@router.post("/accounts", response_model=SuperAdminAccountOut, status_code=201)
def create_account(
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


@router.patch("/accounts/{account_id}", response_model=SuperAdminAccountOut)
def update_account(
    account_id: int,
    payload: SuperAdminAccountUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return super_admin_service.update_super_admin(
        db,
        actor,
        account_id,
        payload.email,
        payload.first_name,
        payload.last_name,
        _client_ip(request),
        dob=payload.dob,
        phone_number=payload.phone_number,
        address=payload.address,
        avatar_path=payload.avatar_path,
    )


@router.post("/accounts/{account_id}/deactivate", response_model=SuperAdminAccountOut)
def deactivate_account(
    account_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return super_admin_service.deactivate_super_admin(db, actor, account_id, _client_ip(request))


@router.post("/accounts/{account_id}/reactivate", response_model=SuperAdminAccountOut)
def reactivate_account(
    account_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return super_admin_service.reactivate_super_admin(db, actor, account_id, _client_ip(request))


@router.delete("/accounts/{account_id}", status_code=204)
def delete_account(
    account_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    super_admin_service.delete_super_admin(db, actor, account_id, _client_ip(request))


@router.post("/accounts/{account_id}/force-password-reset", response_model=SuperAdminAccountOut)
def force_password_reset(
    account_id: int,
    payload: ForceResetRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return super_admin_service.set_force_password_reset(
        db, actor, account_id, payload.enabled, _client_ip(request)
    )


@router.post("/me/change-password", status_code=204)
def change_my_password(
    payload: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    super_admin_service.change_password(
        db, actor, payload.current_password, payload.new_password, _client_ip(request)
    )


def _current_user_response(user: User) -> CurrentUser:
    return CurrentUser(
        id=user.id,
        email=user.email,
        role=user.role.name,
        institute_id=user.institute_id,
        first_name=user.first_name,
        last_name=user.last_name,
        force_password_reset=user.force_password_reset,
        avatar_url=account_service.avatar_url_for(user),
    )


@router.patch("/me/profile", response_model=CurrentUser)
def update_my_profile(
    payload: ProfileUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    user = account_service.update_profile(
        db, actor, payload.email, payload.first_name, payload.last_name, _client_ip(request)
    )
    return _current_user_response(user)


@router.post("/me/avatar", response_model=CurrentUser)
async def upload_my_avatar(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    user = await account_service.save_avatar(db, actor, file, _client_ip(request))
    return _current_user_response(user)


@router.post("/upload-avatar")
async def upload_account_avatar(
    file: UploadFile = File(...),
):
    return await account_service.save_temp_avatar(file)


@router.get("/me/sessions", response_model=List[SessionOut])
def list_my_sessions(
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
    x_refresh_token: Optional[str] = Header(default=None),
):
    return account_service.list_sessions(db, actor, find_refresh_token(request, x_refresh_token))


@router.delete("/me/sessions/{session_id}", status_code=204)
def revoke_my_session(
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    account_service.revoke_session(db, actor, session_id, _client_ip(request))


@router.post("/me/sessions/revoke-others")
def revoke_my_other_sessions(
    payload: RevokeOthersRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    revoked = account_service.revoke_other_sessions(
        db, actor, get_refresh_token(request, payload.refresh_token), _client_ip(request)
    )
    return {"revoked": revoked}
