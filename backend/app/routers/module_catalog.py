from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.exam_module import MODULE_STATUSES, MODULE_TYPES
from app.models.role import SUPER_ADMIN
from app.models.user import User
from app.schemas.exam_module import ModuleInstituteAssignment, ModuleStatusUpdate, ModuleVisibilityUpdate
from app.services import module_authoring_service

router = APIRouter(
    prefix="/super-admin/modules",
    tags=["module-course-control"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


def _ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.get("")
def list_modules(search: Optional[str] = Query(default=None, max_length=200), module_type: Optional[str] = None, status_filter: Optional[str] = Query(default=None, alias="status"), db: Session = Depends(get_db)):
    if module_type and module_type not in MODULE_TYPES:
        return []
    if status_filter and status_filter not in MODULE_STATUSES:
        return []
    return module_authoring_service.list_all_modules(db, search, module_type, status_filter)


@router.get("/{module_id}")
def get_module(module_id: int, db: Session = Depends(get_db)):
    return module_authoring_service.serialize_for_super_admin(module_authoring_service.get_module_or_404(db, module_id))


@router.post("/{module_id}/status")
def set_status(module_id: int, payload: ModuleStatusUpdate, request: Request, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    module = module_authoring_service.get_module_or_404(db, module_id)
    if payload.status == "published":
        errors = module_authoring_service.validation_errors(module)
        if errors:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail={"message": "Course is not ready to publish", "errors": errors})
        module.published_at = module_authoring_service._now()
    module.status = payload.status
    db.add(module)
    db.commit()
    return module_authoring_service.serialize_for_super_admin(module_authoring_service.get_module_or_404(db, module_id))


@router.patch("/{module_id}/visibility")
def set_visibility(module_id: int, payload: ModuleVisibilityUpdate, request: Request, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    return module_authoring_service.set_visibility(db, actor, module_id, payload.is_visible, _ip(request))


@router.post("/{module_id}/assignments", status_code=201)
def assign(module_id: int, payload: ModuleInstituteAssignment, request: Request, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    return module_authoring_service.assign_to_institute(db, actor, module_id, payload.institute_id, _ip(request))


@router.delete("/{module_id}/assignments/{institute_id}", status_code=204)
def unassign(module_id: int, institute_id: int, request: Request, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    module_authoring_service.unassign_from_institute(db, actor, module_id, institute_id, _ip(request))


@router.delete("/{module_id}", status_code=204)
def remove(module_id: int, request: Request, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    module_authoring_service.remove_by_super_admin(db, actor, module_id, _ip(request))
