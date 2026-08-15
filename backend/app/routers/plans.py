from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.geo_ip import detect_country_code
from app.dependencies.auth import get_current_user, require_role
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.schemas.plan import PlanCreate, PlanDisplaySettings, PlanUpdate
from app.services import currency_conversion_service, plan_service

router = APIRouter(
    prefix="/super-admin/plans",
    tags=["plans"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)

# Unauthenticated: powers the marketing pricing page, which has no session yet.
public_router = APIRouter(prefix="/plans", tags=["plans"])


@public_router.get("")
def list_landing_plans(db: Session = Depends(get_db)):
    return plan_service.list_landing_plans(db)


@public_router.get("/location")
def get_landing_location(request: Request):
    country_code = detect_country_code(request)
    response = {
        "country": country_code,
        "default_currency": "INR" if country_code == "IN" else "USD",
    }
    if country_code != "IN":
        response["conversion"] = currency_conversion_service.get_inr_usd_display_rate()
    return response


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.get("")
def list_plans(
    audience: Optional[str] = Query(
        default=None, pattern="^(direct_students|institutes)$"
    ),
    db: Session = Depends(get_db),
):
    """One catalogue at a time. Omitting `audience` returns both and exists only
    for callers that genuinely want every plan (exports, tooling)."""
    return plan_service.list_plans(db, audience=audience)


@router.get("/display-settings")
def get_display_settings(db: Session = Depends(get_db)):
    """Which catalogues the public pricing page lists. Declared before
    `/{plan_id}` so the literal path wins the route match."""
    return plan_service.get_landing_visibility(db)


@router.put("/display-settings")
def update_display_settings(
    payload: PlanDisplaySettings,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return plan_service.set_landing_visibility(
        db, actor, payload.model_dump(exclude_unset=True), _client_ip(request)
    )


@router.get("/available-modules")
def list_available_modules(
    search: Optional[str] = Query(default=None, max_length=200),
    module_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return plan_service.list_available_modules_for_plans(db, search, module_type)


@router.post("", status_code=status.HTTP_201_CREATED)
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


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plan(
    plan_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    plan_service.delete_plan(db, actor, plan_id, _client_ip(request))
