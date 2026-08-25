"""Per-user data export and erasure.

Export gathers what the platform holds about one account into a single JSON
document - the profile, their attempts, payments and sessions - so a data
request can be answered without a database spelunk. Erasure retires the account
and strips the personal fields from the row while leaving the immutable
financial and audit history attached to an anonymised identity, the same shape
delete already uses.

Both are audited. Erasure is irreversible in intent, so the caller confirms it
in the UI; this layer just does what it is told and records who told it.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models.attempt import TestAttempt
from app.models.audit_log import AuditLog
from app.models.notification import StudentNotification
from app.models.payment import Payment
from app.models.push_device_token import PushDeviceToken
from app.models.user import User
from app.models.user_session import UserSession
from app.services import account_service


def _get_user(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def export_user(db: Session, actor: User, user_id: int, ip: Optional[str]) -> dict:
    user = _get_user(db, user_id)

    attempts = db.query(TestAttempt).filter(TestAttempt.user_id == user_id).all()
    payments = db.query(Payment).filter(Payment.user_id == user_id).all()
    sessions = db.query(UserSession).filter(UserSession.user_id == user_id).all()

    db.add(
        AuditLog(
            user_id=actor.id,
            action="gdpr.export",
            entity_type="user",
            entity_id=user.id,
            details={"email": user.email},
            ip_address=ip,
        )
    )
    db.commit()

    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "profile": {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone_number": user.phone_number,
            "address": user.address,
            "role": user.role.name if user.role else None,
            "institute_id": user.institute_id,
            "created_at": str(user.created_at),
        },
        "attempts": [
            {"id": a.id, "module_id": a.module_id, "status": getattr(a, "status", None), "created_at": str(a.created_at)}
            for a in attempts
        ],
        "payments": [
            {"id": p.id, "amount": str(p.amount), "final_amount": str(p.final_amount), "status": p.status, "created_at": str(p.created_at)}
            for p in payments
        ],
        "sessions": [
            {"id": s.id, "ip_address": s.ip_address, "user_agent": s.user_agent, "created_at": str(s.created_at)}
            for s in sessions
        ],
    }


def erase_user(db: Session, actor: User, user_id: int, ip: Optional[str]) -> dict:
    """Retire and anonymise. The row and its financial links survive under a
    scrubbed identity; the person's own details do not."""
    user = _get_user(db, user_id)
    if user.is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="The owner account cannot be erased.")
    if user.id == actor.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot erase your own account here.")

    original_email = user.email

    # Retire first (releases the email, ends sessions, sets deleted_at), then
    # scrub the remaining personal fields.
    account_service.soft_delete_user(db, user)
    user.first_name = "Erased"
    user.last_name = "User"
    user.phone_number = None
    user.address = None
    if user.avatar_path:
        old_avatar = settings.storage_path / user.avatar_path
        if old_avatar.is_file():
            old_avatar.unlink()
        user.avatar_path = None
    db.add(user)
    db.query(PushDeviceToken).filter(PushDeviceToken.user_id == user.id).delete()
    db.query(StudentNotification).filter(StudentNotification.user_id == user.id).delete()
    db.add(
        AuditLog(
            user_id=actor.id,
            action="gdpr.erase",
            entity_type="user",
            entity_id=user.id,
            details={"original_email": original_email},
            ip_address=ip,
        )
    )
    db.commit()
    return {"id": user.id, "erased": True}
