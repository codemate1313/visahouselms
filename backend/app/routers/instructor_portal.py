from typing import Optional

from fastapi import APIRouter, Depends, File, Header, Request, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import (
    get_current_user,
    require_password_change_complete,
    require_role,
)
from app.models.role import SA_INSTRUCTOR
from app.models.user import User
from app.schemas.auth import CurrentUser
from app.schemas.instructor import (
    InstructorAccountOut,
    InstructorAccountUpdate,
    InstructorDashboardOut,
)
from app.schemas.user import ChangePasswordRequest, RevokeOthersRequest, SessionOut
from app.services import account_service, instructor_service

router = APIRouter(
    prefix="/instructor",
    tags=["instructor-portal"],
    dependencies=[Depends(require_role(SA_INSTRUCTOR))],
)


def _ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


def _current_user(user: User) -> CurrentUser:
    return CurrentUser(
        id=user.id,
        email=user.email,
        role=user.role.name,
        institute_id=user.institute_id,
        first_name=user.first_name,
        last_name=user.last_name,
        force_password_reset=user.force_password_reset,
        avatar_url=account_service.avatar_url_for(user),
    )


@router.get(
    "/dashboard/summary",
    response_model=InstructorDashboardOut,
    dependencies=[Depends(require_password_change_complete)],
)
def dashboard_summary(
    db: Session = Depends(get_db), actor: User = Depends(get_current_user)
):
    return instructor_service.dashboard_summary(db, actor)


@router.get("/me/profile", response_model=InstructorAccountOut)
def get_my_profile(
    db: Session = Depends(get_db), actor: User = Depends(get_current_user)
):
    return instructor_service._serialize(
        instructor_service.get_instructor_or_404(db, actor.id)
    )


@router.patch("/me/profile", response_model=InstructorAccountOut)
def update_my_profile(
    payload: InstructorAccountUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    values = payload.model_dump()
    fields_set = set(payload.model_fields_set)
    values["title"] = None
    values["specializations"] = None
    fields_set.discard("title")
    fields_set.discard("specializations")
    return instructor_service.update_instructor(
        db,
        actor,
        actor.id,
        **values,
        fields_set=fields_set,
        ip=_ip(request),
    )


@router.post("/me/avatar", response_model=CurrentUser)
async def upload_my_avatar(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return _current_user(await account_service.save_avatar(db, actor, file, _ip(request)))


@router.post("/me/change-password", status_code=204)
def change_my_password(
    payload: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    account_service.change_password(
        db, actor, payload.current_password, payload.new_password, _ip(request)
    )


@router.get("/me/sessions", response_model=list[SessionOut])
def list_my_sessions(
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
    x_refresh_token: Optional[str] = Header(default=None),
):
    return account_service.list_sessions(db, actor, x_refresh_token)


@router.delete("/me/sessions/{session_id}", status_code=204)
def revoke_my_session(
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    account_service.revoke_session(db, actor, session_id, _ip(request))


@router.post("/me/sessions/revoke-others")
def revoke_my_other_sessions(
    payload: RevokeOthersRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return {
        "revoked": account_service.revoke_other_sessions(
            db, actor, payload.refresh_token, _ip(request)
        )
    }
