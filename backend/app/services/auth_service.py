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
        # student out as an "Unknown device" for the rest of their lifetime.
        legacy_sessions = [session for session in active_sessions if session.device_id is None]
        for session in legacy_sessions:
            session.revoked_at = now
            db.add(session)

        identified_sessions = [
            session for session in active_sessions if session.device_id is not None
        ]
        # Student accounts keep one active session at a time. A fresh successful
        # login takes over the account and signs out any previous student device.
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


def login(
    db: Session,
    email: str,
    password: str,
    user_agent: Optional[str],
    ip_address: Optional[str],
    device_identifier: Optional[str] = None,
    device_name: Optional[str] = None,
) -> Tuple[str, str]:
    normalized_email = email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == normalized_email).first()
    if user is None or not user.is_active or not verify_password(password, user.password_hash):
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

    device = _resolve_device(
        db,
        user,
        device_identifier,
        device_name,
        user_agent,
        ip_address,
        enforce_single_device=user.role.name == STUDENT,
    )
    return issue_token_pair(db, user, user_agent, ip_address, device=device)


def register(
    db: Session,
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    user_agent: Optional[str],
    ip_address: Optional[str],
    device_identifier: Optional[str] = None,
    device_name: Optional[str] = None,
) -> Tuple[str, str]:
    """Public self-registration for a direct (B2C) student - institute_id is
    always NULL here; institute students are created by their institute."""
    normalized_email = email.strip().lower()
    existing = db.query(User).filter(func.lower(User.email) == normalized_email).first()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists")

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
    device = _resolve_device(
        db,
        user,
        device_identifier,
        device_name,
        user_agent,
        ip_address,
        enforce_single_device=True,
    )
    db.commit()
    db.refresh(user)

    # Send HTML Welcome Email
    try:
        from app.services import email_template_service, smtp_service
        frontend_url = settings.frontend_url or "http://localhost:5173"
        login_url = f"{frontend_url}/login"
        subject, plain, html = email_template_service.render_welcome_email(user.first_name, login_url)
        smtp_service.send_email(db, user.email, subject, plain, html_body=html)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Failed to send welcome email for %s: %s", user.email, exc)

    return issue_token_pair(db, user, user_agent, ip_address, device=device)


def request_password_reset(db: Session, email: str) -> None:
    normalized_email = email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == normalized_email).first()
    if user is None or not user.is_active:
        return

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=30)
    reset_payload = {
        "sub": str(user.id),
        "email": user.email,
        "type": "password_reset",
        "exp": expires_at,
    }
    reset_token = jwt.encode(reset_payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

    try:
        from app.services import email_template_service, smtp_service
        frontend_url = settings.frontend_url or "http://localhost:5173"
        reset_url = f"{frontend_url}/reset-password?token={reset_token}"
        subject, plain, html = email_template_service.render_forgot_password_email(
            user.first_name or "Student", reset_url
        )
        smtp_service.send_email(db, user.email, subject, plain, html_body=html)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).exception("Failed to send forgot password email for %s: %s", user.email, exc)


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

    user.password_hash = hash_password(new_password)
    user.force_password_reset = False

    now = datetime.now(timezone.utc)
    active_sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == user.id, UserSession.revoked_at.is_(None))
        .all()
    )
    for session in active_sessions:
        session.revoked_at = now

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
