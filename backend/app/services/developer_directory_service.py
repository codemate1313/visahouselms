"""The developer's view of every account, across all tenants.

Super Admin's directory is scoped and role-filtered; this is the whole user
base in one list, which only the developer role can see. Revoking access here is
the same operation the other panels expose - deactivate and end every session -
kept in one place so "revoke" means exactly one thing platform-wide.

Every revoke and restore writes an audit entry. That is the line held earlier:
the developer's reach is total, and precisely because it is total the record of
using it stays.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.audit_log import AuditLog
from app.models.institute import Institute
from app.models.role import Role
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


def _serialize(user: User, institute_name: Optional[str]) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role.name if user.role else None,
        "institute_id": user.institute_id,
        "institute_name": institute_name,
        "is_active": user.is_active,
        "is_owner": user.is_owner,
        "created_at": user.created_at,
    }


def list_users(
    db: Session,
    search: Optional[str] = None,
    role: Optional[str] = None,
    active: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    """Every account on the platform, newest first, paginated.

    Retired accounts are excluded - deleting is a soft delete now, and a retired
    row is not an account you would act on. Owner accounts are shown but flagged,
    because the revoke path refuses them.
    """
    query = (
        db.query(User, Institute.name)
        .join(Role, User.role_id == Role.id)
        .outerjoin(Institute, User.institute_id == Institute.id)
        .options(joinedload(User.role))
        .filter(User.deleted_at.is_(None))
    )

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(User.email.ilike(term), User.first_name.ilike(term), User.last_name.ilike(term))
        )
    if role:
        query = query.filter(Role.name == role)
    if active is not None:
        query = query.filter(User.is_active.is_(active))

    total = query.with_entities(func.count(User.id)).scalar() or 0
    rows = query.order_by(User.created_at.desc()).limit(min(limit, 200)).offset(offset).all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "users": [_serialize(user, institute_name) for user, institute_name in rows],
    }


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

    Refuses the owner and the actor's own account: locking either out through
    this screen would be a mistake with no undo from the same screen.
    """
    user = _get_or_404(db, user_id)
    if user.is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="The owner account cannot be revoked")
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
