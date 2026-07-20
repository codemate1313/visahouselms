from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

import jwt
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import (
    TOKEN_TYPE_REFRESH,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_refresh_token,
    verify_password,
)
from app.models.user import User
from app.models.user_session import UserSession

INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
)
INVALID_REFRESH_TOKEN = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token"
)


def issue_token_pair(
    db: Session,
    user: User,
    user_agent: Optional[str],
    ip_address: Optional[str],
    auth_method: str = "password",
) -> Tuple[str, str]:
    access_token = create_access_token(user.id, user.role.name, user.institute_id, auth_method)
    refresh_token = create_refresh_token(user.id, user.role.name, user.institute_id, auth_method)

    now = datetime.now(timezone.utc)
    session = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_refresh_token(refresh_token),
        user_agent=user_agent,
        ip_address=ip_address,
        created_at=now,
        expires_at=now + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(session)
    db.commit()

    return access_token, refresh_token


def login(
    db: Session, email: str, password: str, user_agent: Optional[str], ip_address: Optional[str]
) -> Tuple[str, str]:
    user = db.query(User).filter(User.email == email).first()
    if user is None or not user.is_active or not verify_password(password, user.password_hash):
        raise INVALID_CREDENTIALS

<<<<<<< Updated upstream
    return _issue_token_pair(db, user, user_agent, ip_address)
=======
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

    return issue_token_pair(db, user, user_agent, ip_address)
>>>>>>> Stashed changes


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
    ):
        raise INVALID_REFRESH_TOKEN

    user = db.get(User, session.user_id)
    if user is None or not user.is_active:
        raise INVALID_REFRESH_TOKEN

    # rotate: revoke the presented refresh token, issue a fresh pair
    session.revoked_at = now
    db.add(session)
    db.commit()

    return issue_token_pair(
        db, user, user_agent, ip_address, payload.get("auth_method", "password")
    )


def logout(db: Session, refresh_token: str) -> None:
    token_hash = hash_refresh_token(refresh_token)
    session = db.query(UserSession).filter(UserSession.refresh_token_hash == token_hash).first()
    if session is not None and session.revoked_at is None:
        session.revoked_at = datetime.now(timezone.utc)
        db.add(session)
        db.commit()
