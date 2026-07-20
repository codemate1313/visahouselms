from typing import Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.schemas.trial import DemoAccountCreate
from app.services import demo_service

router = APIRouter(
    prefix="/super-admin/demo-accounts",
    tags=["demo-accounts"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.get("")
def list_demo_accounts(db: Session = Depends(get_db)):
    return demo_service.list_demos(db)


@router.post("", status_code=201)
def create_demo_account(
    payload: DemoAccountCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return demo_service.create_demo(
        db,
        actor,
        payload.name,
        payload.admin_email,
        payload.admin_first_name,
        payload.admin_last_name,
        payload.duration_days,
        payload.course_limit,
        payload.test_limit,
        _client_ip(request),
    )


@router.get("/{demo_id}")
def get_demo_account(demo_id: int, db: Session = Depends(get_db)):
    return demo_service.get_demo_status(db, demo_id)
