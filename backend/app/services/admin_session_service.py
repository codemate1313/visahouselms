"""Platform-wide session oversight for the Super Admin.

The personal `/me/sessions` view shows one account's own devices. This is the
other end: every active session across every tenant, filterable by role,
institute and name, each annotated with an approximate location for its IP.

"Active" means the same thing everywhere else in the codebase - not revoked and
not past expiry - so a signed-out or lapsed session never appears here.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.audit_log import AuditLog
from app.models.institute import Institute
from app.models.role import Role
from app.models.user import User
from app.models.user_session import UserSession
from app.services import geoip_service


def _agent_label(user_agent: Optional[str]) -> str:
    if not user_agent:
        return "Unknown device"
    for needle, name in (("curl", "curl / API"), ("Firefox", "Firefox"), ("Edg", "Edge"), ("Chrome", "Chrome"), ("Safari", "Safari")):
        if needle in user_agent:
            return name
    return user_agent[:40]


def list_sessions(
    db: Session,
    *,
    search: Optional[str] = None,
    role: Optional[str] = None,
    institute_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    query = (
        db.query(UserSession)
        .join(User, UserSession.user_id == User.id)
        .join(Role, User.role_id == Role.id)
        .outerjoin(Institute, User.institute_id == Institute.id)
        .options(
            joinedload(UserSession.user).joinedload(User.role),
            joinedload(UserSession.user).joinedload(User.institute),
        )
        .filter(
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > now,
            User.deleted_at.is_(None),
        )
    )

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(User.email.ilike(term), User.first_name.ilike(term), User.last_name.ilike(term))
        )
    if role:
        query = query.filter(Role.name == role)
    if institute_id is not None:
        query = query.filter(User.institute_id == institute_id)

    total = query.count()
    rows = query.order_by(UserSession.created_at.desc()).limit(min(limit, 200)).offset(offset).all()

    sessions = []
    for session in rows:
        user = session.user
        sessions.append(
            {
                "id": session.id,
                "user_id": user.id,
                "user_name": f"{user.first_name} {user.last_name}".strip() or user.email,
                "user_email": user.email,
                "role": user.role.name if user.role else None,
                "institute_name": user.institute.name if user.institute else None,
                "device": _agent_label(session.user_agent),
                "user_agent": session.user_agent,
                "ip_address": session.ip_address,
                "location": geoip_service.locate(session.ip_address),
                "created_at": session.created_at,
                "expires_at": session.expires_at,
            }
        )

    return {"total": total, "limit": limit, "offset": offset, "sessions": sessions}


def revoke_session(db: Session, actor: User, session_id: int, ip: Optional[str]) -> dict:
    """End any one session on the platform. Audited with the target account."""
    session = (
        db.query(UserSession).options(joinedload(UserSession.user)).filter(UserSession.id == session_id).first()
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if session.revoked_at is not None:
        return {"id": session.id, "revoked": True}

    session.revoked_at = datetime.now(timezone.utc)
    db.add(session)
    db.add(
        AuditLog(
            user_id=actor.id,
            action="admin.session_revoked",
            entity_type="user_session",
            entity_id=session.id,
            details={"target_user_id": session.user_id, "target_email": session.user.email if session.user else None},
            ip_address=ip,
        )
    )
    db.commit()
    return {"id": session.id, "revoked": True}
