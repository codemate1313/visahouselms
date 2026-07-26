from typing import Optional
from uuid import uuid4

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.core.auth_cookies import clear_refresh_cookie, get_refresh_token, set_refresh_cookie
from app.core.security import TOKEN_TYPE_LOGIN_OTP, create_login_otp_token, decode_token
from app.core.rate_limit import enforce_rate_limit
from app.dependencies.auth import get_current_user
from app.schemas.auth import (
    CurrentUser,
    ForgotPasswordRequest,
    GoogleOtpRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyOtpRequest,
)
from app.services import account_service, auth_service, institute_service, smtp_service
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])

DEVICE_COOKIE = "ielts_lms_device"


def _device_identifier(request: Request, response: Response, supplied: Optional[str]) -> str:
    identifier = supplied or request.cookies.get(DEVICE_COOKIE) or uuid4().hex
    response.set_cookie(
        DEVICE_COOKIE,
        identifier,
        max_age=settings.refresh_token_expire_minutes * 60,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite=settings.refresh_cookie_samesite,
        path="/",
    )
    return identifier


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


def _send_login_otp(db: Session, email: str) -> bool:
    subject = "IELTS LMS login OTP"
    body = (
        f"Your IELTS LMS login OTP is {settings.login_otp_code}.\n\n"
        f"This code expires in {settings.login_otp_expire_minutes} minutes."
    )
    html = (
        "<p>Your IELTS LMS login OTP is:</p>"
        f"<p style='font-size:28px;font-weight:700;letter-spacing:6px'>{settings.login_otp_code}</p>"
        f"<p>This code expires in {settings.login_otp_expire_minutes} minutes.</p>"
    )
    try:
        smtp_service.send_email(db, email, subject, body, html)
        return True
    except HTTPException:
        # Local/demo environments often do not have SMTP configured. Keep the
        # test-only fixed OTP flow usable while production SMTP is being wired.
        return False


def _otp_challenge_for(
    db: Session,
    user: User,
    payload: LoginRequest | GoogleOtpRequest,
    auth_method: str,
) -> TokenResponse:
    sent = _send_login_otp(db, user.email)
    challenge = create_login_otp_token(
        user.id,
        user.role.name,
        user.institute_id,
        auth_method,
        payload.remember_me,
        payload.device_id,
        payload.device_name,
    )
    return TokenResponse(
        otp_required=True,
        otp_challenge_id=challenge,
        otp_delivery="email" if sent else "test",
        message="OTP sent to your registered email." if sent else "Use the fixed test OTP to continue.",
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    device_identifier = _device_identifier(request, response, payload.device_id)
    user = auth_service.authenticate_login_user(
        db,
        payload.email,
        payload.password,
        _client_ip(request),
    )
    payload.device_id = device_identifier
    return _otp_challenge_for(db, user, payload, "password")


@router.post("/google/request-otp", response_model=TokenResponse)
def google_request_otp(payload: GoogleOtpRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    device_identifier = _device_identifier(request, response, payload.device_id)
    user = auth_service.get_otp_login_user(db, payload.email, _client_ip(request))
    payload.device_id = device_identifier
    return _otp_challenge_for(db, user, payload, "google_otp")


@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(payload: VerifyOtpRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    try:
        challenge = decode_token(payload.challenge_id)
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired OTP challenge")

    if challenge.get("type") != TOKEN_TYPE_LOGIN_OTP:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired OTP challenge")

    if payload.otp_code.strip() != settings.login_otp_code:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid OTP code")

    try:
        user_id = int(challenge["sub"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired OTP challenge")

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired OTP challenge")

    access_token, refresh_token = auth_service.issue_login_session(
        db,
        user,
        request.headers.get("user-agent"),
        _client_ip(request),
        challenge.get("device_identifier"),
        challenge.get("device_name"),
        challenge.get("auth_method", "password"),
    )
    set_refresh_cookie(response, refresh_token, persistent=bool(challenge.get("remember_me", True)))
    return TokenResponse(access_token=access_token)


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(payload: RegisterRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    enforce_rate_limit(
        f"register:{client_ip}",
        settings.registration_rate_limit,
        settings.registration_rate_window_seconds,
    )
    device_identifier = _device_identifier(request, response, payload.device_id)
    access_token, refresh_token = auth_service.register(
        db,
        payload.email,
        payload.password,
        payload.first_name,
        payload.last_name,
        request.headers.get("user-agent"),
        client_ip,
        device_identifier,
        payload.device_name,
    )
    set_refresh_cookie(response, refresh_token)
    return TokenResponse(access_token=access_token)


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    presented_token = get_refresh_token(request, payload.refresh_token)
    access_token, refresh_token = auth_service.refresh(
        db,
        presented_token,
        request.headers.get("user-agent"),
        request.client.host if request.client else None,
    )
    set_refresh_cookie(response, refresh_token)
    return TokenResponse(access_token=access_token)


@router.post("/logout", status_code=204)
def logout(payload: LogoutRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    token = payload.refresh_token or request.cookies.get(settings.refresh_cookie_name)
    if token:
        auth_service.logout(db, token)
    clear_refresh_cookie(response)


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
        is_owner=user.is_owner,
        is_developer_verified=user.is_developer_verified,
        institute_permissions=(
            institute_service.normalized_admin_permissions(user.institute.admin_permissions)
            if user.institute and user.role.name == "INSTITUTE_ADMIN"
            else None
        ),
    )


@router.post("/forgot-password", status_code=202)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    auth_service.request_password_reset(db, payload.email)
    return {"message": "If an active account exists for this email, a password reset link has been sent."}


@router.post("/reset-password", status_code=200)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    auth_service.confirm_password_reset(db, payload.token, payload.new_password)
    return {"message": "Password updated successfully. You can now log in with your new password."}
