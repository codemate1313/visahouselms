from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.exam_module import ExamModule
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
