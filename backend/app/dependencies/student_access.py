from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.exam_module import ExamModule
from app.models.attempt import Enrollment
from app.models.course import InstituteCourse
from app.models.exam_module import InstituteModule
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


def has_active_subscription(db: Session, user: User) -> bool:
    """True when the student's institute (B2B) or personal (B2C) access is live.

    Demo access is only granted while this is False, so it has to be generous:
    a student holding a live module entitlement is subscribed even if every
    subscription row has since lapsed, and a student with any live row is
    subscribed even when it is not the row a billing screen would call current.
    """
    if user.institute_id is not None:
        _, state = current_subscription(db, user.institute_id)
        return state in (STATE_ACTIVE, STATE_GRACE)

    if _live_user_subscriptions(db, user.id):
        return True

    from app.services import entitlement_service

    return bool(entitlement_service.entitled_module_ids(db, user.id))


def has_module_access(db: Session, user: User, module_id: int) -> bool:
    """The single place a student's entitlement to a module is resolved -
    B2B (their institute's own Plan subscription) or B2C (their own personal
    Plan subscription). A module is accessible if the current subscription's
    plan includes it. Reused by both the plan-catalog entitled flag and the
    attempt-start check so the two can never drift apart.

    Demo modules are the one exception: free sample tests a student may sit
    while they have no active subscription, so they can try the engine and get
    a score before buying. Once subscribed, normal plan entitlement applies."""
    if not has_active_subscription(db, user):
        from app.services import trial_service

        # Trial Settings govern the demo: the module must be inside the visible
        # course cap and the trial must still be active (duration and test
        # limits not yet spent).
        if trial_service.can_start_demo_module(db, user, module_id):
            return True
    if user.institute_id is not None:
        subscription, state = current_subscription(db, user.institute_id)
        if subscription is None or state not in (STATE_ACTIVE, STATE_GRACE):
            return False
        return (
            db.query(InstituteModule)
            .filter(
                InstituteModule.institute_id == user.institute_id,
                InstituteModule.is_active.is_(True),
                InstituteModule.module_id == module_id,
            )
            .first()
            is not None
        )

    # Direct (B2C) student. Entitlement is per module and stacked, so the
    # ledger is the authority: it already holds the union of every plan they
    # have ever bought, with overlapping modules extended rather than replaced.
    from app.services import entitlement_service

    if entitlement_service.has_entitlement(db, user.id, module_id):
        return True

    # Fallback for anything the ledger has not been told about - a plan edited
    # to include a new module after purchase, or a row the backfill could not
    # reach. Deliberately checks EVERY live subscription, not just the one
    # `current_user_subscription` picks.
    #
    # That single-row check was the original bug: a student holding two plans
    # got exactly one of them honoured, chosen by whichever expired later. Buy a
    # longer second plan and the first plan's modules were revoked with months
    # still paid for; buy a shorter one and it granted nothing at all.
    for subscription in _live_user_subscriptions(db, user.id):
        plan = subscription.plan
        if plan is None:
            continue
        if any(module.id == module_id for module in plan.modules):
            return True
        if any(
            link.module_id == module_id
            for course in plan.courses
            for link in course.course_modules
        ):
            return True
    return False


def _live_user_subscriptions(db: Session, user_id: int):
    """Every one of this student's subscriptions that is active or in grace.

    Access is a union across all of them. Nothing here picks a single
    "governing" row - that concept belongs to billing screens, not to
    entitlement, and conflating the two is what revoked paid-for modules.
    """
    from app.models.subscription import Subscription
    from app.services.subscription_service import state_of_subscription

    rows = (
        db.query(Subscription)
        .filter(Subscription.user_id == user_id, Subscription.cancelled_at.is_(None))
        .all()
    )
    return [row for row in rows if state_of_subscription(row) in (STATE_ACTIVE, STATE_GRACE)]


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
    if module is None or module.status != "published" or not module.is_visible or module.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found")
    if not has_module_access(db, user, module_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your current plan does not include this module",
        )
    return module
