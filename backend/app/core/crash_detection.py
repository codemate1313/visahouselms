"""Unclean-shutdown detection: a marker file is written on startup and removed
on clean shutdown. A marker already present at boot means the previous process
died without shutting down (kill -9, OOM, power loss) - recorded to crash_logs.
True supervisor-level capture is a Phase 7 / production deployment concern."""

import os
from datetime import datetime, timezone

from app.config import settings
from app.database import SessionLocal
from app.models.crash_log import CrashLog

MARKER_NAME = ".heartbeat"


def _marker_path():
    return settings.storage_path / MARKER_NAME


def check_and_mark_startup() -> None:
    marker = _marker_path()
    if marker.is_file():
        previous = marker.read_text(errors="replace").strip()
        db = SessionLocal()
        try:
            db.add(
                CrashLog(
                    kind="unclean_shutdown",
                    detail=(
                        "Previous backend process did not shut down cleanly "
                        f"(last heartbeat: {previous})."
                    ),
                )
            )
            db.commit()
        finally:
            db.close()

    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.write_text(f"pid={os.getpid()} started={datetime.now(timezone.utc).isoformat()}")


def mark_clean_shutdown() -> None:
    marker = _marker_path()
    if marker.is_file():
        marker.unlink()
