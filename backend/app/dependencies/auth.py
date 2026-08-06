import jwt
from datetime import datetime, timezone
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import TOKEN_TYPE_ACCESS, decode_token
from app.database import get_db
from app.models.user import User
from app.models.user_session import UserSession
from app.models.role import DEVELOPER

bearer_scheme = HTTPBearer()


def get_current_user(
    request: Request = None,  # type: ignore[assignment]
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials)
    except jwt.PyJWTError:
        raise unauthorized

    if payload.get("type") != TOKEN_TYPE_ACCESS:
        raise unauthorized

    user_id = payload.get("sub")
    if user_id is None:
        raise unauthorized

    user = db.get(User, int(user_id))
    if user is None or not user.is_active:
        raise unauthorized

    # Impersonation tokens carry an `imp` claim and no session. They are
    # short-lived and read-only, so they skip the session lookup but are flagged
    # on the request for the write-guard, which refuses every state change while
    # one is in play.
    if payload.get("imp") is not None:
        if request is not None:
            request.state.impersonated = True
            request.state.impersonator_id = payload.get("imp")
        return user

    session_key = payload.get("sid")
    if session_key is None:
        raise unauthorized
    session = (
        db.query(UserSession)
        .filter(
            UserSession.session_key == session_key,
            UserSession.user_id == user.id,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )
    if session is None:
        raise unauthorized

    return user


def get_current_session(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> UserSession:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials)
    except jwt.PyJWTError:
        raise unauthorized
    if payload.get("type") != TOKEN_TYPE_ACCESS or payload.get("sid") is None:
        raise unauthorized

    session = (
        db.query(UserSession)
        .filter(
            UserSession.session_key == payload["sid"],
            UserSession.user_id == int(payload.get("sub", 0)),
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )
    if session is None:
        raise unauthorized
    return session

def require_role(*allowed_roles: str):
    def _check(user: User = Depends(get_current_user)) -> User:
        if user.role.name not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return user

    return _check


def require_verified_developer(user: User = Depends(get_current_user)) -> User:
    if user.role.name != DEVELOPER or not user.is_developer_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verified developer access is required",
        )
    return user


def require_super_admin_or_verified_developer(user: User = Depends(get_current_user)) -> User:
    if user.role.name == DEVELOPER and user.is_developer_verified:
        return user
    if user.role.name == "SUPER_ADMIN":
        return user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to perform this action",
    )


def can_view_monetary_analytics(user: User) -> bool:
    return user.is_owner or bool(user.can_view_monetary_analytics)


def require_monetary_analytics_access(user: User = Depends(get_current_user)) -> User:
    if user.role.name != "SUPER_ADMIN" or not can_view_monetary_analytics(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Monetary analytics access is restricted by the owner account",
        )
    return user


def require_password_change_complete(user: User = Depends(get_current_user)) -> User:
    if user.force_password_reset:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password change required before accessing this resource",
        )
    return user
