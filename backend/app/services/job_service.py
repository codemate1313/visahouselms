import logging
import subprocess
import sys
import threading
import traceback
from datetime import datetime, timedelta, timezone
from typing import Callable, Dict, Optional

from sqlalchemy.orm import Session

from app.config import BACKEND_DIR
from app.database import SessionLocal
from app.models.attempt import ATTEMPT_GRADING, PART_GRADE_PENDING, AiEvaluation, AttemptPartGrade, TestAttempt
from app.models.crash_log import CrashLog
from app.models.exam_module import ExamModulePart
from app.models.job import JOB_DONE, JOB_FAILED, JOB_PENDING, JOB_RUNNING, Job

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 3
SCHEDULER_INTERVAL_SECONDS = 60
# A provider blip - a 502, a dropped connection, a timeout - failed the job and
# parked the attempt in the instructor queue for good, because recovery treated
# "a job already exists" as "nothing to do" no matter how that job ended. These
# two bound the second chance: wait for the blip to pass, and give up after a
# few tries so a genuinely unmarkable part cannot loop.
AI_RETRY_AFTER_SECONDS = 15 * 60
AI_MAX_AUTOMATIC_ATTEMPTS = 3

_worker_thread: Optional[threading.Thread] = None
_scheduler_thread: Optional[threading.Thread] = None
_stop_event = threading.Event()


def enqueue(db: Session, job_type: str, payload: Optional[dict] = None) -> Job:
    job = Job(type=job_type, payload=payload, status=JOB_PENDING)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def _ai_grade_job_exists(db: Session, attempt_id: int, statuses: Optional[set[str]] = None) -> bool:
    rows = (
        db.query(Job)
        .filter(Job.type == "ai_auto_grade")
        .all()
    )
    if statuses is not None:
        rows = [row for row in rows if row.status in statuses]
    return any((row.payload or {}).get("attempt_id") == attempt_id for row in rows)


def enqueue_ai_auto_grade(db: Session, attempt_id: int) -> Optional[Job]:
    if _ai_grade_job_exists(db, attempt_id, {JOB_PENDING, JOB_RUNNING}):
        return None
    return enqueue(db, "ai_auto_grade", {"attempt_id": attempt_id})


def recover_missing_ai_auto_grade_jobs(db: Session) -> int:
    """Queue AI grading for already-submitted attempts that are still waiting.

    This covers attempts submitted while AI was disabled, before the worker was
    running, or before this deployment's enqueue hook existed.
    """
    from app.services import ai_evaluation_service

    if not ai_evaluation_service.config_status(db)["configured"]:
        return 0

    attempt_ids = [
        attempt_id
        for (attempt_id,) in (
            db.query(TestAttempt.id)
            .join(AttemptPartGrade, AttemptPartGrade.attempt_id == TestAttempt.id)
            .join(ExamModulePart, ExamModulePart.id == AttemptPartGrade.part_id)
            .filter(
                TestAttempt.status == ATTEMPT_GRADING,
                AttemptPartGrade.status == PART_GRADE_PENDING,
                ExamModulePart.ai_evaluation_enabled.is_(True),
            )
            .distinct()
            .all()
        )
    ]
    queued = 0
    now = datetime.now(timezone.utc)
    # Read the job history once: this runs on every scheduler tick now, and the
    # per-attempt lookup used to re-read the whole table each time round.
    jobs_by_attempt: dict[int, list[Job]] = {}
    for row in db.query(Job).filter(Job.type == "ai_auto_grade").all():
        job_attempt_id = (row.payload or {}).get("attempt_id")
        if job_attempt_id is not None:
            jobs_by_attempt.setdefault(job_attempt_id, []).append(row)

    for attempt_id in attempt_ids:
        previous = jobs_by_attempt.get(attempt_id, [])
        if any(row.status in (JOB_PENDING, JOB_RUNNING) for row in previous):
            continue  # already queued or running

        if previous:
            # A completed run is a verdict: the AI looked at the attempt and
            # what is left belongs to an instructor. Only a *failed* job means
            # the run itself fell over - that is the one worth repeating.
            latest = max(previous, key=lambda row: (row.finished_at or row.created_at))
            if latest.status != JOB_FAILED:
                continue

            attempts_made = db.query(AiEvaluation).filter_by(attempt_id=attempt_id, status="failed").count()
            if attempts_made >= AI_MAX_AUTOMATIC_ATTEMPTS:
                continue  # stop trying; an instructor owns it now
            finished = [row.finished_at for row in previous if row.finished_at]
            if finished:
                last = max(finished)
                if last.tzinfo is None:
                    last = last.replace(tzinfo=timezone.utc)
                if (now - last).total_seconds() < AI_RETRY_AFTER_SECONDS:
                    continue  # too soon - let the provider settle

        if enqueue_ai_auto_grade(db, attempt_id) is not None:
            queued += 1
    return queued


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


def _auto_grade_attempt(db: Session, payload: Optional[dict]) -> str:
    """Runs automatic AI grading for a just-submitted attempt off the request
    thread - a Gemini/custom-provider call can take tens of seconds per part,
    too slow to hold the student's submit request open for."""
    from app.models.attempt import TestAttempt
    from app.services import ai_evaluation_service

    payload = payload or {}
    attempt = db.get(TestAttempt, payload["attempt_id"])
    if attempt is None:
        raise RuntimeError("Attempt no longer exists")
    eligible_part_ids = {
        part.id
        for part in attempt.module.parts
        if not part.auto_marked and part.ai_evaluation_enabled
    }
    failed_before = db.query(AiEvaluation).filter_by(attempt_id=attempt.id, status="failed").count()
    quota_exhausted = ai_evaluation_service.auto_evaluate_submission(db, attempt)
    graded = sum(
        1
        for grade in attempt.part_grades
        if grade.part_id in eligible_part_ids and grade.status == "ai_graded"
    )
    total = len(eligible_part_ids)
    failed_after = db.query(AiEvaluation).filter_by(attempt_id=attempt.id, status="failed").count()
    if total > 0 and graded < total and failed_after > failed_before:
        from app.services import notification_service

        notification_service.notify_ai_evaluation_failed(db, attempt)
    if total > 0 and graded == 0 and failed_after > failed_before:
        raise RuntimeError(f"AI evaluator failed for attempt {attempt.id}; see ai_evaluations for details.")
    suffix = " (quota exhausted for the rest)" if quota_exhausted else ""
    return f"AI-graded {graded}/{total} part(s) for attempt {attempt.id}{suffix}."


def _expire_student_access(db: Session, payload: Optional[dict]) -> str:
    """Lock out students whose access window has closed.

    Runs nightly. It never releases a seat - that stays with the student until
    an admin deliberately frees it - and it never touches anyone with a test in
    progress, because access is re-checked on every request and flipping the
    flag mid-exam would 401 their next autosave and lose the sitting.
    """
    from app.services import access_window_service

    result = access_window_service.expire_due_students(db)
    skipped = result["skipped_in_exam"]
    suffix = f", {skipped} skipped (test in progress)" if skipped else ""
    return f"Expired {result['expired']} student access window(s){suffix}."


HANDLERS: Dict[str, Callable[[Session, Optional[dict]], str]] = {
    "migrate": _run_migrations,
    "backup": _run_backup,
    "purge_logs": _purge_logs,
    "ai_auto_grade": _auto_grade_attempt,
    "expire_student_access": _expire_student_access,
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
    failed_detail = None
    try:
        if handler is None:
            raise RuntimeError(f"No handler registered for job type '{job.type}'")
        result = handler(db, job.payload)
        job.status = JOB_DONE
        job.result = result[:60000]
    except Exception:
        job.status = JOB_FAILED
        failed_detail = traceback.format_exc()[:60000]
        job.result = failed_detail
    job.finished_at = datetime.now(timezone.utc)
    db.commit()
    if failed_detail is not None:
        try:
            from app.services import notification_service

            notification_service.notify_system_job_failed(db, job.type, failed_detail)
        except Exception:
            logger.exception("Failed to send job-failed notification for job %s", job.id)
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
            try:
                from app.services import notification_service

                notification_service.notify_system_job_failed(db, "worker_fatal", detail)
            except Exception:
                logger.exception("Failed to send worker-fatal notification")
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

        # Retry AI marking that stalled on a transient provider failure. This
        # used to run only at startup, so an attempt that tripped stayed
        # stalled until someone restarted the backend.
        recover_missing_ai_auto_grade_jobs(db)

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

        # scheduled announcements
        from app.services import announcement_service
        announcement_service.process_scheduled_announcements(db)

        # institutes whose plan (plus grace) has run out - suspending the
        # institute is what disables every downline account under it
        from app.services import subscription_service
        subscription_service.suspend_expired_institutes(db)

        # students whose own access window has closed. Runs hourly rather than
        # daily so a window ending at 23:59 local is enforced within the hour
        # wherever the institute is, instead of whenever the UTC day happens to
        # roll over. Cheap: an indexed scan of `access_ends_at` that matches
        # nothing on almost every tick.
        last_sweep_raw = get_setting(db, "internal.last_access_sweep")
        last_sweep = datetime.fromisoformat(last_sweep_raw) if last_sweep_raw else None
        if last_sweep is None or now - last_sweep >= timedelta(hours=1):
            from app.services import access_window_service

            access_window_service.expire_due_students(db)
            set_setting(db, "internal.last_access_sweep", now.isoformat())
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
    db = SessionLocal()
    try:
        recover_missing_ai_auto_grade_jobs(db)
    finally:
        db.close()
    _stop_event.clear()
    _worker_thread = threading.Thread(target=_worker_loop, name="job-worker", daemon=True)
    _scheduler_thread = threading.Thread(target=_scheduler_loop, name="job-scheduler", daemon=True)
    _worker_thread.start()
    _scheduler_thread.start()


def stop_background_threads() -> None:
    _stop_event.set()
