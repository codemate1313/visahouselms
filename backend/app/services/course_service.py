import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.core.uploads import read_validated_course_asset
from app.models.attempt import CourseModule, Enrollment
from app.models.audit_log import AuditLog
from app.models.coupon import Coupon
from app.models.course import (
    COURSE_ARCHIVED,
    COURSE_DRAFT,
    COURSE_PUBLISHED,
    ASSET_TYPES,
    Course,
    CourseAsset,
    InstituteCourse,
)
from app.models.exam_module import ExamModule
from app.models.institute import Institute
from app.models.payment import Payment
from app.models.user import User


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _audit(
    db: Session,
    actor: User,
    action: str,
    course_id: int,
    ip: Optional[str],
    details: Optional[dict] = None,
) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            action=action,
            entity_type="course",
            entity_id=course_id,
            details=details,
            ip_address=ip,
        )
    )


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-") or "course"


def _unique_slug(db: Session, title: str, exclude_id: Optional[int] = None) -> str:
    base = _slugify(title)
    candidate = base
    suffix = 2
    while True:
        query = db.query(Course).filter(Course.slug == candidate)
        if exclude_id is not None:
            query = query.filter(Course.id != exclude_id)
        if query.first() is None:
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1


def _course_query(db: Session):
    return db.query(Course).options(
        joinedload(Course.created_by),
        joinedload(Course.assets),
        joinedload(Course.institute_assignments).joinedload(InstituteCourse.institute),
        joinedload(Course.course_modules).joinedload(CourseModule.module),
    )


def _asset_out(asset: CourseAsset) -> dict:
    return {
        "id": asset.id,
        "course_id": asset.course_id,
        "asset_type": asset.asset_type,
        "title": asset.title,
        "original_filename": asset.original_filename,
        "file_url": f"/storage/{asset.file_path}",
        "mime_type": asset.mime_type,
        "file_size": asset.file_size,
        "sort_order": asset.sort_order,
        "created_at": asset.created_at,
    }


def _module_link_out(link: CourseModule) -> dict:
    module = link.module
    return {
        "id": link.id,
        "module_id": module.id,
        "module_type": module.module_type,
        "title": module.title,
        "status": module.status,
        "duration_minutes": module.duration_minutes,
        "sort_order": link.sort_order,
    }


def _assignment_out(assignment: InstituteCourse) -> dict:
    return {
        "id": assignment.id,
        "institute_id": assignment.institute_id,
        "institute_name": assignment.institute.name,
        "course_id": assignment.course_id,
        "is_active": assignment.is_active,
        "assigned_at": assignment.assigned_at,
    }


def serialize(course: Course, include_assignments: bool = False) -> dict:
    active_assignments = [item for item in course.institute_assignments if item.is_active]
    result = {
        "id": course.id,
        "title": course.title,
        "slug": course.slug,
        "summary": course.summary,
        "description": course.description,
        "level": course.level,
        "estimated_duration_minutes": course.estimated_duration_minutes,
        "price": str(course.price),
        "currency": course.currency,
        "status": course.status,
        "is_featured": course.is_featured,
        "is_visible": course.is_visible,
        "created_by_id": course.created_by_id,
        "created_by_name": f"{course.created_by.first_name} {course.created_by.last_name}",
        "created_by_email": course.created_by.email,
        "published_at": course.published_at,
        "created_at": course.created_at,
        "updated_at": course.updated_at,
        "deleted_at": course.deleted_at,
        "asset_count": len(course.assets),
        "assignment_count": len(active_assignments),
        "assets": [_asset_out(asset) for asset in sorted(course.assets, key=lambda item: item.sort_order)],
        "modules": [
            _module_link_out(link)
            for link in sorted(course.course_modules, key=lambda item: item.sort_order)
        ],
    }
    if include_assignments:
        result["assignments"] = [
            _assignment_out(item)
            for item in sorted(course.institute_assignments, key=lambda row: row.institute.name.lower())
        ]
    return result


def list_courses(
    db: Session,
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    creator_id: Optional[int] = None,
    include_deleted: bool = False,
) -> list[dict]:
    query = _course_query(db)
    if not include_deleted:
        query = query.filter(Course.deleted_at.is_(None))
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(Course.title.ilike(term), Course.summary.ilike(term), Course.slug.ilike(term))
        )
    if status_filter:
        query = query.filter(Course.status == status_filter)
    if creator_id is not None:
        query = query.filter(Course.created_by_id == creator_id)
    return [serialize(course) for course in query.order_by(Course.created_at.desc()).all()]


def get_course_or_404(db: Session, course_id: int) -> Course:
    course = _course_query(db).filter(Course.id == course_id, Course.deleted_at.is_(None)).first()
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return course


def create_course(db: Session, actor: User, data: dict, ip: Optional[str]) -> dict:
    course = Course(
        title=data["title"],
        slug=_unique_slug(db, data["title"]),
        summary=data.get("summary"),
        description=data.get("description"),
        level=data.get("level", "all_levels"),
        estimated_duration_minutes=data.get("estimated_duration_minutes"),
        price=data.get("price", 0),
        currency=data.get("currency", "INR"),
        status=COURSE_DRAFT,
        is_featured=data.get("is_featured", False),
        created_by_id=actor.id,
    )
    db.add(course)
    db.flush()
    _audit(db, actor, "course.create", course.id, ip, {"title": course.title})
    db.commit()
    return serialize(get_course_or_404(db, course.id), include_assignments=True)


def update_course(
    db: Session,
    actor: User,
    course_id: int,
    data: dict,
    fields_set: set[str],
    ip: Optional[str],
) -> dict:
    course = get_course_or_404(db, course_id)
    if course.status == COURSE_ARCHIVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archived courses cannot be edited; move it back to draft first",
        )

    if "title" in fields_set and data.get("title") != course.title:
        course.title = data["title"]
        course.slug = _unique_slug(db, data["title"], exclude_id=course.id)
    for field in (
        "summary",
        "description",
        "level",
        "estimated_duration_minutes",
        "price",
        "currency",
        "is_featured",
    ):
        if field in fields_set:
            setattr(course, field, data.get(field))

    db.add(course)
    _audit(db, actor, "course.update", course.id, ip, {"fields": sorted(fields_set)})
    db.commit()
    return serialize(get_course_or_404(db, course.id), include_assignments=True)


def set_status(
    db: Session, actor: User, course_id: int, new_status: str, ip: Optional[str]
) -> dict:
    course = get_course_or_404(db, course_id)
    if new_status == course.status:
        return serialize(course, include_assignments=True)

    if new_status == COURSE_PUBLISHED:
        if not course.course_modules:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Attach at least one assessment module before publishing",
            )
        if any(link.module.status != "published" for link in course.course_modules):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Every attached module must be published first",
            )
        if not course.summary and not course.description:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Add a summary or description before publishing",
            )
        course.status = COURSE_PUBLISHED
        course.published_at = _now()
    elif new_status == COURSE_DRAFT:
        active_assignments = (
            db.query(InstituteCourse)
            .filter(InstituteCourse.course_id == course.id, InstituteCourse.is_active.is_(True))
            .count()
        )
        if active_assignments:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unassign this course from all institutes before moving it to draft",
            )
        course.status = COURSE_DRAFT
        course.published_at = None
    elif new_status == COURSE_ARCHIVED:
        course.status = COURSE_ARCHIVED
        assignments = db.query(InstituteCourse).filter(
            InstituteCourse.course_id == course.id, InstituteCourse.is_active.is_(True)
        )
        disabled = assignments.update({"is_active": False}, synchronize_session=False)
        _audit(db, actor, "course.assignments_disabled", course.id, ip, {"count": disabled})
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid course status")

    db.add(course)
    _audit(db, actor, f"course.{new_status}", course.id, ip)
    db.commit()
    return serialize(get_course_or_404(db, course.id), include_assignments=True)


def _asset_path(relative_path: str) -> Path:
    target = (settings.storage_path / relative_path).resolve()
    root = settings.storage_path.resolve()
    if root not in target.parents:
        raise RuntimeError("Unsafe course asset path")
    return target


async def add_asset(
    db: Session,
    actor: User,
    course_id: int,
    title: Optional[str],
    upload: UploadFile,
    ip: Optional[str],
) -> dict:
    course = get_course_or_404(db, course_id)
    if course.status == COURSE_ARCHIVED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Archived courses cannot accept files")

    asset_type, extension, content = await read_validated_course_asset(upload)
    if asset_type not in ASSET_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported asset type")
    original_name = (upload.filename or f"course-resource{extension}")[:255]
    display_title = (title or Path(original_name).stem).strip()[:200]
    if not display_title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Resource title cannot be blank")

    relative_path = f"course_assets/course_{course.id}/{uuid.uuid4().hex}{extension}"
    destination = _asset_path(relative_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(content)
    try:
        asset = CourseAsset(
            course_id=course.id,
            asset_type=asset_type,
            title=display_title,
            original_filename=original_name,
            file_path=relative_path,
            mime_type=upload.content_type or "application/octet-stream",
            file_size=len(content),
            sort_order=len(course.assets),
            uploaded_by_id=actor.id,
        )
        db.add(asset)
        db.flush()
        _audit(db, actor, "course.asset_add", course.id, ip, {"asset_id": asset.id, "type": asset_type})
        db.commit()
        db.refresh(asset)
        return _asset_out(asset)
    except Exception:
        db.rollback()
        if destination.is_file():
            destination.unlink()
        raise


def update_asset(
    db: Session, actor: User, course_id: int, asset_id: int, title: str, ip: Optional[str]
) -> dict:
    get_course_or_404(db, course_id)
    asset = db.query(CourseAsset).filter(
        CourseAsset.id == asset_id, CourseAsset.course_id == course_id
    ).first()
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course resource not found")
    asset.title = title.strip()
    db.add(asset)
    _audit(db, actor, "course.asset_update", course_id, ip, {"asset_id": asset.id})
    db.commit()
    db.refresh(asset)
    return _asset_out(asset)


def reorder_assets(
    db: Session, actor: User, course_id: int, asset_ids: list[int], ip: Optional[str]
) -> list[dict]:
    course = get_course_or_404(db, course_id)
    current_ids = {asset.id for asset in course.assets}
    if len(asset_ids) != len(set(asset_ids)) or set(asset_ids) != current_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="asset_ids must contain every course resource exactly once",
        )
    by_id = {asset.id: asset for asset in course.assets}
    for index, asset_id in enumerate(asset_ids):
        by_id[asset_id].sort_order = index
        db.add(by_id[asset_id])
    _audit(db, actor, "course.asset_reorder", course_id, ip)
    db.commit()
    return [_asset_out(by_id[asset_id]) for asset_id in asset_ids]


def delete_asset(
    db: Session, actor: User, course_id: int, asset_id: int, ip: Optional[str]
) -> None:
    course = get_course_or_404(db, course_id)
    if course.status == COURSE_ARCHIVED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Archived courses cannot be edited")
    asset = db.query(CourseAsset).filter(
        CourseAsset.id == asset_id, CourseAsset.course_id == course_id
    ).first()
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course resource not found")
    file_path = _asset_path(asset.file_path)
    db.delete(asset)
    _audit(db, actor, "course.asset_delete", course_id, ip, {"asset_id": asset.id})
    db.commit()
    if file_path.is_file():
        file_path.unlink()


def attach_module(
    db: Session, actor: User, course_id: int, module_id: int, ip: Optional[str]
) -> dict:
    course = get_course_or_404(db, course_id)
    if course.status == COURSE_ARCHIVED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Archived courses cannot be edited")
    module = db.get(ExamModule, module_id)
    if module is None or module.created_by_id != actor.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found")
    if module.status != "published":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Only published modules can be attached to a course"
        )
    exists = db.query(CourseModule).filter(
        CourseModule.course_id == course.id, CourseModule.module_id == module.id
    ).first()
    if exists is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This module is already attached")

    link = CourseModule(course_id=course.id, module_id=module.id, sort_order=len(course.course_modules))
    db.add(link)
    db.flush()
    _audit(db, actor, "course.module_attach", course.id, ip, {"module_id": module.id})
    db.commit()
    return serialize(get_course_or_404(db, course.id), include_assignments=True)


def detach_module(
    db: Session, actor: User, course_id: int, module_id: int, ip: Optional[str]
) -> dict:
    course = get_course_or_404(db, course_id)
    link = db.query(CourseModule).filter(
        CourseModule.course_id == course.id, CourseModule.module_id == module_id
    ).first()
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module is not attached to this course")
    db.delete(link)
    _audit(db, actor, "course.module_detach", course.id, ip, {"module_id": module_id})
    db.commit()
    return serialize(get_course_or_404(db, course.id), include_assignments=True)


def reorder_modules(
    db: Session, actor: User, course_id: int, module_ids: list[int], ip: Optional[str]
) -> dict:
    course = get_course_or_404(db, course_id)
    current_ids = {link.module_id for link in course.course_modules}
    if len(module_ids) != len(set(module_ids)) or set(module_ids) != current_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="module_ids must contain every attached module exactly once",
        )
    by_module_id = {link.module_id: link for link in course.course_modules}
    for index, module_id in enumerate(module_ids):
        by_module_id[module_id].sort_order = index
        db.add(by_module_id[module_id])
    _audit(db, actor, "course.module_reorder", course_id, ip)
    db.commit()
    return serialize(get_course_or_404(db, course.id), include_assignments=True)


def delete_course(db: Session, actor: User, course_id: int, ip: Optional[str]) -> None:
    course = get_course_or_404(db, course_id)
    has_assignments = db.query(InstituteCourse).filter(InstituteCourse.course_id == course.id).count() > 0
    has_payments = db.query(Payment).filter(Payment.course_id == course.id).count() > 0
    has_coupons = db.query(Coupon).filter(Coupon.scope_course_id == course.id).count() > 0
    has_enrollments = db.query(Enrollment).filter(Enrollment.course_id == course.id).count() > 0
    if has_assignments or has_payments or has_coupons or has_enrollments:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This course has assignment, coupon, or payment history and cannot be deleted; archive it instead",
        )
    paths = [_asset_path(asset.file_path) for asset in course.assets]
    _audit(db, actor, "course.delete", course.id, ip, {"title": course.title})
    db.delete(course)
    db.commit()
    for path in paths:
        if path.is_file():
            path.unlink()


def set_visibility(
    db: Session, actor: User, course_id: int, is_visible: bool, ip: Optional[str]
) -> dict:
    course = get_course_or_404(db, course_id)
    course.is_visible = is_visible
    db.add(course)
    _audit(db, actor, "course.show" if is_visible else "course.hide", course.id, ip)
    db.commit()
    return serialize(get_course_or_404(db, course.id), include_assignments=True)


def remove_course_by_super_admin(
    db: Session, actor: User, course_id: int, ip: Optional[str]
) -> None:
    """Remove a course from every live surface while retaining its history."""
    course = get_course_or_404(db, course_id)
    course.status = COURSE_ARCHIVED
    course.is_visible = False
    course.deleted_at = _now()
    assignments_disabled = (
        db.query(InstituteCourse)
        .filter(InstituteCourse.course_id == course.id, InstituteCourse.is_active.is_(True))
        .update({"is_active": False}, synchronize_session=False)
    )
    enrollments_disabled = (
        db.query(Enrollment)
        .filter(Enrollment.course_id == course.id, Enrollment.is_active.is_(True))
        .update({"is_active": False}, synchronize_session=False)
    )
    _audit(
        db,
        actor,
        "course.remove",
        course.id,
        ip,
        {"assignments_revoked": assignments_disabled, "enrollments_revoked": enrollments_disabled},
    )
    db.add(course)
    db.commit()


def list_assignments(db: Session, course_id: int) -> list[dict]:
    course = get_course_or_404(db, course_id)
    return serialize(course, include_assignments=True)["assignments"]


def assign_to_institute(
    db: Session, actor: User, course_id: int, institute_id: int, ip: Optional[str]
) -> dict:
    course = get_course_or_404(db, course_id)
    if course.status != COURSE_PUBLISHED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only published courses can be assigned")
    institute = db.get(Institute, institute_id)
    if institute is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institute not found")
    if not institute.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Suspended institutes cannot receive courses")

    assignment = db.query(InstituteCourse).filter(
        InstituteCourse.course_id == course.id,
        InstituteCourse.institute_id == institute.id,
    ).first()
    action = "course.assign"
    if assignment is None:
        assignment = InstituteCourse(
            course_id=course.id,
            institute_id=institute.id,
            assigned_by_id=actor.id,
            is_active=True,
        )
        db.add(assignment)
    elif assignment.is_active:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Course is already assigned to this institute")
    else:
        assignment.is_active = True
        assignment.assigned_by_id = actor.id
        assignment.assigned_at = _now()
        db.add(assignment)
        action = "course.reassign"
    db.flush()
    _audit(db, actor, action, course.id, ip, {"institute_id": institute.id})
    db.commit()
    assignment = db.query(InstituteCourse).options(joinedload(InstituteCourse.institute)).filter(
        InstituteCourse.id == assignment.id
    ).one()
    return _assignment_out(assignment)


def unassign_from_institute(
    db: Session, actor: User, course_id: int, institute_id: int, ip: Optional[str]
) -> None:
    assignment = db.query(InstituteCourse).filter(
        InstituteCourse.course_id == course_id,
        InstituteCourse.institute_id == institute_id,
        InstituteCourse.is_active.is_(True),
    ).first()
    if assignment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active course assignment not found")
    assignment.is_active = False
    db.add(assignment)
    _audit(db, actor, "course.unassign", course_id, ip, {"institute_id": institute_id})
    db.commit()
