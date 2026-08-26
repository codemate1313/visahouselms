from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_role
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.services import ai_log_service, log_service

router = APIRouter(
    prefix="/super-admin/logs",
    tags=["logs"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)

ROW_SERIALIZERS = {
    "error": lambda r, users_map: {
        "id": r.id, "level": r.level, "message": r.message, "stack_trace": r.stack_trace,
        "path": r.path, "method": r.method, "user_id": r.user_id,
        "user_name": users_map.get(r.user_id, {}).get("name") if r.user_id else None,
        "user_email": users_map.get(r.user_id, {}).get("email") if r.user_id else None,
        "ip_address": r.ip_address, "created_at": r.created_at,
    },
    "api": lambda r, users_map: {
        "id": r.id, "method": r.method, "path": r.path, "status_code": r.status_code,
        "latency_ms": r.latency_ms, "user_id": r.user_id,
        "user_name": users_map.get(r.user_id, {}).get("name") if r.user_id else None,
        "user_email": users_map.get(r.user_id, {}).get("email") if r.user_id else None,
        "ip_address": r.ip_address, "created_at": r.created_at,
    },
    "crash": lambda r, _users_map: {
        "id": r.id, "kind": r.kind, "detail": r.detail, "detected_at": r.detected_at,
    },
    "request": lambda r, users_map: {
        "id": r.id, "method": r.method, "path": r.path, "status_code": r.status_code,
        "latency_ms": r.latency_ms, "user_id": r.user_id,
        "user_name": users_map.get(r.user_id, {}).get("name") if r.user_id else None,
        "user_email": users_map.get(r.user_id, {}).get("email") if r.user_id else None,
        "ip_address": r.ip_address,
        "user_agent": r.user_agent, "request_bytes": r.request_bytes,
        "response_bytes": r.response_bytes, "headers": r.headers, "created_at": r.created_at,
    },
}


def _validate_type(log_type: str) -> None:
    if log_type not in log_service.LOG_MODELS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown log type '{log_type}'",
        )


# Registered before the catch-all `/{log_type}` routes below, which would
# otherwise swallow "ai-evaluations" as an unknown log type.
@router.get("/ai-evaluations")
def list_ai_evaluations(
    page: int = 1,
    page_size: int = 50,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    items, total = ai_log_service.query_evaluations(
        db, page=page, page_size=page_size, status=status_filter, search=search
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/ai-evaluations/{evaluation_id}")
def get_ai_evaluation(evaluation_id: int, db: Session = Depends(get_db)):
    detail = ai_log_service.evaluation_detail(db, evaluation_id)
    if detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No AI evaluation with id {evaluation_id}",
        )
    return detail


@router.get("/{log_type}/export.csv")
def export_logs(
    log_type: str,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    level: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    _validate_type(log_type)
    csv_text = log_service.export_csv(
        db, log_type, date_from=date_from, date_to=date_to, level=level, search=search
    )
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{log_type}_logs.csv"'},
    )


@router.get("/{log_type}")
def list_logs(
    log_type: str,
    page: int = 1,
    page_size: int = 50,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    level: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    _validate_type(log_type)
    items, total = log_service.query_logs(
        db, log_type,
        page=page, page_size=page_size,
        date_from=date_from, date_to=date_to,
        level=level, search=search,
    )

    user_ids = {getattr(item, "user_id", None) for item in items if getattr(item, "user_id", None) is not None}
    users_map = {}
    if user_ids:
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        for u in users:
            name = f"{u.first_name} {u.last_name}".strip()
            users_map[u.id] = {
                "name": name if name else u.email,
                "email": u.email,
            }

    serialize = ROW_SERIALIZERS[log_type]
    return {
        "items": [serialize(item, users_map) for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
