import logging
from typing import Optional, Union
from urllib.parse import urlencode
from uuid import uuid4

import jwt
import requests
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.core.auth_cookies import clear_refresh_cookie, get_refresh_token, set_refresh_cookie
from app.core.security import (
    TOKEN_TYPE_GOOGLE_OAUTH_STATE,
    TOKEN_TYPE_LOGIN_OTP,
    create_google_oauth_state_token,
    create_login_otp_token,
    decode_token,
    generate_login_otp_code,
    hash_login_otp_code,
    verify_login_otp_code,
)
from app.core.rate_limit import clear_rate_limit, enforce_rate_limit
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
from app.services import account_service, auth_service, email_template_service, institute_service, smtp_service, totp_service
from app.models.role import DEVELOPER
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])

DEVICE_COOKIE = "ielts_lms_device"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


def _set_device_cookie(response: Response, identifier: str) -> None:
    response.set_cookie(
        DEVICE_COOKIE,
        identifier,
        max_age=settings.refresh_token_expire_minutes * 60,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite=settings.refresh_cookie_samesite,
        path="/",
    )


def _device_identifier(request: Request, response: Response, supplied: Optional[str]) -> str:
    identifier = supplied or request.cookies.get(DEVICE_COOKIE) or uuid4().hex
    _set_device_cookie(response, identifier)
    return identifier


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


def _rate_limit_ip(request: Request) -> str:
    return _client_ip(request) or "unknown"


def _limit_login_attempt(request: Request, email: str) -> None:
    """Throttles credential guessing per IP and per targeted account, so
    rotating either one alone does not buy an attacker extra attempts."""
    enforce_rate_limit(
        f"login-ip:{_rate_limit_ip(request)}",
        settings.login_rate_limit,
        settings.login_rate_window_seconds,
        "Too many login attempts. Please try again later.",
    )
    enforce_rate_limit(
        f"login-email:{email.strip().lower()}",
        settings.login_rate_limit,
        settings.login_rate_window_seconds,
        "Too many login attempts. Please try again later.",
    )


def _send_login_otp(db: Session, user: User, otp_code: str) -> None:
    # With a fixed local OTP the mail is redundant, and requiring SMTP would
    # otherwise make local sign-in impossible. Production still treats a failed
    # send as fatal, because there the code only reaches the user by email.
    if settings.dev_static_otp_code and settings.app_environment != "production":
        logging.getLogger(__name__).warning(
            "DEV_STATIC_OTP_CODE is active - skipping OTP email for %s, use code %s",
            user.email,
            otp_code,
        )
        return

    subject, plain, html = email_template_service.render_login_otp_email(
        user.first_name or "there",
        otp_code,
        settings.login_otp_expire_minutes,
    )
    try:
        smtp_service.send_email(db, user.email, subject, plain, html)
    except HTTPException as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to send OTP email. Please contact the administrator to configure SMTP mail delivery.",
        ) from exc


def _send_register_otp(db: Session, user: User, otp_code: str) -> None:
    if settings.dev_static_otp_code and settings.app_environment != "production":
        logging.getLogger(__name__).warning(
            "DEV_STATIC_OTP_CODE is active - skipping OTP email for %s, use code %s",
            user.email,
            otp_code,
        )
        return

    subject, plain, html = email_template_service.render_register_otp_email(
        user.first_name or "there",
        otp_code,
        settings.login_otp_expire_minutes,
    )
    try:
        smtp_service.send_email(db, user.email, subject, plain, html)
    except HTTPException as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to send verification email. Please contact the administrator to configure SMTP mail delivery.",
        ) from exc


def _safe_return_path(path: Optional[str]) -> str:
    if not path or not path.startswith("/") or path.startswith("//"):
        return "/login"
    return path[:500]


def _frontend_redirect(path: str, params: dict[str, str]) -> RedirectResponse:
    separator = "&" if "?" in path else "?"
    return RedirectResponse(f"{settings.frontend_url.rstrip('/')}{path}{separator}{urlencode(params)}")


def _google_redirect_uri(request: Request) -> str:
    return settings.google_redirect_uri or str(request.url_for("google_callback"))


def _skips_login_otp(user: User) -> bool:
    """The developer account signs in on its password alone.

    Every other role gets a one-time code by email, and that is the only mail
    the login flow sends - so "no email for the developer login" and "no second
    factor for the developer login" are the same request. The account is
    typically a shared or unattended one whose mailbox may not be monitored, or
    may not exist, in which case the emailed code cannot arrive at all and the
    503 from a failed send locks the account out entirely.

    This is a real reduction in protection for a privileged role: the password
    becomes the only thing guarding it, so it should be long, unique, and not
    shared. Everything else about the sign-in is unchanged - rate limiting, the
    active-account check, session issuing and the audit trail all still apply.
    """
    return user.role is not None and user.role.name == DEVELOPER


def _otp_challenge_for(
    db: Session,
    user: User,
    payload: Union[LoginRequest, GoogleOtpRequest, RegisterRequest],
    auth_method: str,
) -> TokenResponse:
    otp_code = generate_login_otp_code()
    if auth_method == "register":
        _send_register_otp(db, user, otp_code)
    else:
        _send_login_otp(db, user, otp_code)
    challenge = create_login_otp_token(
        user.id,
        user.role.name,
        user.institute_id,
        auth_method,
        getattr(payload, "remember_me", True),
        payload.device_id,
        payload.device_name,
        hash_login_otp_code(otp_code),
    )
    static_otp_active = bool(settings.dev_static_otp_code) and settings.app_environment != "production"
    return TokenResponse(
        otp_required=True,
        otp_challenge_id=challenge,
        otp_delivery="static" if static_otp_active else "email",
        message=(
            "Testing mode: use the configured static OTP code."
            if static_otp_active
            else "OTP sent to your registered email."
        ),
    )


@router.get("/google/login")
def google_login(
    request: Request,
    response: Response,
    role: str = Query(default="INSTITUTE_ADMIN", max_length=80),
    return_path: str = Query(default="/login", max_length=500),
    mode: str = Query(default="login", max_length=20),
    remember_me: bool = True,
    device_id: Optional[str] = Query(default=None, min_length=16, max_length=200),
    device_name: Optional[str] = Query(default=None, max_length=120),
):
    if not settings.google_client_id or not settings.google_client_secret:
        return _frontend_redirect(_safe_return_path(return_path), {"role": role, "google_error": "Google login is not configured"})

    device_identifier = _device_identifier(request, response, device_id)
    state = create_google_oauth_state_token(
        role,
        _safe_return_path(return_path),
        remember_me,
        device_identifier,
        device_name,
        "register" if mode == "register" else "login",
    )
    query = urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": _google_redirect_uri(request),
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "online",
            "prompt": "select_account",
        }
    )
    redirect = RedirectResponse(f"{GOOGLE_AUTH_URL}?{query}")
    _set_device_cookie(redirect, device_identifier)
    return redirect


@router.get("/google/callback", name="google_callback")
def google_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    fallback_path = "/login"
    if error:
        return _frontend_redirect(fallback_path, {"google_error": "Google login was cancelled"})
    if not code or not state:
        return _frontend_redirect(fallback_path, {"google_error": "Google login did not return a valid response"})

    try:
        state_claims = decode_token(state)
    except jwt.PyJWTError:
        return _frontend_redirect(fallback_path, {"google_error": "Google login session expired"})

    if state_claims.get("type") != TOKEN_TYPE_GOOGLE_OAUTH_STATE:
        return _frontend_redirect(fallback_path, {"google_error": "Google login session expired"})

    return_path = _safe_return_path(state_claims.get("return_path"))
    role = str(state_claims.get("role") or "INSTITUTE_ADMIN")
    mode = str(state_claims.get("mode") or "login")
    try:
        token_response = requests.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": _google_redirect_uri(request),
                "grant_type": "authorization_code",
            },
            timeout=10,
        )
        token_response.raise_for_status()
        access_token = token_response.json().get("access_token")
        if not access_token:
            raise ValueError("Google did not return an access token")
        userinfo_response = requests.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        userinfo_response.raise_for_status()
        profile = userinfo_response.json()
    except (requests.RequestException, ValueError):
        return _frontend_redirect(return_path, {"role": role, "google_error": "Unable to verify Google login"})

    google_email = str(profile.get("email") or "").strip().lower()
    if not google_email or profile.get("email_verified") is False:
        return _frontend_redirect(return_path, {"role": role, "google_error": "Google email is not verified"})

    try:
        if mode == "register":
            full_name = str(profile.get("name") or "").strip()
            given_name = str(profile.get("given_name") or "").strip()
            family_name = str(profile.get("family_name") or "").strip()
            if not given_name and full_name:
                name_parts = full_name.split(maxsplit=1)
                given_name = name_parts[0]
                family_name = name_parts[1] if len(name_parts) > 1 else ""
            user = auth_service.get_or_create_google_student(
                db,
                google_email,
                given_name or "Google",
                family_name or "Student",
                _client_ip(request),
            )
            role = "STUDENT"
        else:
            user = auth_service.get_otp_login_user(db, google_email, _client_ip(request), role=role)
    except HTTPException:
        return _frontend_redirect(return_path, {"role": role, "google_error": "No active LMS account matches this Google email"})

    payload = GoogleOtpRequest(
        email=google_email,
        role=role,
        device_id=state_claims.get("device_identifier"),
        device_name=state_claims.get("device_name"),
        remember_me=bool(state_claims.get("remember_me", True)),
    )
    challenge = _otp_challenge_for(db, user, payload, "google_oauth")
    return _frontend_redirect(
        return_path,
        {
            "role": role,
            "google_otp_challenge": challenge.otp_challenge_id or "",
            "google_otp_delivery": challenge.otp_delivery or "email",
        },
    )


def _issue_session_now(
    db: Session,
    user: User,
    request: Request,
    response: Response,
    payload: Union[LoginRequest, GoogleOtpRequest],
    auth_method: str,
) -> TokenResponse:
    """Complete a sign-in without the OTP round trip.

    Same tail as `verify_otp` once the code has checked out - the difference is
    only that there was no code. Session issuing, the device record and the
    refresh cookie are identical, so a developer session is indistinguishable
    from any other after this point.
    """
    access_token, refresh_token = auth_service.issue_login_session(
        db,
        user,
        request.headers.get("user-agent"),
        _client_ip(request),
        payload.device_id,
        payload.device_name,
        auth_method,
    )
    set_refresh_cookie(
        response,
        refresh_token,
        persistent=bool(getattr(payload, "remember_me", True)),
    )
    return TokenResponse(access_token=access_token)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    _limit_login_attempt(request, payload.email)
    device_identifier = _device_identifier(request, response, payload.device_id)
    user = auth_service.authenticate_login_user(
        db,
        payload.email,
        payload.password,
        _client_ip(request),
        role=payload.role,
    )
    if payload.role and user.role_name != payload.role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    payload.device_id = device_identifier
    if _skips_login_otp(user):
        # Developer login: no emailed code. If the account has an authenticator
        # enrolled, that is the second factor - the password is verified, but a
        # valid TOTP code is still required before a session is issued. This is
        # isolated to the developer branch, so no other login is affected.
        if totp_service.is_enabled(db, user):
            if not payload.totp_code:
                return TokenResponse(
                    totp_required=True,
                    message="Enter the code from your authenticator app.",
                )
            if not totp_service.verify(db, user, payload.totp_code):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="That authenticator code is not valid.",
                )
        # The password has already been verified by authenticate_login_user, so
        # this returns a session rather than an OTP challenge - and sends nothing.
        return _issue_session_now(db, user, request, response, payload, "password")
    return _otp_challenge_for(db, user, payload, "password")


@router.post("/google/request-otp", response_model=TokenResponse)
def google_request_otp(payload: GoogleOtpRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    _limit_login_attempt(request, payload.email)
    device_identifier = _device_identifier(request, response, payload.device_id)
    user = auth_service.get_otp_login_user(db, payload.email, _client_ip(request), role=payload.role)
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

    # The challenge is a stateless JWT, so without an attempt cap keyed to its
    # jti the same token could be replayed until the 6-digit code is guessed.
    challenge_key = f"otp-challenge:{challenge.get('jti')}"
    enforce_rate_limit(
        f"otp-ip:{_rate_limit_ip(request)}",
        settings.otp_ip_rate_limit,
        settings.otp_rate_window_seconds,
        "Too many OTP attempts. Please try again later.",
    )
    enforce_rate_limit(
        challenge_key,
        settings.otp_attempt_limit,
        settings.login_otp_expire_minutes * 60,
        "Too many incorrect codes. Please sign in again to get a new code.",
    )

    if not verify_login_otp_code(payload.otp_code, str(challenge.get("otp_hash") or "")):
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
    clear_rate_limit(challenge_key)
    set_refresh_cookie(response, refresh_token, persistent=bool(challenge.get("remember_me", True)))
    return TokenResponse(access_token=access_token)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    enforce_rate_limit(
        f"register:{client_ip}",
        settings.registration_rate_limit,
        settings.registration_rate_window_seconds,
        "Too many registration attempts. Please try again later.",
    )
    device_identifier = _device_identifier(request, response, payload.device_id)
    user = auth_service.register(
        db,
        payload.email,
        payload.password,
        payload.first_name,
        payload.last_name,
        client_ip,
    )
    return _otp_challenge_for(db, user, payload, "register")


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


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
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
        can_view_monetary_analytics=user.is_owner or user.can_view_monetary_analytics,
        dob=user.dob,
        phone_number=user.phone_number,
        address=user.address,
        gender=user.gender,
        institute_permissions=(
            institute_service.normalized_admin_permissions(user.institute.admin_permissions)
            if user.institute and user.role.name == "INSTITUTE_ADMIN"
            else None
        ),
    )


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    # Capped per address as well as per IP so the endpoint cannot be used to
    # flood one mailbox from rotating clients.
    enforce_rate_limit(
        f"forgot-ip:{_rate_limit_ip(request)}",
        settings.password_reset_rate_limit,
        settings.password_reset_rate_window_seconds,
        "Too many password reset requests. Please try again later.",
    )
    enforce_rate_limit(
        f"forgot-email:{payload.email.strip().lower()}",
        settings.password_reset_rate_limit,
        settings.password_reset_rate_window_seconds,
        "Too many password reset requests. Please try again later.",
    )
    auth_service.request_password_reset(db, payload.email)
    return {"message": "If an active account exists for this email, a password reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(payload: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    enforce_rate_limit(
        f"reset-ip:{_rate_limit_ip(request)}",
        settings.password_reset_rate_limit,
        settings.password_reset_rate_window_seconds,
        "Too many password reset attempts. Please try again later.",
    )
    auth_service.confirm_password_reset(db, payload.token, payload.new_password)
    return {"message": "Password updated successfully. You can now log in with your new password."}
