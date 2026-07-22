from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_password_change_complete, require_role
from app.dependencies.student_access import require_student
from app.models.role import INSTITUTE_ADMIN, SUPER_ADMIN
from app.models.user import User
from app.schemas.announcement import AnnouncementCreate
from app.services import announcement_service, institute_admin_service


institute_router = APIRouter(
    prefix="/institute/announcements",
    tags=["announcements"],
    dependencies=[Depends(require_role(INSTITUTE_ADMIN)), Depends(require_password_change_complete)],
)

platform_router = APIRouter(
    prefix="/super-admin/announcements",
    tags=["announcements"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)

student_router = APIRouter(
    prefix="/student/announcements",
    tags=["announcements"],
    dependencies=[Depends(require_student)],
)


@institute_router.get("")
def institute_announcements(db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    institute_admin_service.require_admin_permission(actor, "manage_students", "view_students")
    return announcement_service.list_admin_announcements(db, actor.institute_id)


@institute_router.get("/target-options")
def institute_target_options(db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    institute_admin_service.require_admin_permission(actor, "manage_students", "view_students")
    return announcement_service.get_institute_target_options(db, actor.institute_id or 0)


@institute_router.post("", status_code=201)
def create_institute_announcement(
    payload: AnnouncementCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    institute_admin_service.require_admin_permission(actor, "manage_students")
    return announcement_service.create_announcement(db, actor, payload, institute_id=actor.institute_id)


@platform_router.get("")
def platform_announcements(db: Session = Depends(get_db)):
    return announcement_service.list_admin_announcements(db, None)


@platform_router.get("/target-options")
def platform_target_options(db: Session = Depends(get_db)):
    return announcement_service.get_super_admin_target_options(db)


@platform_router.post("", status_code=201)
def create_platform_announcement(
    payload: AnnouncementCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return announcement_service.create_announcement(db, actor, payload, institute_id=None)


@student_router.get("")
def student_announcements(db: Session = Depends(get_db), user: User = Depends(require_student)):
    return announcement_service.list_student_announcements(db, user)
