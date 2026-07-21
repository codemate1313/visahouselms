from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.role import STUDENT, SUPER_ADMIN
from app.models.user import User
from app.schemas.institute import BrandingUpdate, InstituteCreate, InstituteUpdate
from app.schemas.institute_admin import InstituteMemberCreate, InstituteMemberUpdate
from app.services import institute_admin_service, institute_service

router = APIRouter(
    prefix="/super-admin/institutes",
    tags=["institutes"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)

# public router: no auth - a logged-out themed login page needs this in Phase 4/5
public_router = APIRouter(prefix="/institutes", tags=["institutes-public"])
MAX_STUDENT_IMPORT_BYTES = 3 * 1024 * 1024


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.get("")
def list_institutes(db: Session = Depends(get_db)):
    return institute_service.list_institutes(db)


@router.post("", status_code=201)
def create_institute(
    payload: InstituteCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return institute_service.create_institute(
        db,
        actor,
        payload.name,
        payload.contact_email,
        payload.admin_email,
        payload.admin_first_name,
        payload.admin_last_name,
        payload.admin_permissions.model_dump(),
        _client_ip(request),
    )


@router.get("/{institute_id}")
def get_institute(institute_id: int, db: Session = Depends(get_db)):
    return institute_service.get_institute(db, institute_id)


@router.patch("/{institute_id}")
def update_institute(
    institute_id: int,
    payload: InstituteUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return institute_service.update_institute(
        db,
        actor,
        institute_id,
        payload.name,
        payload.contact_email,
        payload.admin_permissions.model_dump() if payload.admin_permissions else None,
        _client_ip(request),
    )


@router.get("/{institute_id}/members")
def list_institute_members(
    institute_id: int,
    role: Optional[str] = None,
    search: Optional[str] = Query(default=None, max_length=200),
    active: Optional[bool] = None,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    institute_service.get_institute_or_404(db, institute_id)
    return institute_admin_service.list_members(
        db, actor, role, search, active, scoped_institute_id=institute_id
    )


@router.post("/{institute_id}/members", status_code=201)
def create_institute_student(
    institute_id: int,
    payload: InstituteMemberCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    if payload.role != STUDENT:
        raise HTTPException(status_code=400, detail="This endpoint provisions student accounts only")
    institute_service.get_institute_or_404(db, institute_id)
    return institute_admin_service.create_member(
        db,
        actor,
        email=str(payload.email),
        first_name=payload.first_name,
        last_name=payload.last_name,
        role_name=STUDENT,
        phone_number=payload.phone_number,
        address=payload.address,
        ip=_client_ip(request),
        scoped_institute_id=institute_id,
    )


@router.post("/{institute_id}/students/import", status_code=201)
async def import_institute_students(
    institute_id: int,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    institute_service.get_institute_or_404(db, institute_id)
    content = await file.read(MAX_STUDENT_IMPORT_BYTES + 1)
    if len(content) > MAX_STUDENT_IMPORT_BYTES:
        raise HTTPException(status_code=413, detail="Student import files cannot exceed 3 MB")
    return institute_admin_service.import_students(
        db,
        actor,
        content=content,
        filename=file.filename or "students.csv",
        ip=_client_ip(request),
        scoped_institute_id=institute_id,
    )


@router.get("/{institute_id}/students/{student_id}/overview")
def super_admin_student_overview(
    institute_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return institute_admin_service.student_overview(
        db, actor, student_id, scoped_institute_id=institute_id
    )


@router.get("/{institute_id}/members/{member_id}")
def get_institute_member(
    institute_id: int,
    member_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return institute_admin_service.serialize_member(
        institute_admin_service.get_member_or_404(
            db, actor, member_id, scoped_institute_id=institute_id
        )
    )


@router.patch("/{institute_id}/members/{member_id}")
def update_institute_member(
    institute_id: int,
    member_id: int,
    payload: InstituteMemberUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return institute_admin_service.update_member(
        db,
        actor,
        member_id,
        payload.model_dump(exclude_unset=True),
        payload.model_fields_set,
        _client_ip(request),
        scoped_institute_id=institute_id,
    )


@router.post("/{institute_id}/members/{member_id}/deactivate")
def deactivate_institute_member(
    institute_id: int,
    member_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return institute_admin_service.set_member_active(
        db, actor, member_id, False, _client_ip(request), scoped_institute_id=institute_id
    )


@router.post("/{institute_id}/members/{member_id}/reactivate")
def reactivate_institute_member(
    institute_id: int,
    member_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return institute_admin_service.set_member_active(
        db, actor, member_id, True, _client_ip(request), scoped_institute_id=institute_id
    )


@router.post("/{institute_id}/members/{member_id}/reset-password")
def reset_institute_member_password(
    institute_id: int,
    member_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return {
        "temporary_password": institute_admin_service.reset_member_password(
            db, actor, member_id, _client_ip(request), scoped_institute_id=institute_id
        )
    }


@router.post("/{institute_id}/students/{student_id}/revoke-sessions")
def revoke_institute_student_sessions(
    institute_id: int,
    student_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return {
        "revoked": institute_admin_service.revoke_member_sessions(
            db, actor, student_id, _client_ip(request), scoped_institute_id=institute_id
        )
    }


@router.delete("/{institute_id}/members/{member_id}", status_code=204)
def delete_institute_member(
    institute_id: int,
    member_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    institute_admin_service.delete_member(
        db, actor, member_id, _client_ip(request), scoped_institute_id=institute_id
    )


@router.post("/{institute_id}/suspend")
def suspend_institute(
    institute_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return institute_service.set_institute_active(db, actor, institute_id, False, _client_ip(request))


@router.post("/{institute_id}/reactivate")
def reactivate_institute(
    institute_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return institute_service.set_institute_active(db, actor, institute_id, True, _client_ip(request))


@router.delete("/{institute_id}", status_code=204)
def delete_institute(
    institute_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    institute_service.delete_institute(db, actor, institute_id, _client_ip(request))


@router.get("/{institute_id}/branding")
def get_branding(institute_id: int, db: Session = Depends(get_db)):
    return institute_service.get_branding(db, institute_id)


@router.put("/{institute_id}/branding")
def update_branding(
    institute_id: int,
    payload: BrandingUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return institute_service.update_branding(
        db, actor, institute_id, payload.primary_color, payload.secondary_color, _client_ip(request)
    )


@router.post("/{institute_id}/branding/logo")
async def upload_logo(
    institute_id: int,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return await institute_service.save_logo(db, actor, institute_id, file, _client_ip(request))


@public_router.get("/{slug}/branding")
def public_branding(slug: str, db: Session = Depends(get_db)):
    return institute_service.get_public_branding(db, slug)
