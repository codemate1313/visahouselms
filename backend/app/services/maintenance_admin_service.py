"""The audited toggle behind the maintenance kill switch.

`core/maintenance` owns the flag and the cache; this owns the decision to flip
it and the record of who did. Closing or opening the whole platform is the most
consequential single action in the panel, so it is never a bare setting write -
it is audited like any other privileged change, with the actor and the state.
"""
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core import maintenance
from app.core.security import hash_strong_secret, verify_strong_secret
from app.models.audit_log import AuditLog
from app.models.user import User
from app.services import settings_service

# The bcrypt hash of the shutdown password, stored in the settings table. It is
# already a one-way hash, so it is not additionally encrypted; there is nothing
# reversible to protect.
KILL_PASSWORD_KEY = "platform.maintenance_kill_password_hash"


def _password_hash(db: Session) -> Optional[str]:
    return settings_service.get_setting(db, KILL_PASSWORD_KEY)


def get_state(db: Session) -> dict:
    return {
        "maintenance": maintenance.is_enabled(db),
        "message": maintenance.get_message(db),
        # Whether a shutdown password has been set, so the UI knows to ask the
        # developer to set one before the site can be closed. The hash itself is
        # never returned.
        "password_set": bool(_password_hash(db)),
    }


def set_kill_password(
    db: Session,
    actor: User,
    new_password: str,
    current_password: Optional[str],
    ip: Optional[str],
) -> dict:
    """Set or change the password that shutting the site down requires.

    Once a password exists, changing it requires knowing the current one - a
    hijacked session cannot quietly swap in a new shutdown secret. The value is
    stored only as a high-cost bcrypt hash; the plaintext is never persisted.
    """
    new_password = (new_password or "").strip()
    if len(new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The shutdown password must be at least 8 characters.",
        )

    existing = _password_hash(db)
    if existing and not verify_strong_secret(current_password or "", existing):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The current shutdown password is incorrect.",
        )

    settings_service.set_setting(db, KILL_PASSWORD_KEY, hash_strong_secret(new_password))
    db.add(
        AuditLog(
            user_id=actor.id,
            action="platform.maintenance_password_set" if not existing else "platform.maintenance_password_changed",
            entity_type="platform",
            entity_id=None,
            details=None,
            ip_address=ip,
        )
    )
    db.commit()
    return get_state(db)


def reset_kill_password(db: Session, actor: User, ip: Optional[str]) -> dict:
    """Owner-only recovery for a forgotten shutdown password.

    Clears the stored hash so a fresh password can be set from scratch, without
    a database edit. Restricted to the owner because it removes the very control
    that guards closing the site.
    """
    if not actor.is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner account can reset the shutdown password.",
        )
    settings_service.set_setting(db, KILL_PASSWORD_KEY, None)
    db.add(
        AuditLog(
            user_id=actor.id,
            action="platform.maintenance_password_reset",
            entity_type="platform",
            entity_id=None,
            details=None,
            ip_address=ip,
        )
    )
    db.commit()
    return get_state(db)


def set_read_only(db: Session, actor: User, enabled: bool, ip: Optional[str]) -> dict:
    maintenance.set_read_only(db, enabled)
    db.add(
        AuditLog(
            user_id=actor.id,
            action="platform.read_only_enabled" if enabled else "platform.read_only_disabled",
            entity_type="platform",
            entity_id=None,
            details=None,
            ip_address=ip,
        )
    )
    db.commit()
    return get_state(db)


def set_state(
    db: Session,
    actor: User,
    enabled: bool,
    message: Optional[str],
    password: Optional[str],
    ip: Optional[str],
) -> dict:
    """Open or close the platform.

    Closing requires the shutdown password; reopening does not, because the risk
    is one-directional - the harm is in taking the site down, not in bringing it
    back. If no password has been set yet, the site cannot be closed until one
    is, so the switch can never be thrown without the secret existing.
    """
    if enabled:
        stored = _password_hash(db)
        if not stored:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Set a shutdown password before the site can be closed.",
            )
        if not verify_strong_secret(password or "", stored):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Incorrect shutdown password.",
            )

    maintenance.set_enabled(db, enabled, message)
    db.add(
        AuditLog(
            user_id=actor.id,
            action="platform.maintenance_enabled" if enabled else "platform.maintenance_disabled",
            entity_type="platform",
            entity_id=None,
            details={"message": message} if enabled else None,
            ip_address=ip,
        )
    )
    db.commit()
    return get_state(db)
