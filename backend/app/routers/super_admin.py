from typing import List, Optional

from fastapi import APIRouter, Depends, File, Header, Query, Request, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.auth_cookies import find_refresh_token, get_refresh_token
from app.dependencies.auth import get_current_user, require_role
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.schemas.auth import CurrentUser
from app.schemas.user import (
    ChangePasswordRequest,
    DirectoryUserPage,
    ForceResetRequest,
    ProfileUpdateRequest,
    RevokeOthersRequest,
    SessionOut,
    SuperAdminAccountCreate,
    SuperAdminAccountOut,
    SuperAdminAccountUpdate,
)
from app.services import account_service, ai_evaluation_service, settings_service, super_admin_service

router = APIRouter(
    prefix="/super-admin",
    tags=["super-admin"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.get("/users", response_model=DirectoryUserPage)
def list_directory_users(
    role: Optional[str] = Query(default=None, max_length=40),
    q: Optional[str] = Query(default=None, max_length=200),
    status: Optional[str] = Query(default=None, pattern="^(active|inactive)$"),
    institute_id: Optional[int] = Query(default=None, ge=1),
    direct: Optional[bool] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Cross-institute directory backing the tabbed Users screen. Every role is
    read through one shape here; the per-role endpoints below remain the place
    where accounts are created and edited."""
    return super_admin_service.list_directory_users(
        db,
        role=role,
        search=q,
        status_filter=status,
        institute_id=institute_id,
        direct=direct,
        page=page,
        page_size=page_size,
    )


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
        institute_slug=user.institute.slug if user.institute else None,
        first_name=user.first_name,
        last_name=user.last_name,
        force_password_reset=user.force_password_reset,
        avatar_url=account_service.avatar_url_for(user),
        is_owner=user.is_owner,
        is_developer_verified=user.is_developer_verified,
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


@router.get("/settings/ai")
def get_ai_settings(db: Session = Depends(get_db)):
    return ai_evaluation_service.config_status(db)


@router.put("/settings/ai")
def update_ai_settings(
    payload: dict,
    db: Session = Depends(get_db),
):
    enabled = payload.get("enabled", True)
    provider = payload.get("provider", "gemini")
    model = payload.get("model", "gemini-1.5-flash")
    api_key = payload.get("api_key")
    endpoint_url = payload.get("endpoint_url")
    monthly_limit = payload.get("monthly_limit", 100)

    settings_service.set_setting(db, "ai.enabled", "true" if enabled else "false")
    settings_service.set_setting(db, "ai.provider", str(provider))
    settings_service.set_setting(db, "ai.model", str(model))
    if api_key and api_key != "********":
        settings_service.set_setting(db, "ai.api_key", str(api_key))
    if endpoint_url is not None:
        settings_service.set_setting(db, "ai.endpoint_url", str(endpoint_url))
    settings_service.set_setting(db, "ai.monthly_limit", str(monthly_limit))

    return ai_evaluation_service.config_status(db)

