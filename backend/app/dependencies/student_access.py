from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.exam_module import ExamModule
from app.models.attempt import Enrollment
from app.models.course import InstituteCourse
from app.models.role import STUDENT
from app.models.user import User
from app.services.subscription_service import (
    STATE_ACTIVE,
    STATE_GRACE,
    current_subscription,
    current_user_subscription,
)


def require_student(user: User = Depends(get_current_user)) -> User:
    if user.role.name != STUDENT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student account required")
    return user


def has_module_access(db: Session, user: User, module_id: int) -> bool:
    """The single place a student's entitlement to a module is resolved -
    B2B (their institute's own Plan subscription) or B2C (their own personal
    Plan subscription). A module is accessible if the current subscription's
    plan includes it. Reused by both the plan-catalog entitled flag and the
    attempt-start check so the two can never drift apart."""
    if user.institute_id is not None:
        subscription, state = current_subscription(db, user.institute_id)
    else:
        subscription, state = current_user_subscription(db, user.id)

    if subscription is None or state not in (STATE_ACTIVE, STATE_GRACE):
        return False
    return any(module.id == module_id for module in subscription.plan.modules)


def has_course_access(db: Session, user: User, course_id: int) -> bool:
    """Legacy course entitlement used by the course bundle service/tests.

    Direct students need an active, unexpired Enrollment. Institute students
    inherit active course assignments while their institute subscription is
    active or in grace. Module-plan entitlement remains authoritative for
    starting the newer module-first attempts.
    """
    if user.institute_id is None:
        enrollment = (
            db.query(Enrollment)
            .filter(
                Enrollment.user_id == user.id,
                Enrollment.course_id == course_id,
                Enrollment.is_active.is_(True),
            )
            .first()
        )
        if enrollment is None:
            return False
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        return enrollment.expires_at is None or enrollment.expires_at > now

    _subscription, state = current_subscription(db, user.institute_id)
    if state not in (STATE_ACTIVE, STATE_GRACE):
        return False
    return (
        db.query(InstituteCourse)
        .filter(
            InstituteCourse.institute_id == user.institute_id,
            InstituteCourse.course_id == course_id,
            InstituteCourse.is_active.is_(True),
        )
        .first()
        is not None
    )


def require_module_access(
    module_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_student),
) -> ExamModule:
    module = db.get(ExamModule, module_id)
    if module is None or module.status != "published":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found")
    if not has_module_access(db, user, module_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your current plan does not include this module",
        )
    return module
