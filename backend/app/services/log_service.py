import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.api_log import ApiLog
from app.models.crash_log import CrashLog
from app.models.error_log import ErrorLog
from app.models.request_log import RequestLog
from app.services.settings_service import get_setting

LOG_MODELS = {
    "error": ErrorLog,
    "api": ApiLog,
    "crash": CrashLog,
    "request": RequestLog,
}

SEARCH_COLUMNS = {
    "error": lambda m: [m.message, m.path],
    "api": lambda m: [m.path],
    "crash": lambda m: [m.detail, m.kind],
    "request": lambda m: [m.path, m.user_agent],
}

EXPORT_COLUMNS = {
    "error": ["id", "level", "message", "path", "method", "user_id", "ip_address", "created_at"],
    "api": ["id", "method", "path", "status_code", "latency_ms", "user_id", "ip_address", "created_at"],
    "crash": ["id", "kind", "detail", "detected_at"],
    "request": [
        "id", "method", "path", "status_code", "latency_ms", "user_id",
        "ip_address", "user_agent", "request_bytes", "response_bytes", "created_at",
    ],
}

DEFAULT_RETENTION_DAYS = 30
MAX_PAGE_SIZE = 200


def _timestamp_column(log_type: str, model):
    return model.detected_at if log_type == "crash" else model.created_at


def query_logs(
    db: Session,
    log_type: str,
    page: int = 1,
    page_size: int = 50,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    level: Optional[str] = None,
    search: Optional[str] = None,
) -> Tuple[list, int]:
    model = LOG_MODELS[log_type]
    ts = _timestamp_column(log_type, model)

    query = db.query(model)
    if date_from is not None:
        query = query.filter(ts >= date_from)
    if date_to is not None:
        query = query.filter(ts <= date_to)
    if level and log_type == "error":
        query = query.filter(model.level == level.upper())
    if search:
        columns = SEARCH_COLUMNS[log_type](model)
        pattern = f"%{search}%"
        query = query.filter(or_(*[col.like(pattern) for col in columns]))

    total = query.count()
    page_size = min(max(page_size, 1), MAX_PAGE_SIZE)
    items = (
        query.order_by(ts.desc())
        .offset((max(page, 1) - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def export_csv(db: Session, log_type: str, **filters) -> str:
    items, _ = query_logs(db, log_type, page=1, page_size=MAX_PAGE_SIZE * 50, **filters)
    columns = EXPORT_COLUMNS[log_type]
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(columns)
    for item in items:
        writer.writerow([getattr(item, col, "") for col in columns])
    return buffer.getvalue()


def purge_request_logs(db: Session) -> int:
    retention_raw = get_setting(db, "logs.retention_days")
    try:
        retention_days = int(retention_raw) if retention_raw else DEFAULT_RETENTION_DAYS
    except ValueError:
        retention_days = DEFAULT_RETENTION_DAYS
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    deleted = (
        db.query(RequestLog)
        .filter(RequestLog.created_at < cutoff)
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted


def record_error(
    db: Session,
    message: str,
    stack_trace: Optional[str],
    path: Optional[str],
    method: Optional[str],
    user_id: Optional[int],
    ip_address: Optional[str],
    level: str = "ERROR",
) -> None:
    db.add(
        ErrorLog(
            level=level,
            message=message[:60000],
            stack_trace=stack_trace,
            path=path,
            method=method,
            user_id=user_id,
            ip_address=ip_address,
        )
    )
    db.commit()
