from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_password_change_complete, require_role
from app.models.role import SA_INSTRUCTOR
from app.models.user import User
from app.schemas.student import PartGradeRequest
from app.services import attempt_service

router = APIRouter(
    prefix="/instructor/grading",
    tags=["instructor-grading"],
    dependencies=[
        Depends(require_role(SA_INSTRUCTOR)),
        Depends(require_password_change_complete),
    ],
)


@router.get("")
def list_queue(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return attempt_service.list_grading_queue(db, actor, status_filter)


@router.get("/{attempt_id}")
def get_submission(attempt_id: int, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    return attempt_service.get_grading_detail(db, actor, attempt_id)


@router.post("/{attempt_id}/parts/{part_id}")
def grade_part(
    attempt_id: int,
    part_id: int,
    payload: PartGradeRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return attempt_service.grade_part(db, actor, attempt_id, part_id, payload.criteria, payload.comment)
