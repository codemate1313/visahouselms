from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_password_change_complete, require_role
from app.models.course import COURSE_STATUSES
from app.models.role import SA_INSTRUCTOR
from app.models.user import User
from app.schemas.course import AssetReorder, AssetUpdate, CourseCreate, CourseStatusUpdate, CourseUpdate
from app.services import course_service

router = APIRouter(
    prefix="/instructor/courses",
    tags=["course-authoring"],
    dependencies=[
        Depends(require_role(SA_INSTRUCTOR)),
        Depends(require_password_change_complete),
    ],
)


def _ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.get("")
def list_courses(
    search: Optional[str] = Query(default=None, max_length=200),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    mine: bool = False,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    if status_filter and status_filter not in COURSE_STATUSES:
        return []
    return course_service.list_courses(
        db, search, status_filter, actor.id if mine else None
    )


@router.post("", status_code=201)
def create_course(
    payload: CourseCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return course_service.create_course(db, actor, payload.model_dump(), _ip(request))


@router.get("/{course_id}")
def get_course(course_id: int, db: Session = Depends(get_db)):
    return course_service.serialize(
        course_service.get_course_or_404(db, course_id), include_assignments=True
    )


@router.patch("/{course_id}")
def update_course(
    course_id: int,
    payload: CourseUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return course_service.update_course(
        db,
        actor,
        course_id,
        payload.model_dump(),
        payload.model_fields_set,
        _ip(request),
    )


@router.post("/{course_id}/status")
def update_status(
    course_id: int,
    payload: CourseStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return course_service.set_status(db, actor, course_id, payload.status, _ip(request))


@router.delete("/{course_id}", status_code=204)
def delete_course(
    course_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    course_service.delete_course(db, actor, course_id, _ip(request))


@router.post("/{course_id}/assets", status_code=201)
async def upload_asset(
    course_id: int,
    request: Request,
    title: Optional[str] = Form(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return await course_service.add_asset(
        db, actor, course_id, title, file, _ip(request)
    )


@router.put("/{course_id}/assets/reorder")
def reorder_assets(
    course_id: int,
    payload: AssetReorder,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return course_service.reorder_assets(
        db, actor, course_id, payload.asset_ids, _ip(request)
    )


@router.patch("/{course_id}/assets/{asset_id}")
def update_asset(
    course_id: int,
    asset_id: int,
    payload: AssetUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return course_service.update_asset(
        db, actor, course_id, asset_id, payload.title, _ip(request)
    )


@router.delete("/{course_id}/assets/{asset_id}", status_code=204)
def delete_asset(
    course_id: int,
    asset_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    course_service.delete_asset(db, actor, course_id, asset_id, _ip(request))
