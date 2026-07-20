from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_password_change_complete, require_role
from app.models.assessment import ASSESSMENT_STATUSES, IELTS_SECTIONS
from app.models.role import SA_INSTRUCTOR
from app.models.user import User
from app.schemas.assessment import (
    AssessmentCreate,
    AssessmentQuestionsSet,
    AssessmentStatusUpdate,
    AssessmentUpdate,
    QuestionBankCreate,
    QuestionBankUpdate,
    QuestionBatchCreate,
    QuestionCreate,
)
from app.services import assessment_service, question_import_service


router = APIRouter(
    prefix="/instructor/authoring",
    tags=["assessment-authoring"],
    dependencies=[
        Depends(require_role(SA_INSTRUCTOR)),
        Depends(require_password_change_complete),
    ],
)


def _ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.get("/question-banks")
def list_question_banks(
    search: Optional[str] = Query(default=None, max_length=200),
    section: Optional[str] = None,
    course_id: Optional[int] = Query(default=None, gt=0),
    mine: bool = False,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    if section and section not in IELTS_SECTIONS:
        return []
    return assessment_service.list_banks(
        db, search, section, course_id, actor.id if mine else None
    )


@router.post("/question-banks", status_code=201)
def create_question_bank(
    payload: QuestionBankCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return assessment_service.create_bank(db, actor, payload.model_dump(), _ip(request))


@router.get("/question-banks/{bank_id}")
def get_question_bank(bank_id: int, db: Session = Depends(get_db)):
    return assessment_service.serialize_bank(
        assessment_service.get_bank_or_404(db, bank_id), include_questions=True
    )


@router.patch("/question-banks/{bank_id}")
def update_question_bank(
    bank_id: int,
    payload: QuestionBankUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return assessment_service.update_bank(
        db, actor, bank_id, payload.model_dump(), payload.model_fields_set, _ip(request)
    )


@router.delete("/question-banks/{bank_id}", status_code=204)
def delete_question_bank(
    bank_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    assessment_service.delete_bank(db, actor, bank_id, _ip(request))


@router.post("/question-banks/{bank_id}/questions", status_code=201)
def create_question(
    bank_id: int,
    payload: QuestionCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return assessment_service.add_question(db, actor, bank_id, payload.model_dump(), _ip(request))


@router.put("/question-banks/{bank_id}/questions/{question_id}")
def update_question(
    bank_id: int,
    question_id: int,
    payload: QuestionCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return assessment_service.update_question(
        db, actor, bank_id, question_id, payload.model_dump(), _ip(request)
    )


@router.delete("/question-banks/{bank_id}/questions/{question_id}", status_code=204)
def delete_question(
    bank_id: int,
    question_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    assessment_service.delete_question(db, actor, bank_id, question_id, _ip(request))


@router.post("/question-banks/{bank_id}/import-preview")
async def preview_question_import(
    bank_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    bank = assessment_service.get_bank_or_404(db, bank_id)
    if bank.created_by_id != actor.id:
        raise HTTPException(status_code=403, detail="Only the bank owner can import questions")
    return await question_import_service.preview_upload(file)


@router.post("/question-banks/{bank_id}/import", status_code=201)
def commit_question_import(
    bank_id: int,
    payload: QuestionBatchCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return assessment_service.import_questions(
        db,
        actor,
        bank_id,
        [question.model_dump() for question in payload.questions],
        payload.source_type,
        payload.source_filename,
        _ip(request),
    )


@router.get("/questions")
def list_available_questions(
    course_id: int = Query(gt=0), db: Session = Depends(get_db)
):
    return assessment_service.list_course_questions(db, course_id)


@router.get("/tests")
def list_tests(
    search: Optional[str] = Query(default=None, max_length=200),
    course_id: Optional[int] = Query(default=None, gt=0),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    mine: bool = False,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    if status_filter and status_filter not in ASSESSMENT_STATUSES:
        return []
    return assessment_service.list_assessments(
        db, search, course_id, status_filter, actor.id if mine else None
    )


@router.post("/tests", status_code=201)
def create_test(
    payload: AssessmentCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return assessment_service.create_assessment(db, actor, payload.model_dump(), _ip(request))


@router.get("/tests/{assessment_id}")
def get_test(assessment_id: int, db: Session = Depends(get_db)):
    return assessment_service.serialize_assessment(
        assessment_service.get_assessment_or_404(db, assessment_id), include_questions=True
    )


@router.put("/tests/{assessment_id}")
def update_test(
    assessment_id: int,
    payload: AssessmentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return assessment_service.update_assessment(
        db, actor, assessment_id, payload.model_dump(), _ip(request)
    )


@router.put("/tests/{assessment_id}/questions")
def set_test_questions(
    assessment_id: int,
    payload: AssessmentQuestionsSet,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return assessment_service.set_assessment_questions(
        db, actor, assessment_id, payload.question_ids, _ip(request)
    )


@router.post("/tests/{assessment_id}/status")
def set_test_status(
    assessment_id: int,
    payload: AssessmentStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return assessment_service.set_assessment_status(
        db, actor, assessment_id, payload.status, _ip(request)
    )


@router.delete("/tests/{assessment_id}", status_code=204)
def delete_test(
    assessment_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    assessment_service.delete_assessment(db, actor, assessment_id, _ip(request))
