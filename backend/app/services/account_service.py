from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import hash_refresh_token
from app.core.uploads import read_validated_image
from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.user_session import UserSession

MAX_AVATAR_BYTES = 2 * 1024 * 1024


def _audit(db: Session, actor: User, action: str, entity_id: int, ip: Optional[str], details: Optional[dict] = None) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            action=action,
            entity_type="user",
            entity_id=entity_id,
            details=details,
            ip_address=ip,
        )
    )


def avatar_url_for(user: User) -> Optional[str]:
    return f"/storage/{user.avatar_path}" if user.avatar_path else None


def update_profile(
    db: Session,
    actor: User,
    email: Optional[str],
    first_name: Optional[str],
    last_name: Optional[str],
    ip: Optional[str],
) -> User:
    if email is not None and email != actor.email:
        if db.query(User).filter(User.email == email, User.id != actor.id).first() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")
        actor.email = email
    if first_name is not None:
        actor.first_name = first_name
    if last_name is not None:
        actor.last_name = last_name

    db.add(actor)
    _audit(db, actor, "account.update_profile", actor.id, ip)
    db.commit()
    db.refresh(actor)
    return actor


async def save_avatar(db: Session, actor: User, upload: UploadFile, ip: Optional[str]) -> User:
    ext, content = await read_validated_image(upload, MAX_AVATAR_BYTES, "Avatar")

    avatars_dir = settings.storage_path / "avatars"
    avatars_dir.mkdir(parents=True, exist_ok=True)

    # remove any previous avatar with a different extension
    if actor.avatar_path:
        old = settings.storage_path / actor.avatar_path
        if old.is_file():
            old.unlink()

    relative_path = f"avatars/user_{actor.id}{ext}"
    (settings.storage_path / relative_path).write_bytes(content)

    actor.avatar_path = relative_path
    db.add(actor)
    _audit(db, actor, "account.update_avatar", actor.id, ip)
    db.commit()
    db.refresh(actor)
    return actor


def _active_sessions_query(db: Session, user_id: int):
    now = datetime.now(timezone.utc)
    return (
        db.query(UserSession)
        .filter(
            UserSession.user_id == user_id,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > now,
        )
        .order_by(UserSession.created_at.desc())
    )


def list_sessions(db: Session, actor: User, current_refresh_token: Optional[str]) -> List[dict]:
    current_hash = hash_refresh_token(current_refresh_token) if current_refresh_token else None
    sessions = _active_sessions_query(db, actor.id).all()
    return [
        {
            "id": s.id,
            "user_agent": s.user_agent,
            "ip_address": s.ip_address,
            "created_at": s.created_at,
            "expires_at": s.expires_at,
            "is_current": s.refresh_token_hash == current_hash,
        }
        for s in sessions
    ]


def revoke_session(db: Session, actor: User, session_id: int, ip: Optional[str]) -> None:
    session = (
        db.query(UserSession)
        .filter(UserSession.id == session_id, UserSession.user_id == actor.id)
        .first()
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if session.revoked_at is None:
        session.revoked_at = datetime.now(timezone.utc)
        db.add(session)
        _audit(db, actor, "account.revoke_session", actor.id, ip, {"session_id": session_id})
        db.commit()


def revoke_other_sessions(db: Session, actor: User, current_refresh_token: str, ip: Optional[str]) -> int:
    current_hash = hash_refresh_token(current_refresh_token)
    now = datetime.now(timezone.utc)
    sessions = _active_sessions_query(db, actor.id).filter(
        UserSession.refresh_token_hash != current_hash
    ).all()
    for session in sessions:
        session.revoked_at = now
        db.add(session)
    if sessions:
        _audit(db, actor, "account.revoke_other_sessions", actor.id, ip, {"count": len(sessions)})
        db.commit()
    return len(sessions)
