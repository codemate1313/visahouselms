from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.role import SA_INSTRUCTOR, SUPER_ADMIN, STUDENT
from app.models.user import User
from app.schemas.grammar_content import GrammarContentListResponse, GrammarContentResponse
from app.services import grammar_content_service

router = APIRouter(prefix="/grammar-content", tags=["grammar-content"])


# --- SA Instructor Endpoints ---

@router.get(
    "/instructor/contents",
    response_model=GrammarContentListResponse,
    dependencies=[Depends(require_role(SA_INSTRUCTOR, SUPER_ADMIN))],
)
def get_instructor_grammar_contents(db: Session = Depends(get_db)):
    items = grammar_content_service.list_grammar_contents(db, student_only=False)
    return GrammarContentListResponse(items=items, total=len(items))


@router.post(
    "/instructor/contents",
    response_model=GrammarContentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(SA_INSTRUCTOR, SUPER_ADMIN))],
)
async def create_grammar_content(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    is_active: bool = Form(True),
    pdf_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await grammar_content_service.create_grammar_content(
        db=db,
        title=title,
        description=description,
        is_active=is_active,
        pdf_file=pdf_file,
        created_by_id=current_user.id if current_user else None,
    )


@router.put(
    "/instructor/contents/{content_id}",
    response_model=GrammarContentResponse,
    dependencies=[Depends(require_role(SA_INSTRUCTOR, SUPER_ADMIN))],
)
async def update_grammar_content(
    content_id: int,
    title: str = Form(...),
    description: Optional[str] = Form(None),
    is_active: bool = Form(True),
    pdf_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    return await grammar_content_service.update_grammar_content(
        db=db,
        content_id=content_id,
        title=title,
        description=description,
        is_active=is_active,
        pdf_file=pdf_file,
    )


@router.patch(
    "/instructor/contents/{content_id}/toggle",
    response_model=GrammarContentResponse,
    dependencies=[Depends(require_role(SA_INSTRUCTOR, SUPER_ADMIN))],
)
def toggle_grammar_content_status(
    content_id: int,
    db: Session = Depends(get_db),
):
    return grammar_content_service.toggle_grammar_content_status(db=db, content_id=content_id)


@router.delete(
    "/instructor/contents/{content_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role(SA_INSTRUCTOR, SUPER_ADMIN))],
)
def delete_grammar_content(
    content_id: int,
    db: Session = Depends(get_db),
):
    grammar_content_service.delete_grammar_content(db=db, content_id=content_id)
    return None


# --- Student Study Material Endpoints ---

@router.get(
    "/student/study-materials",
    response_model=GrammarContentListResponse,
    dependencies=[Depends(require_role(STUDENT, SA_INSTRUCTOR, SUPER_ADMIN))],
)
def get_student_study_materials(db: Session = Depends(get_db)):
    items = grammar_content_service.list_grammar_contents(db, student_only=True)
    return GrammarContentListResponse(items=items, total=len(items))
