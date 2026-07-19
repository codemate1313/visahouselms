from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.cache import app_cache
from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.audit_log import AuditLog
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.schemas.dev import (
    BackupSettingsIn,
    FcmSettingsIn,
    LogSettingsIn,
    SmtpSettingsIn,
    TestEmailIn,
    TestFcmIn,
)
from app.services import fcm_service, job_service, smtp_service
from app.services.settings_service import get_settings_group, set_settings_group
from app.config import settings as app_config

router = APIRouter(
    prefix="/super-admin/dev-settings",
    tags=["dev-settings"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


def _audit(db: Session, actor: User, action: str, request: Request, details=None) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            action=action,
            entity_type="settings",
            entity_id=None,
            details=details,
            ip_address=request.client.host if request.client else None,
        )
    )
    db.commit()


# ---------- SMTP ----------

@router.get("/smtp")
def get_smtp(db: Session = Depends(get_db)):
    return get_settings_group(db, "smtp")


@router.put("/smtp")
def put_smtp(
    payload: SmtpSettingsIn,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    set_settings_group(db, "smtp", payload.model_dump())
    _audit(db, actor, "dev_settings.update_smtp", request)
    return get_settings_group(db, "smtp")


@router.post("/smtp/test")
def test_smtp(payload: TestEmailIn, db: Session = Depends(get_db)):
    smtp_service.send_test_email(db, payload.to_address)
    return {"sent": True, "to": payload.to_address}


# ---------- FCM ----------

@router.get("/fcm")
def get_fcm(db: Session = Depends(get_db)):
    return fcm_service.get_config_status(db)


@router.put("/fcm")
def put_fcm(
    payload: FcmSettingsIn,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    if payload.service_account_json:
        fcm_service.validate_service_account_json(payload.service_account_json)
    set_settings_group(db, "fcm", payload.model_dump())
    _audit(db, actor, "dev_settings.update_fcm", request)
    return fcm_service.get_config_status(db)


@router.post("/fcm/test")
def test_fcm(payload: TestFcmIn, db: Session = Depends(get_db)):
    if payload.device_token:
        return fcm_service.send_test_notification(
            db, payload.device_token, "IELTS LMS", "FCM test notification"
        )
    return fcm_service.test_credentials(db)


# ---------- Backup / log settings ----------

@router.get("/backup")
def get_backup_settings(db: Session = Depends(get_db)):
    return get_settings_group(db, "backup")


@router.put("/backup")
def put_backup_settings(
    payload: BackupSettingsIn,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    if payload.schedule and payload.schedule not in ("none", "daily", "weekly"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="schedule must be none, daily, or weekly")
    set_settings_group(db, "backup", payload.model_dump())
    _audit(db, actor, "dev_settings.update_backup", request)
    return get_settings_group(db, "backup")


@router.get("/logs")
def get_log_settings(db: Session = Depends(get_db)):
    return get_settings_group(db, "logs")


@router.put("/logs")
def put_log_settings(
    payload: LogSettingsIn,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    set_settings_group(db, "logs", payload.model_dump())
    _audit(db, actor, "dev_settings.update_logs", request)
    return get_settings_group(db, "logs")


# ---------- Maintenance actions ----------

@router.post("/migrate")
def run_migrations(
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    job = job_service.enqueue(db, "migrate")
    _audit(db, actor, "dev_settings.run_migrations", request, {"job_id": job.id})
    return {"job_id": job.id, "status": job.status}


@router.post("/clear-cache")
def clear_cache(
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    cleared = app_cache.clear_all()
    _audit(db, actor, "dev_settings.clear_cache", request, {"entries_cleared": cleared})
    return {"cleared": True, "entries_cleared": cleared}


@router.post("/storage-link")
def storage_link(
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    """Validate/create the local storage layout (Laravel storage:link equivalent
    for our direct-mount setup) and report status."""
    root = app_config.storage_path
    created = []
    for sub in ("", "avatars", "backups"):
        path = root / sub if sub else root
        if not path.exists():
            path.mkdir(parents=True, exist_ok=True)
            created.append(str(path))
    writable = True
    try:
        probe = root / ".write_probe"
        probe.write_text("ok")
        probe.unlink()
    except OSError:
        writable = False
    _audit(db, actor, "dev_settings.storage_link", request)
    return {
        "storage_root": str(root),
        "mounted_at": "/storage",
        "writable": writable,
        "created": created,
    }


@router.get("/jobs/{job_id}")
def job_status(job_id: int, db: Session = Depends(get_db)):
    job = job_service.get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return {
        "id": job.id,
        "type": job.type,
        "status": job.status,
        "result": job.result,
        "created_at": job.created_at,
        "started_at": job.started_at,
        "finished_at": job.finished_at,
    }
