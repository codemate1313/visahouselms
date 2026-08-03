from typing import Optional

from fastapi import APIRouter, Depends, File, Request, status, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_session, get_current_user, require_role
from app.models.role import INST_INSTRUCTOR
from app.models.user import User
from app.models.user_session import UserSession
from app.schemas.auth import CurrentUser
from app.schemas.user import ChangePasswordRequest, ProfileUpdateRequest, SessionOut
from app.services import account_service

router = APIRouter(
    prefix="/institute-instructor",
    tags=["institute-instructor"],
    dependencies=[Depends(require_role(INST_INSTRUCTOR))],
)


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
        is_owner=user.is_owner,
        is_developer_verified=user.is_developer_verified,
        dob=user.dob,
        phone_number=user.phone_number,
        address=user.address,
        gender=user.gender,
    )


@router.get("/me/profile", response_model=CurrentUser)
def get_my_profile(actor: User = Depends(get_current_user)):
    return _current_user_out(actor)


@router.patch("/me/profile", response_model=CurrentUser)
def update_my_profile(
    payload: ProfileUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return _current_user_out(
        account_service.update_profile(
            db,
            actor,
            payload.email,
            payload.first_name,
            payload.last_name,
            _ip(request),
            dob=payload.dob,
            phone_number=payload.phone_number,
            address=payload.address,
            gender=payload.gender,
        )
    )


@router.post("/me/avatar", response_model=CurrentUser)
async def upload_my_avatar(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return _current_user_out(await account_service.save_avatar(db, actor, file, _ip(request)))


@router.post("/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    if actor.force_password_reset:
        account_service.set_initial_password(db, actor, payload.new_password, _ip(request))
        return
    account_service.change_password(db, actor, payload.current_password, payload.new_password, _ip(request))


@router.get("/me/sessions", response_model=list[SessionOut])
def list_sessions(
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
    current_session: UserSession = Depends(get_current_session),
):
    return account_service.list_sessions(db, actor, current_session.id)


@router.delete("/me/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_session(
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    account_service.revoke_session(db, actor, session_id, _ip(request))


@router.post("/me/sessions/revoke-others")
def revoke_other_sessions(
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
    current_session: UserSession = Depends(get_current_session),
):
    return {
        "revoked": account_service.revoke_other_sessions(
            db, actor, current_session.id, _ip(request)
        )
    }
