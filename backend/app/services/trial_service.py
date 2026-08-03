from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.trial_config import TrialConfig
from app.models.user import User

STATE_ACTIVE = "active"
STATE_LOCKED = "locked"

REASON_DISABLED = "disabled"
REASON_DURATION_EXPIRED = "duration_expired"
REASON_COURSE_LIMIT = "course_limit"
REASON_TEST_LIMIT = "test_limit"


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def get_config(db: Session) -> TrialConfig:
    config = db.query(TrialConfig).first()
    if config is None:
        config = TrialConfig()
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def _serialize_config(config: TrialConfig) -> dict:
    return {
        "id": config.id,
        "trial_duration_days": config.trial_duration_days,
        "course_limit": config.course_limit,
        "test_limit": config.test_limit,
        "is_enabled": config.is_enabled,
        "updated_at": config.updated_at,
    }


def get_config_dict(db: Session) -> dict:
    return _serialize_config(get_config(db))


def update_config(
    db: Session,
    actor: User,
    trial_duration_days: Optional[int],
    course_limit: Optional[int],
    test_limit: Optional[int],
    is_enabled: Optional[bool],
    ip: Optional[str],
) -> dict:
    config = get_config(db)
    if trial_duration_days is not None:
        config.trial_duration_days = trial_duration_days
    if course_limit is not None:
        config.course_limit = course_limit
    if test_limit is not None:
        config.test_limit = test_limit
    if is_enabled is not None:
        config.is_enabled = is_enabled

    db.add(config)
    db.add(
        AuditLog(
            user_id=actor.id,
            action="trial_config.update",
            entity_type="trial_config",
            entity_id=config.id,
            ip_address=ip,
        )
    )
    db.commit()
    db.refresh(config)
    return _serialize_config(config)


def demo_modules(db: Session) -> list:
    """The published modules offered as free demos, capped by the configured
    'courses visible' limit. Ordering is stable (oldest first) so a student does
    not see the set change under them when a new demo module is flagged."""
    from app.models.exam_module import ExamModule

    config = get_config(db)
    rows = (
        db.query(ExamModule)
        .filter(
            ExamModule.is_demo.is_(True),
            ExamModule.status == "published",
            ExamModule.is_visible.is_(True),
            ExamModule.deleted_at.is_(None),
        )
        .order_by(ExamModule.created_at.asc(), ExamModule.id.asc())
        .all()
    )
    return rows[: config.course_limit] if config.course_limit > 0 else []


def demo_tests_taken(db: Session, user: User) -> int:
    """Attempts this student has started on demo modules - the counter behind
    the 'tests allowed' limit."""
    from app.models.attempt import TestAttempt
    from app.models.exam_module import ExamModule

    return (
        db.query(TestAttempt)
        .join(ExamModule, ExamModule.id == TestAttempt.module_id)
        .filter(TestAttempt.user_id == user.id, ExamModule.is_demo.is_(True))
        .count()
    )


def demo_state(db: Session, user: User) -> dict:
    """Live trial state for a student with no subscription: whichever limit is
    hit first locks the rest of the trial. The clock starts at signup.

    This is what makes Trial Settings real - the duration, course and test
    limits are all enforced through this one function.
    """
    config = get_config(db)
    allowed = demo_modules(db)
    allowed_ids = [module.id for module in allowed]
    tests_taken = demo_tests_taken(db, user)

    result = {
        "is_enabled": config.is_enabled,
        "module_ids": allowed_ids,
        "course_limit": config.course_limit,
        "tests_taken": tests_taken,
        "test_limit": config.test_limit,
        "duration_days": config.trial_duration_days,
        "days_remaining": None,
        "state": STATE_ACTIVE,
        "locked_reason": None,
    }

    if not config.is_enabled:
        result.update(state=STATE_LOCKED, locked_reason=REASON_DISABLED, module_ids=[])
        return result

    started = user.created_at or _now()
    days_remaining = config.trial_duration_days - (_now() - started).days
    result["days_remaining"] = max(0, days_remaining)

    if days_remaining <= 0:
        result.update(state=STATE_LOCKED, locked_reason=REASON_DURATION_EXPIRED)
    elif not allowed_ids:
        result.update(state=STATE_LOCKED, locked_reason=REASON_COURSE_LIMIT)
    elif tests_taken >= config.test_limit:
        result.update(state=STATE_LOCKED, locked_reason=REASON_TEST_LIMIT)
    return result


def can_start_demo_module(db: Session, user: User, module_id: int) -> bool:
    """Demo entitlement for a single module: offered as a demo, inside the
    visible-course cap, and the trial still active."""
    state = demo_state(db, user)
    return state["state"] == STATE_ACTIVE and module_id in state["module_ids"]


def set_demo_modules(db: Session, actor: User, module_ids: list, ip: Optional[str]) -> dict:
    """Replace the demo set with exactly these modules."""
    from app.models.exam_module import ExamModule

    wanted = set(module_ids)
    invalid = (
        db.query(ExamModule)
        .filter(
            ExamModule.id.in_(wanted),
            (ExamModule.status != "published") | (ExamModule.is_visible.is_(False)),
        )
        .count()
        if wanted
        else 0
    )
    if invalid:
        from fastapi import HTTPException, status as http_status

        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Only published, visible modules can be offered as free demos",
        )

    for module in db.query(ExamModule).filter(ExamModule.deleted_at.is_(None)).all():
        should_be_demo = module.id in wanted
        if module.is_demo != should_be_demo:
            module.is_demo = should_be_demo
            db.add(module)

    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action="trial_config.demo_modules",
            entity_type="exam_module",
            entity_id=None,
            ip_address=ip,
            details={"module_ids": sorted(wanted)},
        )
    )
    db.commit()
    return list_demo_module_options(db)


def list_demo_module_options(db: Session) -> dict:
    """Every module that could be a demo, plus which ones currently are."""
    from app.models.exam_module import ExamModule

    rows = (
        db.query(ExamModule)
        .filter(
            ExamModule.status == "published",
            ExamModule.is_visible.is_(True),
            ExamModule.deleted_at.is_(None),
        )
        .order_by(ExamModule.created_at.asc(), ExamModule.id.asc())
        .all()
    )
    config = get_config(db)
    return {
        "course_limit": config.course_limit,
        "modules": [
            {
                "id": module.id,
                "title": module.title,
                "module_type": module.module_type,
                "duration_minutes": module.duration_minutes,
                "is_demo": module.is_demo,
            }
            for module in rows
        ],
    }


def get_trial_state(db: Session, user: User, courses_viewed: int = 0, tests_taken: int = 0) -> dict:
    """The roadmap's 'whichever limit hits first locks the rest': check duration
    first, then each usage count against its limit - first true condition wins.
    Only meaningful for direct (institute_id is None) STUDENT users; Phase 5
    signup sets trial_started_at, this function needs nothing else from them."""
    config = get_config(db)

    if not config.is_enabled:
        return {"state": STATE_LOCKED, "locked_reason": REASON_DISABLED, "days_remaining": None}

    if user.trial_started_at is None:
        return {"state": STATE_ACTIVE, "locked_reason": None, "days_remaining": config.trial_duration_days}

    started = user.trial_started_at
    elapsed = _now() - started
    days_remaining = config.trial_duration_days - elapsed.days

    if days_remaining <= 0:
        return {"state": STATE_LOCKED, "locked_reason": REASON_DURATION_EXPIRED, "days_remaining": 0}
    if courses_viewed >= config.course_limit:
        return {"state": STATE_LOCKED, "locked_reason": REASON_COURSE_LIMIT, "days_remaining": days_remaining}
    if tests_taken >= config.test_limit:
        return {"state": STATE_LOCKED, "locked_reason": REASON_TEST_LIMIT, "days_remaining": days_remaining}

    return {"state": STATE_ACTIVE, "locked_reason": None, "days_remaining": days_remaining}
