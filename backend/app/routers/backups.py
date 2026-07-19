from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.audit_log import AuditLog
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.schemas.dev import RestoreIn
from app.services import backup_service, job_service

router = APIRouter(
    prefix="/super-admin/backups",
    tags=["backups"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


def _audit(db: Session, actor: User, action: str, request: Request, details=None) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            action=action,
            entity_type="backup",
            entity_id=None,
            details=details,
            ip_address=request.client.host if request.client else None,
        )
    )
    db.commit()


@router.get("")
def list_backups(db: Session = Depends(get_db)):
    return [
        {
            "id": b.id,
            "filename": b.filename,
            "size_bytes": b.size_bytes,
            "kind": b.kind,
            "status": b.status,
            "created_at": b.created_at,
        }
        for b in backup_service.list_backups(db)
    ]


@router.post("/run")
def backup_now(
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    job = job_service.enqueue(db, "backup", {"kind": "manual"})
    _audit(db, actor, "backup.run", request, {"job_id": job.id})
    return {"job_id": job.id, "status": job.status}


@router.get("/{backup_id}/download")
def download_backup(backup_id: int, db: Session = Depends(get_db)):
    backup = backup_service.get_backup_or_404(db, backup_id)
    path = backup_service.backup_file_path(backup)
    return FileResponse(path, filename=backup.filename, media_type="application/gzip")


@router.post("/{backup_id}/restore")
def restore_backup(
    backup_id: int,
    payload: RestoreIn,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    if payload.confirmation != "RESTORE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Type "RESTORE" to confirm - this overwrites the current database',
        )
    _audit(db, actor, "backup.restore", request, {"backup_id": backup_id})
    message = backup_service.restore_backup(db, backup_id)
    return {"restored": True, "message": message}


@router.delete("/{backup_id}", status_code=204)
def delete_backup(
    backup_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    _audit(db, actor, "backup.delete", request, {"backup_id": backup_id})
    backup_service.delete_backup(db, backup_id)
