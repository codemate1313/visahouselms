from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_role
from app.models.role import SUPER_ADMIN
from app.services import dashboard_service

router = APIRouter(
    prefix="/super-admin/dashboard",
    tags=["dashboard"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


@router.get("/summary")
def get_summary(db: Session = Depends(get_db)):
    return dashboard_service.get_summary(db)
