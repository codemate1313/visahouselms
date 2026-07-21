from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.schemas.auth import CurrentUser, LoginRequest, LogoutRequest, RefreshRequest, RegisterRequest, TokenResponse
from app.services import account_service, auth_service, institute_service
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    access_token, refresh_token = auth_service.login(
        db,
        payload.email,
        payload.password,
        request.headers.get("user-agent"),
        request.client.host if request.client else None,
        payload.device_id,
        payload.device_name,
    )
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    access_token, refresh_token = auth_service.register(
        db,
        payload.email,
        payload.password,
        payload.first_name,
        payload.last_name,
        request.headers.get("user-agent"),
        request.client.host if request.client else None,
        payload.device_id,
        payload.device_name,
    )
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    access_token, refresh_token = auth_service.refresh(
        db,
        payload.refresh_token,
        request.headers.get("user-agent"),
        request.client.host if request.client else None,
    )
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/logout", status_code=204)
def logout(payload: LogoutRequest, db: Session = Depends(get_db)):
    auth_service.logout(db, payload.refresh_token)


@router.get("/me", response_model=CurrentUser)
def me(user: User = Depends(get_current_user)):
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
        institute_permissions=(
            institute_service.normalized_admin_permissions(user.institute.admin_permissions)
            if user.institute and user.role.name == "INSTITUTE_ADMIN"
            else None
        ),
    )
