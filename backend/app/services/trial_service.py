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
