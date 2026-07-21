from typing import Optional

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, Request, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_password_change_complete, require_role
from app.models.role import INSTITUTE_ADMIN
from app.models.user import User
from app.schemas.auth import CurrentUser
from app.schemas.institute_admin import InstituteMemberCreate, InstituteMemberUpdate
from app.schemas.user import ChangePasswordRequest, ProfileUpdateRequest, RevokeOthersRequest, SessionOut
from app.services import (
    account_service,
    institute_admin_service,
    payment_service,
    subscription_service,
)

router = APIRouter(
    prefix="/institute",
    tags=["institute-portal"],
    dependencies=[Depends(require_role(INSTITUTE_ADMIN))],
)
MAX_STUDENT_IMPORT_BYTES = 3 * 1024 * 1024


def _ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


def _current_user_out(user: User) -> CurrentUser:
    return CurrentUser(
        id=user.id,
        email=user.email,
        role=user.role.name,
        institute_id=user.institute_id,
        institute_slug=user.institute.slug if user.institute else None,
        first_name=user.first_name,
        last_name=user.last_name,
        force_password_reset=user.force_password_reset,
        avatar_url=account_service.avatar_url_for(user),
        institute_permissions=institute_admin_service.admin_permissions(user),
    )


@router.post("/me/change-password", status_code=204)
def change_my_password(
    payload: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    account_service.change_password(db, actor, payload.current_password, payload.new_password, _ip(request))


@router.get("/me/profile", response_model=CurrentUser, dependencies=[Depends(require_password_change_complete)])
def get_my_profile(actor: User = Depends(get_current_user)):
    return _current_user_out(actor)


@router.patch("/me/profile", response_model=CurrentUser, dependencies=[Depends(require_password_change_complete)])
def update_my_profile(
    payload: ProfileUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return _current_user_out(
        account_service.update_profile(
            db, actor, payload.email, payload.first_name, payload.last_name, _ip(request)
        )
    )


@router.post("/me/avatar", response_model=CurrentUser, dependencies=[Depends(require_password_change_complete)])
async def upload_my_avatar(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return _current_user_out(await account_service.save_avatar(db, actor, file, _ip(request)))


@router.get("/me/sessions", response_model=list[SessionOut], dependencies=[Depends(require_password_change_complete)])
def list_my_sessions(
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
    x_refresh_token: Optional[str] = Header(default=None),
):
    return account_service.list_sessions(db, actor, x_refresh_token)


@router.delete("/me/sessions/{session_id}", status_code=204, dependencies=[Depends(require_password_change_complete)])
def revoke_my_session(
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    account_service.revoke_session(db, actor, session_id, _ip(request))


@router.post("/me/sessions/revoke-others", dependencies=[Depends(require_password_change_complete)])
def revoke_my_other_sessions(
    payload: RevokeOthersRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return {"revoked": account_service.revoke_other_sessions(db, actor, payload.refresh_token, _ip(request))}


@router.get("/dashboard", dependencies=[Depends(require_password_change_complete)])
def dashboard(db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    return institute_admin_service.dashboard_summary(db, actor)


@router.get("/members", dependencies=[Depends(require_password_change_complete)])
def list_members(
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
    if role == "STUDENT":
        institute_admin_service.require_admin_permission(
            actor,
            "view_students",
            "manage_students",
            "view_student_activity",
            "manage_student_sessions",
        )
    else:
        institute_admin_service.require_admin_permission(actor, "manage_staff")
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
    )


@router.post("/members", status_code=201, dependencies=[Depends(require_password_change_complete)])
def create_member(
    payload: InstituteMemberCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    institute_admin_service.require_admin_permission(
        actor, "manage_students" if payload.role == "STUDENT" else "manage_staff"
    )
    return institute_admin_service.create_member(
        db,
        actor,
        email=str(payload.email),
        first_name=payload.first_name,
        last_name=payload.last_name,
        role_name=payload.role,
        phone_number=payload.phone_number,
        address=payload.address,
        ip=_ip(request),
    )


@router.post("/students/import", status_code=201, dependencies=[Depends(require_password_change_complete)])
async def import_students(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    institute_admin_service.require_admin_permission(actor, "manage_students")
    content = await file.read(MAX_STUDENT_IMPORT_BYTES + 1)
    if len(content) > MAX_STUDENT_IMPORT_BYTES:
        raise HTTPException(status_code=413, detail="Student import files cannot exceed 3 MB")
    return institute_admin_service.import_students(
        db,
        actor,
        content=content,
        filename=file.filename or "students.csv",
        ip=_ip(request),
    )


@router.get("/students/{student_id}/overview", dependencies=[Depends(require_password_change_complete)])
def student_overview(
    student_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    institute_admin_service.require_admin_permission(actor, "view_student_activity")
    return institute_admin_service.student_overview(db, actor, student_id)


@router.post("/students/{student_id}/revoke-sessions", dependencies=[Depends(require_password_change_complete)])
def revoke_student_sessions(
    student_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    institute_admin_service.require_admin_permission(actor, "manage_student_sessions")
    return {
        "revoked": institute_admin_service.revoke_member_sessions(
            db, actor, student_id, _ip(request)
        )
    }


@router.get("/members/{member_id}", dependencies=[Depends(require_password_change_complete)])
def get_member(
    member_id: int, db: Session = Depends(get_db), actor: User = Depends(get_current_user)
):
    member = institute_admin_service.get_member_or_404(db, actor, member_id)
    institute_admin_service.require_admin_permission(
        actor,
        *(
            (
                "view_students",
                "manage_students",
                "view_student_activity",
                "manage_student_sessions",
            )
            if member.role.name == "STUDENT"
            else ("manage_staff",)
        ),
    )
    return institute_admin_service.serialize_member(member)


@router.patch("/members/{member_id}", dependencies=[Depends(require_password_change_complete)])
def update_member(
    member_id: int,
    payload: InstituteMemberUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    member = institute_admin_service.get_member_or_404(db, actor, member_id)
    institute_admin_service.require_admin_permission(
        actor, "manage_students" if member.role.name == "STUDENT" else "manage_staff"
    )
    return institute_admin_service.update_member(
        db,
        actor,
        member_id,
        payload.model_dump(exclude_unset=True),
        payload.model_fields_set,
        _ip(request),
    )


@router.post("/members/{member_id}/deactivate", dependencies=[Depends(require_password_change_complete)])
def deactivate_member(
    member_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    member = institute_admin_service.get_member_or_404(db, actor, member_id)
    institute_admin_service.require_admin_permission(
        actor, "manage_students" if member.role.name == "STUDENT" else "manage_staff"
    )
    return institute_admin_service.set_member_active(db, actor, member_id, False, _ip(request))


@router.post("/members/{member_id}/reactivate", dependencies=[Depends(require_password_change_complete)])
def reactivate_member(
    member_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    member = institute_admin_service.get_member_or_404(db, actor, member_id)
    institute_admin_service.require_admin_permission(
        actor, "manage_students" if member.role.name == "STUDENT" else "manage_staff"
    )
    return institute_admin_service.set_member_active(db, actor, member_id, True, _ip(request))


@router.post("/members/{member_id}/reset-password", dependencies=[Depends(require_password_change_complete)])
def reset_member_password(
    member_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    member = institute_admin_service.get_member_or_404(db, actor, member_id)
    institute_admin_service.require_admin_permission(
        actor, "manage_students" if member.role.name == "STUDENT" else "manage_staff"
    )
    return {
        "temporary_password": institute_admin_service.reset_member_password(
            db, actor, member_id, _ip(request)
        )
    }


@router.delete("/members/{member_id}", status_code=204, dependencies=[Depends(require_password_change_complete)])
def delete_member(
    member_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    member = institute_admin_service.get_member_or_404(db, actor, member_id)
    institute_admin_service.require_admin_permission(
        actor, "manage_students" if member.role.name == "STUDENT" else "manage_staff"
    )
    institute_admin_service.delete_member(db, actor, member_id, _ip(request))


@router.get("/subscription", dependencies=[Depends(require_password_change_complete)])
def subscription_status(db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    institute_admin_service.require_admin_permission(actor, "view_billing")
    return subscription_service.subscription_status(db, actor.institute_id)


@router.get("/payments", dependencies=[Depends(require_password_change_complete)])
def list_payments(db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    institute_admin_service.require_admin_permission(actor, "view_billing")
    return payment_service.list_payments(db, institute_id=actor.institute_id)
