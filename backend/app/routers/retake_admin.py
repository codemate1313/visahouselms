from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.schemas.student import RetakeResolveRequest
from app.services import retake_service

router = APIRouter(
    prefix="/super-admin/retake-requests",
    tags=["retake-requests"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


@router.get("")
def list_retake_requests(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
):
    return retake_service.list_retake_requests(db, status_filter)


@router.post("/{request_id}/resolve")
def resolve_retake_request(
    request_id: int,
    payload: RetakeResolveRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return retake_service.resolve_retake(db, actor, request_id, payload.resolution, payload.note)
