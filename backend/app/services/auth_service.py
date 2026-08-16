import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from uuid import uuid4

import jwt
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import (
    TOKEN_TYPE_REFRESH,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.models.audit_log import AuditLog
from app.models.role import STUDENT, Role
from app.models.user import User
from app.models.user_device import UserDevice
from app.models.user_session import UserSession
from app.services import account_service

INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
)
INVALID_REFRESH_TOKEN = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token"
)


def _active_sessions(db: Session, user_id: int) -> list[UserSession]:
    return (
        db.query(UserSession)
        .filter(
            UserSession.user_id == user_id,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > datetime.now(timezone.utc),
        )
        .all()
    )


def _session_expiry(user: User, now: datetime) -> datetime:
    if user.institute is not None:
        hours = max(1, min(720, user.institute.session_duration_hours or 24))
        return now + timedelta(hours=hours)
    return now + timedelta(days=settings.refresh_token_expire_days)


def _resolve_device(
    db: Session,
    user: User,
    device_identifier: Optional[str],
    device_name: Optional[str],
    user_agent: Optional[str],
    ip_address: Optional[str],
    *,
    enforce_single_device: bool,
) -> Optional[UserDevice]:
    if not device_identifier:
        if enforce_single_device:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Device identification is required for login",
            )
        return None

    identifier_hash = hashlib.sha256(device_identifier.strip().encode("utf-8")).hexdigest()
    device = (
        db.query(UserDevice)
        .filter(UserDevice.user_id == user.id, UserDevice.identifier_hash == identifier_hash)
        .first()
    )
    now = datetime.now(timezone.utc)
    if device is None:
        device = UserDevice(
            user_id=user.id,
            identifier_hash=identifier_hash,
            name=(device_name or "Unknown device").strip()[:120],
            user_agent=(user_agent or "")[:255] or None,
            last_ip_address=ip_address,
            login_count=0,
            first_seen_at=now,
            last_seen_at=now,
        )
        db.add(device)
        db.flush()

    active_sessions = _active_sessions(db, user.id)
    if enforce_single_device:
        # Sessions created before device tracking cannot identify a real device.
        # Retire them before enforcing the one-device rule so they do not lock a
        # user out as an "Unknown device" for the rest of their lifetime.
        legacy_sessions = [session for session in active_sessions if session.device_id is None]
        for session in legacy_sessions:
            session.revoked_at = now
            db.add(session)

        identified_sessions = [
            session for session in active_sessions if session.device_id is not None
        ]
        # Every account keeps one active session at a time. A fresh successful
        # login takes over the account and signs out every previous device.
        for session in identified_sessions:
            session.revoked_at = now
            db.add(session)

    device.name = (device_name or device.name or "Unknown device").strip()[:120]
    device.user_agent = (user_agent or device.user_agent or "")[:255] or None
    device.last_ip_address = ip_address
    device.last_seen_at = now
    device.login_count += 1
    db.add(device)
    return device


def issue_token_pair(
    db: Session,
    user: User,
    user_agent: Optional[str],
    ip_address: Optional[str],
    auth_method: str = "password",
    device: Optional[UserDevice] = None,
    expires_at: Optional[datetime] = None,
) -> Tuple[str, str]:
    session_key = uuid4().hex
    now = datetime.now(timezone.utc)
    session_expires_at = expires_at or _session_expiry(user, now)
    refresh_lifetime = max(session_expires_at - now, timedelta(seconds=1))
    access_token = create_access_token(
        user.id, user.role.name, user.institute_id, auth_method, session_key
    )
    refresh_token = create_refresh_token(
        user.id,
        user.role.name,
        user.institute_id,
        auth_method,
        session_key,
        refresh_lifetime,
    )

    session = UserSession(
        user_id=user.id,
        device_id=device.id if device else None,
        session_key=session_key,
        refresh_token_hash=hash_refresh_token(refresh_token),
        user_agent=user_agent,
        ip_address=ip_address,
        created_at=now,
        expires_at=session_expires_at,
    )
    db.add(session)
    db.commit()

    return access_token, refresh_token


def _require_open_access_window(db: Session, user: User, ip_address: Optional[str]) -> None:
    """Refuse a login whose access window has closed, and say so.

    Unlike an institute suspension - which is deliberately hidden behind the
    generic message so a blocked user learns nothing - an expired window is the
    student's own business and the fix is theirs to chase: their institute
    extends it. Telling them "invalid email or password" would send them round
    a password-reset loop that cannot possibly work.
    """
    from app.services import access_window_service

    denied = access_window_service.access_denied_reason(user)
    if denied is None:
        return
    db.add(
        AuditLog(
            user_id=user.id,
            action="student_access.login_blocked",
            entity_type="user",
            entity_id=user.id,
            details={"reason": denied, "access_state": user.access_state},
            ip_address=ip_address,
        )
    )
    db.commit()
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=denied)


def authenticate_login_user(
    db: Session,
    email: str,
    password: str,
    ip_address: Optional[str],
    role: Optional[str] = None,
) -> User:
    normalized_email = email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == normalized_email).first()

    # The password is checked FIRST, and `is_active` after, so that a student
    # whose window has closed can be given a reason they can act on without
    # that reason ever reaching someone who does not know their password.
    #
    # The old single condition made this impossible: `not user.is_active` short
    # -circuited before the access check, so every expired student was told
    # "invalid email or password" and sent round a password-reset loop that
    # could not possibly work.
    if user is None or not verify_password(password, user.password_hash):
        raise INVALID_CREDENTIALS

    if role and (not user.role or user.role.name != role):
        raise INVALID_CREDENTIALS

    _require_open_access_window(db, user, ip_address)

    if not user.is_active:
        # Disabled for a reason the account holder is not entitled to hear -
        # a staff account switched off, an account under review.
        raise INVALID_CREDENTIALS

    if user.institute_id is not None and not user.institute.is_active:
        # don't reveal the suspension to the blocked user - same generic message
        db.add(
            AuditLog(
                user_id=user.id,
                action="institute.login_blocked_suspended",
                entity_type="institute",
                entity_id=user.institute_id,
                ip_address=ip_address,
            )
        )
        db.commit()
        raise INVALID_CREDENTIALS

    return user


def get_otp_login_user(
    db: Session,
    email: str,
    ip_address: Optional[str],
    role: Optional[str] = None,
) -> User:
    normalized_email = email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == normalized_email).first()
    if user is None:
        raise INVALID_CREDENTIALS

    if role and (not user.role or user.role.name != role):
        raise INVALID_CREDENTIALS

    _require_open_access_window(db, user, ip_address)

    if not user.is_active:
        raise INVALID_CREDENTIALS

    if user.institute_id is not None and not user.institute.is_active:
        db.add(
            AuditLog(
                user_id=user.id,
                action="institute.login_blocked_suspended",
                entity_type="institute",
                entity_id=user.institute_id,
                ip_address=ip_address,
            )
        )
        db.commit()
        raise INVALID_CREDENTIALS

    _require_open_access_window(db, user, ip_address)

    return user


def get_or_create_google_student(
    db: Session,
    email: str,
    first_name: str,
    last_name: str,
    ip_address: Optional[str],
) -> User:
    normalized_email = email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == normalized_email).first()
    if user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=account_service.USER_CREDENTIALS_CONFLICT_DETAIL,
        )

    role = db.query(Role).filter(Role.name == STUDENT).first()
    if role is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="STUDENT role is not seeded")

    user = User(
        email=normalized_email,
        password_hash=hash_password(uuid4().hex + uuid4().hex),
        role_id=role.id,
        institute_id=None,
        first_name=(first_name or "Google").strip()[:100] or "Google",
        last_name=(last_name or "Student").strip()[:100] or "Student",
        is_active=True,
        force_password_reset=False,
    )
    db.add(user)
    db.flush()
    db.add(
        AuditLog(
            user_id=user.id,
            action="student.google_register",
            entity_type="user",
            entity_id=user.id,
            ip_address=ip_address,
        )
    )
    db.commit()
    db.refresh(user)
    return user


def issue_login_session(
    db: Session,
    user: User,
    user_agent: Optional[str],
    ip_address: Optional[str],
    device_identifier: Optional[str] = None,
    device_name: Optional[str] = None,
    auth_method: str = "password",
) -> Tuple[str, str]:
    device = _resolve_device(
        db,
        user,
        device_identifier,
        device_name,
        user_agent,
        ip_address,
        enforce_single_device=True,
    )
    return issue_token_pair(db, user, user_agent, ip_address, auth_method=auth_method, device=device)


def login(
    db: Session,
    email: str,
    password: str,
    user_agent: Optional[str],
    ip_address: Optional[str],
    device_identifier: Optional[str] = None,
    device_name: Optional[str] = None,
) -> Tuple[str, str]:
    user = authenticate_login_user(db, email, password, ip_address)
    return issue_login_session(db, user, user_agent, ip_address, device_identifier, device_name)


def register(
    db: Session,
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    ip_address: Optional[str],
) -> User:
    """Public self-registration for a direct (B2C) student - institute_id is
    always NULL here; institute students are created by their institute."""
    normalized_email = account_service.ensure_user_credentials_available(db, email)

    role = db.query(Role).filter(Role.name == STUDENT).first()
    if role is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="STUDENT role is not seeded")

    user = User(
        email=normalized_email,
        password_hash=hash_password(password),
        role_id=role.id,
        institute_id=None,
        first_name=first_name,
        last_name=last_name,
        is_active=True,
        force_password_reset=False,
    )
    db.add(user)
    db.flush()
    db.add(
        AuditLog(
            user_id=user.id,
            action="student.self_register",
            entity_type="user",
            entity_id=user.id,
            ip_address=ip_address,
        )
    )
    db.commit()
    db.refresh(user)

    # Send HTML Welcome Email
    try:
        from app.services import email_template_service, smtp_service
        login_url = f"{settings.frontend_url.rstrip('/')}/login"
        subject, plain, html = email_template_service.render_welcome_email(user.first_name, login_url)
        smtp_service.send_email(db, user.email, subject, plain, html_body=html)
    except Exception as exc:
        import logging
        from app.services.notification_service import record_send_failure

        logging.getLogger(__name__).warning("Failed to send welcome email for %s: %s", user.email, exc)
        record_send_failure(db, f"Welcome email to {user.email} failed: {exc}", user_id=user.id)

    return user


def request_password_reset(db: Session, email: str) -> None:
    normalized_email = email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == normalized_email).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email address."
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account has been deactivated."
        )
    if user.is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Application owner accounts cannot be reset via public form."
        )

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.password_reset_expiry_minutes)
    reset_payload = {
        "sub": str(user.id),
        "email": user.email,
        "type": "password_reset",
        "exp": expires_at,
    }
    reset_token = jwt.encode(reset_payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

    try:
        from app.services import email_template_service, smtp_service
        reset_url = f"{settings.frontend_url.rstrip('/')}/reset-password?token={reset_token}"
        subject, plain, html = email_template_service.render_forgot_password_email(
            user.first_name or "Student", reset_url
        )
        smtp_service.send_email(db, user.email, subject, plain, html_body=html)
    except Exception as exc:
        import logging
        from app.services.notification_service import record_send_failure

        logging.getLogger(__name__).exception("Failed to send forgot password email for %s: %s", user.email, exc)
        record_send_failure(db, f"Password reset email to {user.email} failed: {exc}", user_id=user.id)


def confirm_password_reset(db: Session, token: str, new_password: str) -> None:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link")

    if payload.get("type") != "password_reset":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset link")

    user_id = int(payload.get("sub", 0))
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account not found or inactive")
    if user.is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner password cannot be reset")

    now = datetime.now(timezone.utc)
    user.password_hash = hash_password(new_password)
    user.force_password_reset = False
    user.password_changed_at = now

    active_sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == user.id, UserSession.revoked_at.is_(None))
        .all()
    )
    for session in active_sessions:
        session.revoked_at = now

    # self-service resets went unlogged until now, leaving a gap in the password
    # trail the directory reads - the actor is the account itself
    db.add(
        AuditLog(
            user_id=user.id,
            action="account.reset_password_via_email",
            entity_type="user",
            entity_id=user.id,
            details={"sessions_revoked": len(active_sessions)},
            ip_address=None,
        )
    )
    db.commit()


def refresh(
    db: Session, refresh_token: str, user_agent: Optional[str], ip_address: Optional[str]
) -> Tuple[str, str]:
    try:
        payload = decode_token(refresh_token)
    except jwt.PyJWTError:
        raise INVALID_REFRESH_TOKEN

    if payload.get("type") != TOKEN_TYPE_REFRESH:
        raise INVALID_REFRESH_TOKEN

    token_hash = hash_refresh_token(refresh_token)
    session = db.query(UserSession).filter(UserSession.refresh_token_hash == token_hash).first()

    now = datetime.now(timezone.utc)
    session_expires_at = session.expires_at.replace(tzinfo=timezone.utc) if session else None
    if (
        session is None
        or session.revoked_at is not None
        or session_expires_at is None
        or session_expires_at < now
        or payload.get("sid") != session.session_key
    ):
        raise INVALID_REFRESH_TOKEN

    user = db.get(User, session.user_id)
    if user is None or not user.is_active:
        raise INVALID_REFRESH_TOKEN
    if user.role.name == STUDENT and session.device_id is None:
        # Pre-device-tracking student sessions must perform a fresh identified
        # login before they can receive another token pair.
        raise INVALID_REFRESH_TOKEN

    # rotate: revoke the presented refresh token, issue a fresh pair
    session.revoked_at = now
    db.add(session)
    db.commit()

    device = session.device
    if device is not None:
        device.last_seen_at = now
        device.last_ip_address = ip_address
        device.user_agent = (user_agent or device.user_agent or "")[:255] or None
        db.add(device)
        db.commit()

    return issue_token_pair(
        db,
        user,
        user_agent,
        ip_address,
        payload.get("auth_method", "password"),
        device=device,
        expires_at=session_expires_at,
    )


def logout(db: Session, refresh_token: str) -> None:
    token_hash = hash_refresh_token(refresh_token)
    session = db.query(UserSession).filter(UserSession.refresh_token_hash == token_hash).first()
    if session is None:
        return

    sessions = db.query(UserSession).filter(
        UserSession.user_id == session.user_id,
        UserSession.revoked_at.is_(None),
    )
    if session.device_id is not None:
        sessions = sessions.filter(UserSession.device_id == session.device_id)
    else:
        sessions = sessions.filter(UserSession.id == session.id)

    now = datetime.now(timezone.utc)
    for active_session in sessions.all():
        active_session.revoked_at = now
        db.add(active_session)
    db.commit()
