from typing import Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.schemas.trial import DemoModuleSelection, TrialConfigUpdate
from app.services import trial_service

router = APIRouter(
    prefix="/super-admin/trial-config",
    tags=["trial-config"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.get("")
def get_trial_config(db: Session = Depends(get_db)):
    return trial_service.get_config_dict(db)


@router.put("")
def update_trial_config(
    payload: TrialConfigUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return trial_service.update_config(
        db,
        actor,
        payload.trial_duration_days,
        payload.course_limit,
        payload.is_enabled,
        _client_ip(request),
    )


@router.get("/demo-modules")
def list_demo_modules(db: Session = Depends(get_db)):
    """Published modules that can be offered as free demos, and which are."""
    return trial_service.list_demo_module_options(db)


@router.put("/demo-modules")
def set_demo_modules(
    payload: DemoModuleSelection,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return trial_service.set_demo_modules(db, actor, payload.module_ids, _client_ip(request))
