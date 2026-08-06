"""Platform-wide analytics for the developer panel.

Money, people and traffic in one place, across every tenant. Money reuses
`revenue_service`, which already knows what counts as collected (paid plus the
received part of a partial) so this cannot drift from the revenue screen. People
and traffic are counted here.
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.attempt import Enrollment
from app.models.institute import Institute
from app.models.payment import Payment
from app.models.role import (
    INST_INSTRUCTOR,
    INSTITUTE_ADMIN,
    SA_INSTRUCTOR,
    STUDENT,
    Role,
)
from app.models.subscription import Subscription
from app.models.user import User
from app.services import revenue_service, traffic_service

# Collected cash carries the same definition as the revenue screen.
_REVENUE_STATUSES = revenue_service.REVENUE_STATUSES


def _role_counts(db: Session) -> dict:
    """Live users per role, excluding retired accounts.

    Grouped in one query rather than a count per role; the directory can grow
    large and this endpoint should stay cheap enough to load on every panel open.
    """
    rows = (
        db.query(Role.name, func.count(User.id))
        .join(User, User.role_id == Role.id)
        .filter(User.deleted_at.is_(None))
        .group_by(Role.name)
        .all()
    )
    by_role = {name: count for name, count in rows}
    return {
        "students": by_role.get(STUDENT, 0),
        "institute_admins": by_role.get(INSTITUTE_ADMIN, 0),
        "institute_instructors": by_role.get(INST_INSTRUCTOR, 0),
        "sa_instructors": by_role.get(SA_INSTRUCTOR, 0),
        "total": sum(by_role.values()),
    }


def overview(db: Session, traffic_days: int = 30) -> dict:
    revenue = revenue_service.summary(db)

    active_institutes = db.query(Institute).filter(Institute.is_active.is_(True)).count()
    total_institutes = db.query(Institute).count()
    enrollments = db.query(Enrollment).count()
    active_subscriptions = (
        db.query(Subscription).filter(Subscription.cancelled_at.is_(None)).count()
    )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "money": {
            # revenue_service already returns these as exact-decimal strings, so
            # they pass straight through - one definition of "collected", shared
            # with the revenue screen.
            "total_collected": revenue["total_revenue"],
            "b2b_collected": revenue["b2b_revenue"],
            "b2c_collected": revenue["b2c_revenue"],
            "outstanding_due": revenue["total_due"],
            "transaction_count": revenue["transaction_count"],
            "currency": "INR",
        },
        "people": {
            **_role_counts(db),
            "enrollments": enrollments,
        },
        "platform": {
            "active_institutes": active_institutes,
            "total_institutes": total_institutes,
            "active_subscriptions": active_subscriptions,
        },
        "traffic": traffic_service.summary(db, days=traffic_days),
    }
