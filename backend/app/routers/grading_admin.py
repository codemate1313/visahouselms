from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_role
from app.models.role import SUPER_ADMIN
from app.services import grading_service

router = APIRouter(
    prefix="/super-admin/grading",
    tags=["grading-oversight"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    return grading_service.admin_overview(db)
