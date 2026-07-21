from typing import Optional

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.role import INST_INSTRUCTOR
from app.models.user import User
from app.schemas.user import ChangePasswordRequest, RevokeOthersRequest, SessionOut
from app.services import account_service

router = APIRouter(
    prefix="/institute-instructor",
    tags=["institute-instructor"],
    dependencies=[Depends(require_role(INST_INSTRUCTOR))],
)


def _ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.post("/me/change-password", status_code=204)
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    account_service.change_password(db, actor, payload.current_password, payload.new_password, _ip(request))


@router.get("/me/sessions", response_model=list[SessionOut])
def list_sessions(
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
    x_refresh_token: Optional[str] = Header(default=None),
):
    return account_service.list_sessions(db, actor, x_refresh_token)


@router.delete("/me/sessions/{session_id}", status_code=204)
def revoke_session(
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    account_service.revoke_session(db, actor, session_id, _ip(request))


@router.post("/me/sessions/revoke-others")
def revoke_other_sessions(
    payload: RevokeOthersRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return {"revoked": account_service.revoke_other_sessions(db, actor, payload.refresh_token, _ip(request))}
