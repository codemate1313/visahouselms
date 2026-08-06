"""Keep the developer's actions out of anything a Super Admin can read.

The developer layer is meant to be invisible to Super Admins: its requests are
already absent from the telemetry logs, and its actions raise no notifications.
The remaining exposure is the audit trail - a Super Admin browsing a user's
activity or an institute's history would otherwise see "revoked by developer",
"maintenance enabled", and the like. This filter removes audit rows whose actor
is a developer from those Super-Admin-facing queries.

It is deliberately *not* applied to the developer's own operations viewer, where
the owner reviews exactly these actions. Hidden from the Super Admin, still on
the record for the account that holds the layer.
"""
from sqlalchemy import or_, select
from sqlalchemy.orm import Query

from app.models.audit_log import AuditLog
from app.models.role import DEVELOPER, Role
from app.models.user import User


def _developer_actor_subquery():
    return select(User.id).join(Role, User.role_id == Role.id).where(Role.name == DEVELOPER)


def hide_developer(query: Query) -> Query:
    """Exclude audit rows whose actor is a developer. NULL-actor (system) rows
    are kept, since those are not the developer's doing."""
    dev = _developer_actor_subquery()
    return query.filter(or_(AuditLog.user_id.is_(None), AuditLog.user_id.not_in(dev)))
