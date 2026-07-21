from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.course import COURSE_STATUSES
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.schemas.course import CourseAssignmentRequest, CourseStatusUpdate, CourseVisibilityUpdate
from app.services import course_service

router = APIRouter(
    prefix="/super-admin/courses",
    tags=["course-catalog"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


def _ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.get("")
def list_courses(
    search: Optional[str] = Query(default=None, max_length=200),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
):
    if status_filter and status_filter not in COURSE_STATUSES:
        return []
    return course_service.list_courses(db, search, status_filter)


@router.get("/{course_id}")
def get_course(course_id: int, db: Session = Depends(get_db)):
    return course_service.serialize(
        course_service.get_course_or_404(db, course_id), include_assignments=True
    )


@router.post("/{course_id}/status")
def set_course_status(course_id: int, payload: CourseStatusUpdate, request: Request, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    return course_service.set_status(db, actor, course_id, payload.status, _ip(request))


@router.patch("/{course_id}/visibility")
def set_course_visibility(course_id: int, payload: CourseVisibilityUpdate, request: Request, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    return course_service.set_visibility(db, actor, course_id, payload.is_visible, _ip(request))


@router.delete("/{course_id}", status_code=204)
def remove_course(course_id: int, request: Request, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    course_service.remove_course_by_super_admin(db, actor, course_id, _ip(request))


@router.get("/{course_id}/assignments")
def list_assignments(course_id: int, db: Session = Depends(get_db)):
    return course_service.list_assignments(db, course_id)


@router.post("/{course_id}/assignments", status_code=201)
def assign_course(
    course_id: int,
    payload: CourseAssignmentRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return course_service.assign_to_institute(
        db, actor, course_id, payload.institute_id, _ip(request)
    )


@router.delete("/{course_id}/assignments/{institute_id}", status_code=204)
def unassign_course(
    course_id: int,
    institute_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    course_service.unassign_from_institute(
        db, actor, course_id, institute_id, _ip(request)
    )
