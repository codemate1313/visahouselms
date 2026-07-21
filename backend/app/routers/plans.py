from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.schemas.plan import PlanCreate, PlanUpdate
from app.services import plan_service

router = APIRouter(
    prefix="/super-admin/plans",
    tags=["plans"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.get("")
def list_plans(db: Session = Depends(get_db)):
    return plan_service.list_plans(db)


@router.get("/available-modules")
def list_available_modules(
    search: Optional[str] = Query(default=None, max_length=200),
    module_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return plan_service.list_available_modules_for_plans(db, search, module_type)


@router.post("", status_code=201)
def create_plan(
    payload: PlanCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return plan_service.create_plan(db, actor, payload.model_dump(), _client_ip(request))


@router.get("/{plan_id}")
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    return plan_service.get_plan(db, plan_id)


@router.patch("/{plan_id}")
def update_plan(
    plan_id: int,
    payload: PlanUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return plan_service.update_plan(db, actor, plan_id, payload.model_dump(exclude_unset=True), _client_ip(request))


@router.post("/{plan_id}/deactivate")
def deactivate_plan(
    plan_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return plan_service.set_plan_active(db, actor, plan_id, False, _client_ip(request))


@router.post("/{plan_id}/reactivate")
def reactivate_plan(
    plan_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return plan_service.set_plan_active(db, actor, plan_id, True, _client_ip(request))


@router.delete("/{plan_id}", status_code=204)
def delete_plan(
    plan_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    plan_service.delete_plan(db, actor, plan_id, _client_ip(request))
