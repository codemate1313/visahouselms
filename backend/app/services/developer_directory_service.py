"""The developer's view of every account, across all tenants.

Super Admin's directory is scoped and role-filtered; this is the whole user
base in one list, which only the developer role can see. Revoking access here is
the same operation the other panels expose - deactivate and end every session -
kept in one place so "revoke" means exactly one thing platform-wide.

Every revoke and restore writes an audit entry. That is the line held earlier:
the developer's reach is total, and precisely because it is total the record of
using it stays.
"""
from typing import Optional

from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.audit_log import AuditLog
from app.models.user import User
from app.services import account_service


def _audit(db: Session, actor: User, action: str, target_id: int, ip: Optional[str], details: dict) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            action=action,
            entity_type="user",
            entity_id=target_id,
            details=details,
            ip_address=ip,
        )
    )


def _get_or_404(db: Session, user_id: int) -> User:
    user = (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.id == user_id, User.deleted_at.is_(None))
        .first()
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def revoke_access(db: Session, actor: User, user_id: int, ip: Optional[str]) -> dict:
    """Deactivate an account and end every session it holds.

    This is the elevated path: unlike the Super Admin directory, it will act on
    a Super Admin or the owner account, because the developer layer sits above
    them by design. The one account it refuses is the actor's own - a developer
    cannot revoke themselves, since there is no undo from the same screen once
    they are signed out.

    Revoking the owner is deliberately allowed but is a heavy action: the owner
    can no longer sign in until restored. It is confirmed in the UI and audited
    here with the actor and the target.
    """
    user = _get_or_404(db, user_id)
    if user.id == actor.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot revoke your own access")

    user.is_active = False
    revoked = account_service.revoke_all_sessions(db, user.id)
    db.add(user)
    _audit(db, actor, "developer.access_revoked", user.id, ip, {"email": user.email, "sessions_ended": revoked})
    db.commit()
    return {"id": user.id, "is_active": user.is_active, "sessions_ended": revoked}


def restore_access(db: Session, actor: User, user_id: int, ip: Optional[str]) -> dict:
    """Reactivate an account revoked above. The account still has to sign in;
    this only lifts the block."""
    user = _get_or_404(db, user_id)
    user.is_active = True
    db.add(user)
    _audit(db, actor, "developer.access_restored", user.id, ip, {"email": user.email})
    db.commit()
    return {"id": user.id, "is_active": user.is_active}
