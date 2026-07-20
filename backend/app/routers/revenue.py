from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_role
from app.models.role import SUPER_ADMIN
from app.services import revenue_service

router = APIRouter(
    prefix="/super-admin/revenue",
    tags=["revenue"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


@router.get("/summary")
def get_summary(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    institute_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    return revenue_service.summary(db, date_from, date_to, institute_id)
