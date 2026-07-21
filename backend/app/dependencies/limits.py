"""Automatic SaaS limit enforcement (roadmap 2.1/2.6) - THE single place where
plan limits are checked. Every future endpoint that adds a tenant-scoped
resource (institute students/staff in Phase 4, tests in Phase 3) must call
enforce_limit() before creating the row; nothing else should re-implement
these checks.
"""

from typing import Callable, Dict

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.role import INST_INSTRUCTOR, STUDENT, Role
from app.models.user import User
from app.services.subscription_service import (
    STATE_ACTIVE,
    STATE_GRACE,
    current_subscription,
)

HTTP_402_PAYMENT_REQUIRED = 402


def _count_users_with_roles(db: Session, institute_id: int, role_names) -> int:
    role_ids = [
        role.id for role in db.query(Role).filter(Role.name.in_(role_names)).all()
    ]
    if not role_ids:
        return 0
    return (
        db.query(User)
        .filter(
            User.institute_id == institute_id,
            User.role_id.in_(role_ids),
            User.deleted_at.is_(None),
        )
        .count()
    )


def _count_students(db: Session, institute_id: int) -> int:
    return _count_users_with_roles(db, institute_id, [STUDENT])


def _count_staff(db: Session, institute_id: int) -> int:
    return _count_users_with_roles(db, institute_id, [INST_INSTRUCTOR])


def _count_tests(db: Session, institute_id: int) -> int:
    from app.models.attempt import TestAttempt

    return (
        db.query(TestAttempt)
        .join(User, TestAttempt.user_id == User.id)
        .filter(User.institute_id == institute_id)
        .count()
    )


# resource name -> (counter, plan limit attribute)
RESOURCE_REGISTRY: Dict[str, tuple] = {
    "students": (_count_students, "student_limit"),
    "staff": (_count_staff, "staff_limit"),
    "tests": (_count_tests, "test_limit"),
}


def enforce_limit(db: Session, institute_id: int, resource: str) -> None:
    """Raises HTTP 402 when the institute's plan is missing/expired or the
    resource is at its limit. Grace period keeps the institute fully working;
    only true expiry (or no subscription) blocks additions."""
    if resource not in RESOURCE_REGISTRY:
        raise ValueError(f"Unknown limited resource '{resource}'")

    from app.models.institute import Institute

    institute = db.get(Institute, institute_id)
    if institute is not None and institute.onboarding_status == "draft":
        counter, limit_attr = RESOURCE_REGISTRY[resource]
        limit = getattr(institute, limit_attr)
        if limit is None:
            raise HTTPException(status_code=HTTP_402_PAYMENT_REQUIRED, detail="Agreement limits have not been configured")
        count = counter(db, institute_id)
        if count >= limit:
            raise HTTPException(status_code=HTTP_402_PAYMENT_REQUIRED, detail=f"Agreement limit reached: {count}/{limit} {resource}.")
        return

    subscription, state = current_subscription(db, institute_id)

    if state not in (STATE_ACTIVE, STATE_GRACE):
        raise HTTPException(
            status_code=HTTP_402_PAYMENT_REQUIRED,
            detail=(
                "This institute has no active subscription. "
                "Purchase or renew a plan to continue."
            ),
        )

    if resource == "tests" and subscription.plan.is_internal:
        return

    counter, limit_attr = RESOURCE_REGISTRY[resource]
    limit = getattr(subscription.plan, limit_attr)
    count = counter(db, institute_id)
    if count >= limit:
        raise HTTPException(
            status_code=HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Plan limit reached: {count}/{limit} {resource}. "
                "Upgrade the plan to add more."
            ),
        )
