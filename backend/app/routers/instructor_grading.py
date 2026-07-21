from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_password_change_complete, require_role
from app.models.role import INST_INSTRUCTOR, SA_INSTRUCTOR
from app.models.user import User
from app.schemas.student import PartGradeRequest, ReevaluationResolveRequest
from app.services import ai_evaluation_service, attempt_service, grading_service

router = APIRouter(
    prefix="/instructor/grading",
    tags=["instructor-grading"],
    dependencies=[
        Depends(require_role(SA_INSTRUCTOR, INST_INSTRUCTOR)),
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


@router.post("/{attempt_id}/claim")
def claim_submission(attempt_id: int, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    attempt = attempt_service.get_attempt_for_grading_or_404(db, actor, attempt_id)
    return grading_service.claim(db, actor, attempt)


@router.post("/{attempt_id}/release")
def release_submission(attempt_id: int, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    attempt = attempt_service.get_attempt_for_grading_or_404(db, actor, attempt_id)
    return grading_service.release(db, actor, attempt)


@router.post("/{attempt_id}/parts/{part_id}/ai-suggestion")
def request_ai_suggestion(
    attempt_id: int,
    part_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    attempt = attempt_service.get_attempt_for_grading_or_404(db, actor, attempt_id)
    part = next((item for item in attempt.module.parts if item.id == part_id and not item.auto_marked), None)
    if part is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Human-graded part not found")
    grading_service.require_or_claim(db, actor, attempt)
    return ai_evaluation_service.request_suggestion(db, actor, attempt, part)


@router.post("/{attempt_id}/reevaluation/resolve")
def resolve_reevaluation(
    attempt_id: int,
    payload: ReevaluationResolveRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    attempt = attempt_service.get_attempt_for_grading_or_404(db, actor, attempt_id)
    return grading_service.resolve_reevaluation(db, actor, attempt, payload.resolution, payload.note)


@router.post("/{attempt_id}/parts/{part_id}")
def grade_part(
    attempt_id: int,
    part_id: int,
    payload: PartGradeRequest,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return attempt_service.grade_part(db, actor, attempt_id, part_id, payload.criteria, payload.comment)
