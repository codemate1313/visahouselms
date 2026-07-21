from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.demo_account import DemoAccount
from app.models.user import User
from app.services import institute_service

STATE_ACTIVE = "active"
STATE_EXPIRED = "expired"
STATE_CONVERTED = "converted"


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _audit(db: Session, actor: User, action: str, entity_id: Optional[int], ip: Optional[str], details=None) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            action=action,
            entity_type="demo_account",
            entity_id=entity_id,
            details=details,
            ip_address=ip,
        )
    )


def _state(demo: DemoAccount) -> str:
    if demo.converted_at is not None:
        return STATE_CONVERTED
    if _now() >= demo.expires_at:
        return STATE_EXPIRED
    return STATE_ACTIVE


def _serialize(demo: DemoAccount) -> dict:
    state = _state(demo)
    days_remaining = None
    if state == STATE_ACTIVE:
        days_remaining = max(0, (demo.expires_at - _now()).days)
    return {
        "id": demo.id,
        "institute_id": demo.institute_id,
        "institute_name": demo.institute.name if demo.institute else None,
        "duration_days": demo.duration_days,
        "course_limit": demo.course_limit,
        "test_limit": demo.test_limit,
        "expires_at": demo.expires_at,
        "converted_at": demo.converted_at,
        "state": state,
        "days_remaining": days_remaining,
        "created_at": demo.created_at,
    }


def create_demo(
    db: Session,
    actor: User,
    name: str,
    admin_email: str,
    admin_first_name: str,
    admin_last_name: str,
    duration_days: int,
    course_limit: int,
    test_limit: int,
    ip: Optional[str],
) -> dict:
    institute_result = institute_service.create_institute(
        db, actor, name, None, admin_email, admin_first_name, admin_last_name, {}, 24, ip
    )

    demo = DemoAccount(
        institute_id=institute_result["id"],
        duration_days=duration_days,
        course_limit=course_limit,
        test_limit=test_limit,
        expires_at=_now() + timedelta(days=duration_days),
    )
    db.add(demo)
    _audit(db, actor, "demo_account.create", None, ip, {"institute_id": institute_result["id"], "name": name})
    db.commit()
    db.refresh(demo)

    result = _serialize(demo)
    result["admin_email"] = institute_result["admin_email"]
    result["admin_temp_password"] = institute_result["admin_temp_password"]
    return result


def get_demo_or_404(db: Session, demo_id: int) -> DemoAccount:
    demo = db.get(DemoAccount, demo_id)
    if demo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demo account not found")
    return demo


def get_demo_status(db: Session, demo_id: int) -> dict:
    return _serialize(get_demo_or_404(db, demo_id))


def list_demos(db: Session) -> List[dict]:
    demos = db.query(DemoAccount).order_by(DemoAccount.created_at.desc()).all()
    return [_serialize(d) for d in demos]


def mark_converted_if_demo(db: Session, actor: User, institute_id: int, ip: Optional[str]) -> None:
    """Called from subscription_service.assign(): a real paid subscription
    landing on a demo institute converts it - the demo's own limits/expiry stop
    applying, enforce_limit() takes over from here."""
    demo = db.query(DemoAccount).filter(DemoAccount.institute_id == institute_id).first()
    if demo is not None and demo.converted_at is None:
        demo.converted_at = _now()
        db.add(demo)
        _audit(db, actor, "demo_account.convert", demo.id, ip)
        db.commit()


def suspend_expired_demos(db: Session) -> int:
    """Called from the job_service scheduler tick: any unconverted demo past
    its expiry gets its institute suspended (reuses institute_service's
    suspension, which already blocks login for that institute)."""
    now = _now()
    expired = (
        db.query(DemoAccount)
        .filter(DemoAccount.converted_at.is_(None), DemoAccount.expires_at <= now)
        .all()
    )
    suspended = 0
    for demo in expired:
        if demo.institute and demo.institute.is_active:
            demo.institute.is_active = False
            db.add(demo.institute)
            db.add(
                AuditLog(
                    user_id=None,
                    action="institute.suspend",
                    entity_type="institute",
                    entity_id=demo.institute_id,
                    details={"reason": "demo_expired"},
                    ip_address=None,
                )
            )
            suspended += 1
    if suspended:
        db.commit()
    return suspended
