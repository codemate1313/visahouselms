from typing import Optional

from fastapi import APIRouter, Depends, File, Request, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.schemas.institute import BrandingUpdate, InstituteCreate, InstituteUpdate
from app.services import institute_service

router = APIRouter(
    prefix="/super-admin/institutes",
    tags=["institutes"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)

# public router: no auth - a logged-out themed login page needs this in Phase 4/5
public_router = APIRouter(prefix="/institutes", tags=["institutes-public"])


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
        db, actor, institute_id, payload.name, payload.contact_email, _client_ip(request)
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
