"""Preset-only web terminal (roadmap 1.4). No free-form shell: each preset is a
fixed argv list (no shell interpolation) or an internal function, executed with
a timeout and streamed line-by-line. This eliminates the injection surface the
roadmap warns about while covering its listed use cases."""

import asyncio
import os
import shutil
import sys
from pathlib import Path
from typing import AsyncIterator, Dict, List, Optional

from sqlalchemy.engine.url import make_url

from app.config import BACKEND_DIR, settings
from app.database import SessionLocal

COMMAND_TIMEOUT_SECONDS = 300


def _mysql_bin(name: str) -> Optional[str]:
    candidate = Path(settings.mysql_bin_dir) / name
    if candidate.is_file():
        return str(candidate)
    return shutil.which(name)


def _db_env() -> Dict[str, str]:
    url = make_url(settings.database_url)
    return {**os.environ, "MYSQL_PWD": url.password or ""}


def _db_args() -> List[str]:
    url = make_url(settings.database_url)
    return ["-h", url.host or "localhost", "-P", str(url.port or 3306), "-u", url.username or ""]


class Preset:
    def __init__(self, name: str, label: str, description: str):
        self.name = name
        self.label = label
        self.description = description

    async def run(self) -> AsyncIterator[str]:
        raise NotImplementedError
        yield  # pragma: no cover


class ArgvPreset(Preset):
    def __init__(self, name: str, label: str, description: str, commands, cwd=None, env=None):
        super().__init__(name, label, description)
        self.commands = commands  # list of argv lists
        self.cwd = cwd
        self.env = env

    async def run(self) -> AsyncIterator[str]:
        for argv in self.commands:
            yield f"$ {' '.join(argv)}"
            try:
                process = await asyncio.create_subprocess_exec(
                    *argv,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.STDOUT,
                    cwd=str(self.cwd) if self.cwd else None,
                    env=self.env,
                )
            except FileNotFoundError:
                yield f"[error] command not found: {argv[0]}"
                continue

            assert process.stdout is not None
            deadline = asyncio.get_event_loop().time() + COMMAND_TIMEOUT_SECONDS
            timed_out = False
            while True:
                remaining = deadline - asyncio.get_event_loop().time()
                if remaining <= 0:
                    timed_out = True
                    break
                try:
                    raw = await asyncio.wait_for(process.stdout.readline(), timeout=remaining)
                except asyncio.TimeoutError:
                    timed_out = True
                    break
                if not raw:
                    break
                yield raw.decode("utf-8", errors="replace").rstrip("\n")

            if timed_out:
                process.kill()
                yield f"[error] command timed out after {COMMAND_TIMEOUT_SECONDS}s"
                continue
            await process.wait()
            yield f"[exit {process.returncode}]"


class RecentErrorsPreset(Preset):
    async def run(self) -> AsyncIterator[str]:
        from app.models.error_log import ErrorLog

        db = SessionLocal()
        try:
            rows = db.query(ErrorLog).order_by(ErrorLog.created_at.desc()).limit(20).all()
        finally:
            db.close()
        if not rows:
            yield "No error logs recorded."
            return
        for row in rows:
            first_line = row.message.splitlines()[0] if row.message else ""
            yield f"[{row.created_at}] {row.level} {row.method or ''} {row.path or ''} - {first_line}"


class BackupNowPreset(Preset):
    async def run(self) -> AsyncIterator[str]:
        from app.services import job_service

        db = SessionLocal()
        try:
            job = job_service.enqueue(db, "backup", {"kind": "manual"})
        finally:
            db.close()
        yield f"Backup job #{job.id} enqueued. Track it in Developer Settings > Backups."


def build_presets() -> Dict[str, Preset]:
    presets: Dict[str, Preset] = {}

    presets["migrate"] = ArgvPreset(
        "migrate", "Run migrations", "alembic upgrade head",
        [[sys.executable, "-m", "alembic", "upgrade", "head"]], cwd=BACKEND_DIR,
    )
    presets["migration-status"] = ArgvPreset(
        "migration-status", "Migration status", "alembic current",
        [[sys.executable, "-m", "alembic", "current", "-v"]], cwd=BACKEND_DIR,
    )
    presets["disk-usage"] = ArgvPreset(
        "disk-usage", "Disk usage", "Storage folder size + free disk space",
        [["du", "-sh", str(settings.storage_path)], ["df", "-h", str(settings.storage_path)]],
    )
    presets["uptime"] = ArgvPreset(
        "uptime", "Server uptime", "System uptime and load", [["uptime"]],
    )
    presets["python-version"] = ArgvPreset(
        "python-version", "Python version", "Interpreter running the backend",
        [[sys.executable, "--version"]],
    )

    mysqladmin = _mysql_bin("mysqladmin")
    if mysqladmin:
        presets["db-ping"] = ArgvPreset(
            "db-ping", "Database ping", "mysqladmin ping against the configured DB",
            [[mysqladmin, *_db_args(), "ping"]], env=_db_env(),
        )

    presets["recent-errors"] = RecentErrorsPreset(
        "recent-errors", "Recent errors", "Last 20 rows from error logs",
    )
    presets["backup-now"] = BackupNowPreset(
        "backup-now", "Backup now", "Enqueue a manual backup job",
    )
    return presets


PRESETS = build_presets()


def preset_list() -> List[dict]:
    return [
        {"name": p.name, "label": p.label, "description": p.description}
        for p in PRESETS.values()
    ]
