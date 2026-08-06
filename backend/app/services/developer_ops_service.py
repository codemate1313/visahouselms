"""Read-mostly operations surface for the developer layer.

Health, the audit trail, background jobs, webhook deliveries, config-change
history and the developer IP allowlist - the things you look at to know the
platform is healthy and to see what has changed. Writes here are limited to the
allowlist; everything else is a read over data other parts of the system
already record.
"""
import shutil
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core import maintenance
from app.models.audit_log import AuditLog
from app.models.backup import Backup
from app.models.error_log import ErrorLog
from app.models.job import Job
from app.models.user import User
from app.services import geoip_service, settings_service

ALLOWLIST_KEY = "platform.developer_ip_allowlist"


# ---- Health -------------------------------------------------------------

def health(db: Session) -> dict:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    hour_ago = now - timedelta(hours=1)

    # DB is reachable if this function is running, but a trivial round-trip
    # confirms the session is live rather than assuming it.
    try:
        db.query(func.count(User.id)).scalar()
        db_ok = True
    except Exception:
        db_ok = False

    last_backup = db.query(Backup).order_by(Backup.created_at.desc()).first()
    errors_last_hour = db.query(func.count(ErrorLog.id)).filter(ErrorLog.created_at >= hour_ago).scalar() or 0
    failed_jobs = db.query(func.count(Job.id)).filter(Job.status == "failed").scalar() or 0
    pending_jobs = db.query(func.count(Job.id)).filter(Job.status == "pending").scalar() or 0

    try:
        usage = shutil.disk_usage("/")
        disk = {
            "total_gb": round(usage.total / 1e9, 1),
            "used_gb": round(usage.used / 1e9, 1),
            "free_gb": round(usage.free / 1e9, 1),
            "used_percent": round(usage.used / usage.total * 100, 1) if usage.total else None,
        }
    except Exception:
        disk = None

    # Is the GeoIP database actually available? locate() on a known public IP
    # tells us without needing to know the file path here.
    geoip_ok = geoip_service.locate("8.8.8.8").get("resolved", False)

    return {
        "generated_at": now.isoformat(),
        "database_ok": db_ok,
        "maintenance": maintenance.is_enabled(db),
        "read_only": maintenance.is_read_only(db),
        "geoip_available": geoip_ok,
        "errors_last_hour": errors_last_hour,
        "failed_jobs": failed_jobs,
        "pending_jobs": pending_jobs,
        "last_backup": (
            {"filename": last_backup.filename, "status": last_backup.status, "created_at": last_backup.created_at}
            if last_backup
            else None
        ),
        "disk": disk,
    }


# ---- Audit trail --------------------------------------------------------

def audit_trail(db: Session, *, action: Optional[str] = None, limit: int = 100, offset: int = 0) -> dict:
    query = db.query(AuditLog).options(joinedload(AuditLog.user)) if hasattr(AuditLog, "user") else db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    total = query.with_entities(func.count(AuditLog.id)).scalar() or 0
    rows = query.order_by(AuditLog.created_at.desc()).limit(min(limit, 200)).offset(offset).all()

    # Resolve actor emails in one query rather than N.
    actor_ids = [r.user_id for r in rows if r.user_id]
    emails = {}
    if actor_ids:
        emails = {u.id: u.email for u in db.query(User.id, User.email).filter(User.id.in_(actor_ids)).all()}

    return {
        "total": total,
        "entries": [
            {
                "id": r.id,
                "action": r.action,
                "entity_type": r.entity_type,
                "entity_id": r.entity_id,
                "actor_id": r.user_id,
                "actor_email": emails.get(r.user_id),
                "details": r.details,
                "ip_address": r.ip_address,
                "created_at": r.created_at,
            }
            for r in rows
        ],
    }


def config_history(db: Session, *, limit: int = 100) -> dict:
    """Config-change history is the audit trail narrowed to settings writes.

    Those are already recorded by the settings endpoints as `dev_settings.*`
    actions with entity_type "settings", so this reads them rather than adding a
    parallel record. The action name carries which group changed (smtp, payment
    gateways, and so on)."""
    rows = (
        db.query(AuditLog)
        .filter(AuditLog.entity_type == "settings")
        .order_by(AuditLog.created_at.desc())
        .limit(min(limit, 200))
        .all()
    )
    actor_ids = [r.user_id for r in rows if r.user_id]
    emails = {}
    if actor_ids:
        emails = {u.id: u.email for u in db.query(User.id, User.email).filter(User.id.in_(actor_ids)).all()}

    def _label(action: str) -> str:
        return action.replace("dev_settings.update_", "").replace("dev_settings.", "").replace("_", " ").title()

    return {
        "entries": [
            {
                "id": r.id,
                "change": _label(r.action or ""),
                "action": r.action,
                "actor_email": emails.get(r.user_id),
                "created_at": r.created_at,
                "ip_address": r.ip_address,
            }
            for r in rows
        ]
    }


# ---- Jobs & webhooks ----------------------------------------------------

def jobs(db: Session, *, status: Optional[str] = None, limit: int = 100) -> dict:
    query = db.query(Job)
    if status:
        query = query.filter(Job.status == status)
    rows = query.order_by(Job.created_at.desc()).limit(min(limit, 200)).all()
    return {
        "jobs": [
            {
                "id": j.id,
                "type": j.type,
                "status": j.status,
                "result": (j.result or "")[:300] if j.result else None,
                "created_at": j.created_at,
                "started_at": j.started_at,
                "finished_at": j.finished_at,
            }
            for j in rows
        ]
    }


# ---- IP allowlist -------------------------------------------------------

def get_ip_allowlist(db: Session) -> list[str]:
    raw = settings_service.get_setting(db, ALLOWLIST_KEY) or ""
    return [ip.strip() for ip in raw.split(",") if ip.strip()]


def set_ip_allowlist(db: Session, actor: User, ips: list[str], ip: Optional[str]) -> list[str]:
    cleaned = [entry.strip() for entry in ips if entry.strip()][:50]
    settings_service.set_setting(db, ALLOWLIST_KEY, ",".join(cleaned))
    db.add(
        AuditLog(
            user_id=actor.id,
            action="developer.ip_allowlist_updated",
            entity_type="platform",
            entity_id=None,
            details={"count": len(cleaned)},
            ip_address=ip,
        )
    )
    db.commit()
    return cleaned


def ip_is_allowed(db: Session, request_ip: Optional[str]) -> bool:
    """An empty allowlist means unrestricted. A non-empty one admits only listed
    IPs; loopback is always allowed so a local developer is never locked out."""
    allow = get_ip_allowlist(db)
    if not allow:
        return True
    if request_ip in ("127.0.0.1", "::1", None):
        return True
    return request_ip in allow
