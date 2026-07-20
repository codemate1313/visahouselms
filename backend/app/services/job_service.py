import subprocess
import sys
import threading
import traceback
from datetime import datetime, timedelta, timezone
from typing import Callable, Dict, Optional

from sqlalchemy.orm import Session

from app.config import BACKEND_DIR
from app.database import SessionLocal
from app.models.crash_log import CrashLog
from app.models.job import JOB_DONE, JOB_FAILED, JOB_PENDING, JOB_RUNNING, Job

POLL_INTERVAL_SECONDS = 3
SCHEDULER_INTERVAL_SECONDS = 60

_worker_thread: Optional[threading.Thread] = None
_scheduler_thread: Optional[threading.Thread] = None
_stop_event = threading.Event()


def enqueue(db: Session, job_type: str, payload: Optional[dict] = None) -> Job:
    job = Job(type=job_type, payload=payload, status=JOB_PENDING)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_job(db: Session, job_id: int) -> Optional[Job]:
    return db.get(Job, job_id)


# ---------- handlers ----------

def _run_migrations(db: Session, payload: Optional[dict]) -> str:
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=str(BACKEND_DIR),
        capture_output=True,
        text=True,
        timeout=300,
    )
    output = (result.stdout or "") + (result.stderr or "")
    if result.returncode != 0:
        raise RuntimeError(f"alembic exited with {result.returncode}:\n{output}")
    return output.strip() or "Migrations are up to date."


def _run_backup(db: Session, payload: Optional[dict]) -> str:
    from app.services import backup_service

    kind = (payload or {}).get("kind", "manual")
    backup = backup_service.run_backup(db, kind=kind)
    return f"Backup created: {backup.filename} ({backup.size_bytes} bytes)"


def _purge_logs(db: Session, payload: Optional[dict]) -> str:
    from app.services import log_service

    deleted = log_service.purge_request_logs(db)
    return f"Purged {deleted} request log rows past retention."


HANDLERS: Dict[str, Callable[[Session, Optional[dict]], str]] = {
    "migrate": _run_migrations,
    "backup": _run_backup,
    "purge_logs": _purge_logs,
}


# ---------- worker ----------

def _process_one(db: Session) -> bool:
    job = (
        db.query(Job)
        .filter(Job.status == JOB_PENDING)
        .order_by(Job.created_at)
        .with_for_update(skip_locked=True)
        .first()
    )
    if job is None:
        db.rollback()
        return False

    job.status = JOB_RUNNING
    job.started_at = datetime.now(timezone.utc)
    db.commit()

    handler = HANDLERS.get(job.type)
    try:
        if handler is None:
            raise RuntimeError(f"No handler registered for job type '{job.type}'")
        result = handler(db, job.payload)
        job.status = JOB_DONE
        job.result = result[:60000]
    except Exception:
        job.status = JOB_FAILED
        job.result = traceback.format_exc()[:60000]
    job.finished_at = datetime.now(timezone.utc)
    db.commit()
    return True


def _worker_loop() -> None:
    while not _stop_event.is_set():
        try:
            db = SessionLocal()
            try:
                worked = _process_one(db)
            finally:
                db.close()
            if not worked:
                _stop_event.wait(POLL_INTERVAL_SECONDS)
        except Exception:
            _record_worker_fatal(traceback.format_exc())
            _stop_event.wait(POLL_INTERVAL_SECONDS)


def _record_worker_fatal(detail: str) -> None:
    try:
        db = SessionLocal()
        try:
            db.add(CrashLog(kind="worker_fatal", detail=detail[:60000]))
            db.commit()
        finally:
            db.close()
    except Exception:
        pass  # never let crash reporting kill the worker loop


# ---------- scheduler ----------

def _scheduler_tick() -> None:
    from app.services.settings_service import get_setting, set_setting

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)

        # scheduled backups
        schedule = (get_setting(db, "backup.schedule") or "none").lower()
        if schedule in ("daily", "weekly"):
            from app.models.backup import Backup

            interval = timedelta(days=1 if schedule == "daily" else 7)
            last = (
                db.query(Backup)
                .filter(Backup.kind == "scheduled", Backup.status == "done")
                .order_by(Backup.created_at.desc())
                .first()
            )
            last_at = last.created_at.replace(tzinfo=timezone.utc) if last else None
            pending_exists = (
                db.query(Job)
                .filter(Job.type == "backup", Job.status.in_([JOB_PENDING, JOB_RUNNING]))
                .count()
                > 0
            )
            if not pending_exists and (last_at is None or now - last_at >= interval):
                enqueue(db, "backup", {"kind": "scheduled"})

        # daily request-log purge
        last_purge_raw = get_setting(db, "internal.last_log_purge")
        last_purge = datetime.fromisoformat(last_purge_raw) if last_purge_raw else None
        if last_purge is None or now - last_purge >= timedelta(days=1):
            enqueue(db, "purge_logs", None)
            set_setting(db, "internal.last_log_purge", now.isoformat())

        # expired, unconverted demo accounts get their institute suspended
        from app.services.demo_service import suspend_expired_demos

        suspend_expired_demos(db)
    finally:
        db.close()


def _scheduler_loop() -> None:
    while not _stop_event.is_set():
        try:
            _scheduler_tick()
        except Exception:
            _record_worker_fatal(traceback.format_exc())
        _stop_event.wait(SCHEDULER_INTERVAL_SECONDS)


# ---------- lifecycle ----------

def _recover_stale_running_jobs() -> None:
    """Jobs stuck in 'running' at startup were interrupted - either the process
    died mid-job (kill -9/crash) or a DB restore resurrected the job row that
    was running while its own dump was taken. Nothing will ever finish them."""
    db = SessionLocal()
    try:
        stale = db.query(Job).filter(Job.status == JOB_RUNNING).all()
        for job in stale:
            job.status = JOB_FAILED
            job.result = "Interrupted (server restart or database restore)."
            job.finished_at = datetime.now(timezone.utc)
        if stale:
            db.commit()
    finally:
        db.close()


def start_background_threads() -> None:
    global _worker_thread, _scheduler_thread
    if _worker_thread is not None and _worker_thread.is_alive():
        return
    _recover_stale_running_jobs()
    _stop_event.clear()
    _worker_thread = threading.Thread(target=_worker_loop, name="job-worker", daemon=True)
    _scheduler_thread = threading.Thread(target=_scheduler_loop, name="job-scheduler", daemon=True)
    _worker_thread.start()
    _scheduler_thread.start()


def stop_background_threads() -> None:
    _stop_event.set()
