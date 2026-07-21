from typing import Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.schemas.onboarding import InstituteOnboardingCreate
from app.services import onboarding_service

router = APIRouter(
    prefix="/super-admin/onboarding",
    tags=["institute-onboarding"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


def _ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.get("")
def list_onboardings(db: Session = Depends(get_db)):
    return onboarding_service.list_onboardings(db)


@router.post("", status_code=201)
def create_onboarding(payload: InstituteOnboardingCreate, request: Request, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    return onboarding_service.create_draft(db, actor, payload.model_dump(), _ip(request))


@router.get("/{institute_id}")
def get_onboarding(institute_id: int, db: Session = Depends(get_db)):
    return onboarding_service.get_onboarding(db, institute_id)


@router.post("/{institute_id}/publish")
def publish_onboarding(institute_id: int, request: Request, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    return onboarding_service.publish(db, actor, institute_id, _ip(request))
