import os
import shutil
import subprocess
import tarfile
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from fastapi import HTTPException, status
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import Session

from app.config import settings
from app.models.backup import Backup
from app.services.settings_service import get_setting

BACKUPS_SUBDIR = "backups"
DUMP_TIMEOUT_SECONDS = 600


def backups_dir() -> Path:
    path = settings.storage_path / BACKUPS_SUBDIR
    path.mkdir(parents=True, exist_ok=True)
    return path


def _db_params() -> dict:
    url = make_url(settings.database_url)
    return {
        "host": url.host or "localhost",
        "port": str(url.port or 3306),
        "user": url.username or "",
        "password": url.password or "",
        "database": url.database or "",
    }


def _mysql_bin(name: str) -> str:
    candidate = Path(settings.mysql_bin_dir) / name
    if candidate.is_file():
        return str(candidate)
    found = shutil.which(name)
    if found:
        return found
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"'{name}' not found - set MYSQL_BIN_DIR in .env to your MySQL bin directory",
    )


def run_backup(db: Session, kind: str = "manual") -> Backup:
    params = _db_params()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"backup_{timestamp}.tar.gz"
    target = backups_dir() / filename

    env = {**os.environ, "MYSQL_PWD": params["password"]}
    with tempfile.TemporaryDirectory() as tmp:
        dump_path = Path(tmp) / "db.sql"
        result = subprocess.run(
            [
                _mysql_bin("mysqldump"),
                "-h", params["host"],
                "-P", params["port"],
                "-u", params["user"],
                "--single-transaction",
                "--no-tablespaces",
                "--set-gtid-purged=OFF",
                "--routines",
                params["database"],
            ],
            stdout=dump_path.open("w"),
            stderr=subprocess.PIPE,
            text=True,
            env=env,
            timeout=DUMP_TIMEOUT_SECONDS,
        )
        if result.returncode != 0:
            db.add(Backup(filename=filename, kind=kind, status="failed"))
            db.commit()
            raise RuntimeError(f"mysqldump failed: {result.stderr[:2000]}")

        with tarfile.open(target, "w:gz") as tar:
            tar.add(dump_path, arcname="db.sql")
            # uploaded files, excluding the backups dir itself
            for entry in sorted(settings.storage_path.iterdir()):
                if entry.name == BACKUPS_SUBDIR:
                    continue
                tar.add(entry, arcname=f"files/{entry.name}")

    backup = Backup(
        filename=filename,
        size_bytes=target.stat().st_size,
        kind=kind,
        status="done",
    )
    db.add(backup)
    db.commit()
    db.refresh(backup)

    _apply_retention(db)
    return backup


def _apply_retention(db: Session) -> None:
    retention_raw = get_setting(db, "backup.retention")
    try:
        retention = int(retention_raw) if retention_raw else 5
    except ValueError:
        retention = 5
    if retention < 1:
        retention = 1

    done = (
        db.query(Backup)
        .filter(Backup.status == "done")
        .order_by(Backup.created_at.desc())
        .all()
    )
    for old in done[retention:]:
        path = backups_dir() / old.filename
        if path.is_file():
            path.unlink()
        db.delete(old)
    db.commit()


def list_backups(db: Session) -> List[Backup]:
    return db.query(Backup).order_by(Backup.created_at.desc()).all()


def get_backup_or_404(db: Session, backup_id: int) -> Backup:
    backup = db.get(Backup, backup_id)
    if backup is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backup not found")
    return backup


def backup_file_path(backup: Backup) -> Path:
    path = backups_dir() / backup.filename
    if not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup file is missing from disk",
        )
    return path


def delete_backup(db: Session, backup_id: int) -> None:
    backup = get_backup_or_404(db, backup_id)
    path = backups_dir() / backup.filename
    if path.is_file():
        path.unlink()
    db.delete(backup)
    db.commit()


def restore_backup(db: Session, backup_id: int) -> str:
    """Applies the SQL dump and restores uploaded files from the archive.
    Destructive - the router requires a typed confirmation before calling this."""
    backup = get_backup_or_404(db, backup_id)
    archive = backup_file_path(backup)
    # capture before the restore: the dump predates this backup's own row, so
    # applying it deletes the row and the ORM instance becomes unusable
    filename = backup.filename
    params = _db_params()
    env = {**os.environ, "MYSQL_PWD": params["password"]}

    # End this session's open transaction before running the restore: the dump's
    # DROP TABLE statements otherwise wait forever on the metadata lock held by
    # our own SELECT above (self-deadlock).
    db.commit()
    db.expunge_all()

    with tempfile.TemporaryDirectory() as tmp:
        with tarfile.open(archive, "r:gz") as tar:
            try:
                tar.extractall(tmp, filter="data")
            except TypeError:
                # Python < 3.9.17 lacks the filter= parameter; these archives
                # are produced locally by run_backup, not untrusted input.
                tar.extractall(tmp)
        dump_path = Path(tmp) / "db.sql"
        if not dump_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Archive does not contain db.sql",
            )

        result = subprocess.run(
            [
                _mysql_bin("mysql"),
                "-h", params["host"],
                "-P", params["port"],
                "-u", params["user"],
                params["database"],
            ],
            stdin=dump_path.open(),
            capture_output=True,
            text=True,
            env=env,
            timeout=DUMP_TIMEOUT_SECONDS,
        )
        if result.returncode != 0:
            raise RuntimeError(f"mysql restore failed: {result.stderr[:2000]}")

        files_root = Path(tmp) / "files"
        restored_files = 0
        if files_root.is_dir():
            for entry in files_root.iterdir():
                dest = settings.storage_path / entry.name
                if entry.is_dir():
                    shutil.copytree(entry, dest, dirs_exist_ok=True)
                else:
                    shutil.copy2(entry, dest)
                restored_files += 1

    _reregister_disk_archives(db)
    return f"Database restored from {filename}; {restored_files} storage entries restored."


def _reregister_disk_archives(db: Session) -> None:
    """The restored database predates newer backups (including the one just
    applied), so their rows are missing while the archives still exist on disk.
    Re-insert rows for any orphaned archive so the list stays truthful."""
    known = {b.filename for b in db.query(Backup).all()}
    for archive in sorted(backups_dir().glob("backup_*.tar.gz")):
        if archive.name not in known:
            db.add(
                Backup(
                    filename=archive.name,
                    size_bytes=archive.stat().st_size,
                    kind="manual",
                    status="done",
                )
            )
    db.commit()
