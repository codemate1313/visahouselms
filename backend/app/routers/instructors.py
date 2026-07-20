from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.schemas.instructor import (
    InstructorAccountCreate,
    InstructorAccountCreated,
    InstructorAccountOut,
    InstructorAccountUpdate,
    InstructorPasswordResetOut,
)
from app.services import instructor_service

router = APIRouter(
    prefix="/super-admin/instructors",
    tags=["super-admin-instructors"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


def _ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.get("", response_model=list[InstructorAccountOut])
def list_instructors(
    search: Optional[str] = Query(default=None, max_length=120),
    active: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    return instructor_service.list_instructors(db, search, active)


@router.get("/{instructor_id}", response_model=InstructorAccountOut)
def get_instructor(instructor_id: int, db: Session = Depends(get_db)):
    return instructor_service._serialize(
        instructor_service.get_instructor_or_404(db, instructor_id)
    )


@router.post("", response_model=InstructorAccountCreated, status_code=201)
def create_instructor(
    payload: InstructorAccountCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    result = instructor_service.create_instructor(
        db, actor, **payload.model_dump(), ip=_ip(request)
    )
    return result


@router.patch("/{instructor_id}", response_model=InstructorAccountOut)
def update_instructor(
    instructor_id: int,
    payload: InstructorAccountUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    values = payload.model_dump()
    return instructor_service.update_instructor(
        db,
        actor,
        instructor_id,
        **values,
        fields_set=payload.model_fields_set,
        ip=_ip(request),
    )


@router.post("/{instructor_id}/deactivate", response_model=InstructorAccountOut)
def deactivate_instructor(
    instructor_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return instructor_service.set_active(db, actor, instructor_id, False, _ip(request))


@router.post("/{instructor_id}/reactivate", response_model=InstructorAccountOut)
def reactivate_instructor(
    instructor_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return instructor_service.set_active(db, actor, instructor_id, True, _ip(request))


@router.post("/{instructor_id}/reset-password", response_model=InstructorPasswordResetOut)
def reset_instructor_password(
    instructor_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return {
        "temporary_password": instructor_service.reset_password(
            db, actor, instructor_id, _ip(request)
        )
    }


@router.delete("/{instructor_id}", status_code=204)
def delete_instructor(
    instructor_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    instructor_service.delete_instructor(db, actor, instructor_id, _ip(request))
