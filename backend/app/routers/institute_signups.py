from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.institute_signup import SIGNUP_STATUSES
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.schemas.institute_signup import InstituteSignupCreate, InstituteSignupReject
from app.services import institute_signup_service

# Unauthenticated: this is the form on the public pricing page. It creates an
# application row and nothing else - no institute, no account, no access.
public_router = APIRouter(prefix="/institute-signup", tags=["institute-signup"])

router = APIRouter(
    prefix="/super-admin/institute-signups",
    tags=["institute-signup"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


def _ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@public_router.post("", status_code=status.HTTP_201_CREATED)
def submit_application(payload: InstituteSignupCreate, request: Request, db: Session = Depends(get_db)):
    return institute_signup_service.submit(db, payload.model_dump(), _ip(request))


@router.get("")
def list_applications(
    status_filter: Optional[str] = Query(default=None, alias="status", pattern="^(pending|approved|rejected)$"),
    db: Session = Depends(get_db),
):
    return institute_signup_service.list_requests(db, status_filter)


@router.get("/pending-count")
def count_pending(db: Session = Depends(get_db)):
    """Backs the dashboard badge. Declared before `/{request_id}` so the
    literal path wins the route match."""
    return {"pending": institute_signup_service.pending_count(db), "statuses": list(SIGNUP_STATUSES)}


@router.get("/{request_id}")
def get_application(request_id: int, db: Session = Depends(get_db)):
    from app.services.institute_signup_service import _serialize

    return _serialize(institute_signup_service.get_or_404(db, request_id))


@router.post("/{request_id}/approve")
def approve_application(
    request_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return institute_signup_service.approve(db, actor, request_id, _ip(request))


@router.post("/{request_id}/reject")
def reject_application(
    request_id: int,
    payload: InstituteSignupReject,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return institute_signup_service.reject(db, actor, request_id, payload.reason, _ip(request))
