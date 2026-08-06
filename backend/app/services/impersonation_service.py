"""View-as-user impersonation for debugging, read-only and audited.

A short-lived access token is minted for the target account, carrying an `imp`
claim naming the real actor. The claim is what makes it safe: a request-time
guard refuses every state-changing method while it is present, so an
impersonated session can look at everything and change nothing. There is no
refresh token, so the window closes on its own within the access-token lifetime
and cannot be extended.

Starting and ending are both audited under the real actor, never the target, so
the trail always reads as "X viewed as Y" rather than as Y acting.
"""
from datetime import timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import TOKEN_TYPE_ACCESS, _create_token
from app.models.audit_log import AuditLog
from app.models.user import User

# Deliberately short: impersonation is for a look, not a shift.
_IMPERSONATION_MINUTES = 15


def _target(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def start(db: Session, actor: User, user_id: int, ip: Optional[str]) -> dict:
    """Mint a read-only token for the target and record who is behind it."""
    target = _target(db, user_id)
    if target.id == actor.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You are already yourself.")
    # The developer layer sits above every other role, so it may view any
    # account - Super Admins and the owner included. The only bar is yourself.
    # The session stays strictly read-only regardless of whose it is, so viewing
    # an admin cannot become acting as one.

    token = _create_token(
        target.id,
        target.role.name if target.role else "STUDENT",
        target.institute_id,
        TOKEN_TYPE_ACCESS,
        timedelta(minutes=_IMPERSONATION_MINUTES),
        auth_method="impersonation",
        session_key=None,
        extra_claims={"imp": actor.id, "readonly": True},
    )

    db.add(
        AuditLog(
            user_id=actor.id,
            action="impersonation.start",
            entity_type="user",
            entity_id=target.id,
            details={"target_email": target.email},
            ip_address=ip,
        )
    )
    db.commit()

    return {
        "access_token": token,
        "expires_in_minutes": _IMPERSONATION_MINUTES,
        "target": {
            "id": target.id,
            "name": f"{target.first_name} {target.last_name}".strip() or target.email,
            "email": target.email,
            "role": target.role.name if target.role else None,
        },
    }


def audit_stop(db: Session, actor: User, target_id: Optional[int], ip: Optional[str]) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            action="impersonation.stop",
            entity_type="user",
            entity_id=target_id,
            details=None,
            ip_address=ip,
        )
    )
    db.commit()
