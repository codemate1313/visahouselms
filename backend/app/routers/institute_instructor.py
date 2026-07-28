from typing import Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_session, get_current_user, require_role
from app.models.role import INST_INSTRUCTOR
from app.models.user import User
from app.models.user_session import UserSession
from app.schemas.user import ChangePasswordRequest, SessionOut
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
    current_session: UserSession = Depends(get_current_session),
):
    return account_service.list_sessions(db, actor, current_session.id)


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
