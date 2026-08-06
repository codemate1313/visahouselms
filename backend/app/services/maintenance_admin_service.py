"""The audited toggle behind the maintenance kill switch.

`core/maintenance` owns the flag and the cache; this owns the decision to flip
it and the record of who did. Closing or opening the whole platform is the most
consequential single action in the panel, so it is never a bare setting write -
it is audited like any other privileged change, with the actor and the state.
"""
from typing import Optional

from sqlalchemy.orm import Session

from app.core import maintenance
from app.models.audit_log import AuditLog
from app.models.user import User


def get_state(db: Session) -> dict:
    return {
        "maintenance": maintenance.is_enabled(db),
        "message": maintenance.get_message(db),
    }


def set_state(
    db: Session,
    actor: User,
    enabled: bool,
    message: Optional[str],
    ip: Optional[str],
) -> dict:
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
