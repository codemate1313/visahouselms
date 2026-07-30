from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
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
def list_institutes(status: Optional[str] = None, db: Session = Depends(get_db)):
    return institute_service.list_institutes(db, status=status)


@router.post("", status_code=201)
def create_institute(
    payload: InstituteCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    res = institute_service.create_institute(
        db,
        actor,
        payload.name,
        payload.contact_email,
        payload.admin_email,
        payload.admin_first_name,
        payload.admin_last_name,
        payload.session_duration_hours,
        _client_ip(request),
        ai_student_monthly_limit=payload.ai_student_monthly_limit,
    )
    # The agreement, its provisions and branding always come with the payload -
    # create_institute() only writes the institute and its admin account.
    temp_pwd = res.get("admin_temp_password")
    institute_service.update_institute(db, actor, res["id"], payload.model_dump(exclude_unset=True), _client_ip(request))
    res = institute_service.get_institute(db, res["id"])
    if temp_pwd:
        res["admin_temp_password"] = temp_pwd
    return res


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
    data = payload.model_dump(exclude_unset=True)
    return institute_service.update_institute(
        db,
        actor,
        institute_id,
        data,
        _client_ip(request),
    )


@router.get("/{institute_id}/members")
def list_institute_members(
    institute_id: int,
    role: Optional[str] = None,
    search: Optional[str] = Query(default=None, max_length=200),
    active: Optional[bool] = None,
    status: Optional[str] = Query(default=None, pattern="^(active|inactive|deleted|password_reset)$"),
    has_attempts: Optional[bool] = None,
    has_devices: Optional[bool] = None,
    has_active_sessions: Optional[bool] = None,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    institute_service.get_institute_or_404(db, institute_id)
    return institute_admin_service.list_members(
        db,
        actor,
        role,
        search,
        active,
        status,
        has_attempts,
        has_devices,
        has_active_sessions,
        scoped_institute_id=institute_id,
    )


@router.get("/{institute_id}/member-capacity")
def institute_member_capacity(
    institute_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    institute_service.get_institute_or_404(db, institute_id)
    return institute_admin_service.member_capacity(db, actor, scoped_institute_id=institute_id)


@router.post("/{institute_id}/members", status_code=201)
def create_institute_student(
    institute_id: int,
    payload: InstituteMemberCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    if payload.role not in (STUDENT, "INST_INSTRUCTOR"):
        raise HTTPException(status_code=400, detail="Role must be STUDENT or INST_INSTRUCTOR")
    institute_service.get_institute_or_404(db, institute_id)
    return institute_admin_service.create_member(
        db,
        actor,
        email=str(payload.email),
        first_name=payload.first_name,
        last_name=payload.last_name,
        role_name=payload.role,
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


@router.post("/{institute_id}/admins/{admin_id}/reset-password")
def reset_institute_admin_password(
    institute_id: int,
    admin_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    """Institute admins are not 'members' (that endpoint covers instructors and
    students only), so their reset lives here."""
    return institute_service.reset_admin_password(
        db, actor, institute_id, admin_id, _client_ip(request)
    )


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
        db,
        actor,
        institute_id,
        payload.primary_color,
        payload.secondary_color,
        _client_ip(request),
        payload.font_family,
        payload.heading_font_weight,
        payload.body_font_weight,
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


@router.post("/{institute_id}/documents/{kind}")
async def upload_agreement_attachment(
    institute_id: int,
    kind: str,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return await institute_service.save_agreement_attachment(
        db, actor, institute_id, kind, file, _client_ip(request)
    )


@router.get("/{institute_id}/documents/{kind}")
def download_agreement_attachment(
    institute_id: int,
    kind: str,
    db: Session = Depends(get_db),
):
    file_path, original_name = institute_service.agreement_attachment_download(
        db, institute_id, kind
    )
    return FileResponse(
        path=file_path,
        media_type="application/octet-stream",
        filename=original_name,
        content_disposition_type="attachment",
    )


@router.delete("/{institute_id}/documents/{kind}", status_code=204)
def remove_agreement_attachment(
    institute_id: int,
    kind: str,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    institute_service.delete_agreement_attachment(
        db, actor, institute_id, kind, _client_ip(request)
    )


@public_router.get("/{slug}/branding")
def public_branding(slug: str, db: Session = Depends(get_db)):
    return institute_service.get_public_branding(db, slug)
