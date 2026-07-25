import json
import logging
import re
import secrets
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import delete, or_, select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import hash_password
from app.core.uploads import read_validated_image
from app.models.audit_log import AuditLog
from app.models.base import Base
from app.models.demo_account import DemoAccount
from app.models.institute import Institute
from app.models.institute_branding import InstituteBranding
from app.models.payment import Payment
from app.models.role import INSTITUTE_ADMIN, Role
from app.models.subscription import Subscription
from app.models.user import User
from app.models.user_session import UserSession
from app.services.subscription_service import current_subscription

MAX_LOGO_BYTES = 2 * 1024 * 1024
ALLOWED_FONT_FAMILIES = {"Plus Jakarta Sans", "Inter", "Sora", "Outfit", "system-ui"}
ALLOWED_FONT_WEIGHTS = {400, 500, 600, 700, 800}
DEFAULT_ADMIN_PERMISSIONS = {
    "view_students": False,
    "manage_students": False,
    "view_student_activity": False,
    "manage_student_sessions": False,
    "manage_staff": False,
    "view_billing": False,
}
logger = logging.getLogger(__name__)


def normalized_admin_permissions(value: Optional[dict]) -> dict:
    permissions = DEFAULT_ADMIN_PERMISSIONS.copy()
    if value:
        permissions.update(
            {key: bool(value.get(key)) for key in DEFAULT_ADMIN_PERMISSIONS if key in value}
        )
    return permissions


def _audit(db: Session, actor: User, action: str, entity_id: Optional[int], ip: Optional[str], details=None) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            action=action,
            entity_type="institute",
            entity_id=entity_id,
            details=details,
            ip_address=ip,
        )
    )


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "institute"


def _unique_slug(db: Session, name: str, exclude_id: Optional[int] = None) -> str:
    base = slugify(name)
    slug = base
    suffix = 2
    while True:
        query = db.query(Institute).filter(Institute.slug == slug)
        if exclude_id is not None:
            query = query.filter(Institute.id != exclude_id)
        if query.first() is None:
            return slug
        slug = f"{base}-{suffix}"
        suffix += 1


def get_institute_or_404(db: Session, institute_id: int) -> Institute:
    institute = db.get(Institute, institute_id)
    if institute is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institute not found")
    return institute


def _serialize(db: Session, institute: Institute) -> dict:
    _, sub_state = current_subscription(db, institute.id)
    branding = db.query(InstituteBranding).filter(InstituteBranding.institute_id == institute.id).first()
    return {
        "id": institute.id,
        "name": institute.name,
        "slug": institute.slug,
        "contact_email": institute.contact_email,
        "logo_url": f"/storage/{branding.logo_path}" if branding and branding.logo_path else None,
        "admin_permissions": normalized_admin_permissions(institute.admin_permissions),
        "session_duration_hours": institute.session_duration_hours,
        "is_active": institute.is_active,
        "onboarding_status": institute.onboarding_status,
        "subscription_state": sub_state,
        "created_at": institute.created_at,
    }


def list_institutes(db: Session) -> List[dict]:
    institutes = (
        db.query(Institute)
        .filter(Institute.onboarding_status == "published")
        .order_by(Institute.name)
        .all()
    )
    return [_serialize(db, i) for i in institutes]


def get_institute(db: Session, institute_id: int) -> dict:
    return _serialize(db, get_institute_or_404(db, institute_id))


def create_institute(
    db: Session,
    actor: User,
    name: str,
    contact_email: Optional[str],
    admin_email: str,
    admin_first_name: str,
    admin_last_name: str,
    admin_permissions: dict,
    session_duration_hours: int,
    ip: Optional[str],
    active: bool = True,
    onboarding_status: str = "published",
) -> dict:
    if db.query(User).filter(User.email == admin_email).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Admin email already in use")

    role = db.query(Role).filter(Role.name == INSTITUTE_ADMIN).first()
    if role is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="INSTITUTE_ADMIN role not seeded")

    institute = Institute(
        name=name,
        slug=_unique_slug(db, name),
        contact_email=contact_email,
        admin_permissions=normalized_admin_permissions(admin_permissions),
        session_duration_hours=session_duration_hours,
        is_active=active,
        onboarding_status=onboarding_status,
    )
    db.add(institute)
    db.flush()

    temp_password = secrets.token_urlsafe(9)  # e.g. "kZ3f9QpN2xT" - meets strength rules below
    admin = User(
        email=admin_email,
        password_hash=hash_password(temp_password),
        role_id=role.id,
        institute_id=institute.id,
        first_name=admin_first_name,
        last_name=admin_last_name,
        is_active=active,
        force_password_reset=True,
    )
    db.add(admin)
    db.flush()

    db.add(InstituteBranding(institute_id=institute.id))

    _audit(db, actor, "institute.create", institute.id, ip, {"name": name, "admin_email": admin_email})
    db.commit()
    db.refresh(institute)

    result = _serialize(db, institute)
    result["admin_temp_password"] = temp_password
    result["admin_email"] = admin_email
    return result


def update_institute(
    db: Session,
    actor: User,
    institute_id: int,
    name: Optional[str],
    contact_email: Optional[str],
    admin_permissions: Optional[dict],
    session_duration_hours: Optional[int],
    ip: Optional[str],
) -> dict:
    institute = get_institute_or_404(db, institute_id)
    if name is not None and name != institute.name:
        institute.name = name
        institute.slug = _unique_slug(db, name, exclude_id=institute.id)
    if contact_email is not None:
        institute.contact_email = contact_email
    if admin_permissions is not None:
        institute.admin_permissions = normalized_admin_permissions(admin_permissions)
    if session_duration_hours is not None:
        institute.session_duration_hours = session_duration_hours

    db.add(institute)
    _audit(db, actor, "institute.update", institute.id, ip)
    db.commit()
    db.refresh(institute)
    return _serialize(db, institute)


def set_institute_active(db: Session, actor: User, institute_id: int, active: bool, ip: Optional[str]) -> dict:
    institute = get_institute_or_404(db, institute_id)
    institute.is_active = active
    db.add(institute)
    _audit(db, actor, "institute.suspend" if not active else "institute.reactivate", institute.id, ip)
    db.commit()
    db.refresh(institute)
    return _serialize(db, institute)


def delete_institute(db: Session, actor: User, institute_id: int, ip: Optional[str]) -> None:
    """Permanently remove tenant data while retaining detached financial history."""
    institute = get_institute_or_404(db, institute_id)
    tables = Base.metadata.tables
    user_ids = list(
        db.execute(select(tables["users"].c.id).where(tables["users"].c.institute_id == institute_id)).scalars()
    )
    attempt_ids = (
        list(
            db.execute(
                select(tables["test_attempts"].c.id).where(
                    tables["test_attempts"].c.user_id.in_(user_ids)
                )
            ).scalars()
        )
        if user_ids
        else []
    )
    announcement_filter = tables["announcements"].c.institute_id == institute_id
    if user_ids:
        announcement_filter = or_(
            announcement_filter,
            tables["announcements"].c.created_by_id.in_(user_ids),
        )
    announcement_ids = list(
        db.execute(
            select(tables["announcements"].c.id).where(announcement_filter)
        ).scalars()
    )
    institute_course_ids = list(
        db.execute(
            select(tables["institute_courses"].c.id).where(
                tables["institute_courses"].c.institute_id == institute_id
            )
        ).scalars()
    )

    storage_paths = _institute_storage_paths(
        db, tables, institute_id, user_ids, attempt_ids
    )
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    _audit(
        db,
        actor,
        "institute.delete",
        institute.id,
        ip,
        {
            "name": institute.name,
            "slug": institute.slug,
            "financial_records_retained": True,
        },
    )
    db.flush()

    # Financial and contract rows are immutable history. Detach their live
    # foreign keys and retain the deleted institute identity as a snapshot.
    payment_scope = tables["payments"].c.institute_id == institute_id
    subscription_scope = tables["subscriptions"].c.institute_id == institute_id
    if user_ids:
        payment_scope = or_(payment_scope, tables["payments"].c.user_id.in_(user_ids))
        subscription_scope = or_(
            subscription_scope, tables["subscriptions"].c.user_id.in_(user_ids)
        )
    db.execute(
        update(tables["payments"])
        .where(payment_scope)
        .values(
            institute_id=None,
            institute_id_snapshot=institute.id,
            institute_name_snapshot=institute.name,
            institute_slug_snapshot=institute.slug,
            user_id=None,
        )
    )
    db.execute(
        update(tables["subscriptions"])
        .where(subscription_scope)
        .values(
            institute_id=None,
            institute_id_snapshot=institute.id,
            institute_name_snapshot=institute.name,
            institute_slug_snapshot=institute.slug,
            user_id=None,
            cancelled_at=now,
        )
    )

    if user_ids:
        _delete_user_operational_data(
            db,
            tables,
            user_ids,
            attempt_ids,
            announcement_ids,
            institute_course_ids,
            actor.id,
        )

    for table_name in (
        "ai_eval_limits",
        "leaderboard_snapshots",
        "institute_modules",
        "institute_courses",
        "settings",
        "demo_accounts",
        "institute_branding",
    ):
        table = tables[table_name]
        db.execute(delete(table).where(table.c.institute_id == institute_id))

    _remove_deleted_announcement_targets(
        db, tables["announcements"], institute_id, user_ids
    )
    db.execute(delete(tables["announcements"]).where(announcement_filter))
    db.execute(delete(tables["users"]).where(tables["users"].c.institute_id == institute_id))
    db.execute(delete(tables["institutes"]).where(tables["institutes"].c.id == institute_id))
    db.commit()

    _delete_storage_files(storage_paths)


def _institute_storage_paths(
    db: Session,
    tables,
    institute_id: int,
    user_ids: list[int],
    attempt_ids: list[int],
) -> list[str]:
    paths: list[str] = []
    paths.extend(
        path
        for path in db.execute(
            select(tables["institute_branding"].c.logo_path).where(
                tables["institute_branding"].c.institute_id == institute_id
            )
        ).scalars()
        if path
    )
    if user_ids:
        paths.extend(
            path
            for path in db.execute(
                select(tables["users"].c.avatar_path).where(
                    tables["users"].c.id.in_(user_ids)
                )
            ).scalars()
            if path
        )
    if attempt_ids:
        paths.extend(
            path
            for path in db.execute(
                select(tables["attempt_answers"].c.audio_path).where(
                    tables["attempt_answers"].c.attempt_id.in_(attempt_ids)
                )
            ).scalars()
            if path
        )
    return paths


def _delete_user_operational_data(
    db: Session,
    tables,
    user_ids: list[int],
    attempt_ids: list[int],
    announcement_ids: list[int],
    institute_course_ids: list[int],
    replacement_user_id: int,
) -> None:
    notifications_filter = tables["student_notifications"].c.user_id.in_(user_ids)
    if attempt_ids:
        notifications_filter = or_(
            notifications_filter,
            tables["student_notifications"].c.attempt_id.in_(attempt_ids),
        )
    if announcement_ids:
        notifications_filter = or_(
            notifications_filter,
            tables["student_notifications"].c.announcement_id.in_(announcement_ids),
        )
    db.execute(delete(tables["student_notifications"]).where(notifications_filter))

    if attempt_ids:
        for table_name in (
            "ai_evaluations",
            "grading_queue",
            "reevaluation_requests",
            "student_badges",
            "attempt_answers",
            "attempt_part_grades",
            "attempt_flags",
        ):
            table = tables[table_name]
            db.execute(delete(table).where(table.c.attempt_id.in_(attempt_ids)))
        db.execute(delete(tables["test_attempts"]).where(tables["test_attempts"].c.id.in_(attempt_ids)))

    enrollment_filter = tables["enrollments"].c.user_id.in_(user_ids)
    if institute_course_ids:
        enrollment_filter = or_(
            enrollment_filter,
            tables["enrollments"].c.institute_course_id.in_(institute_course_ids),
        )
    db.execute(delete(tables["enrollments"]).where(enrollment_filter))
    db.execute(delete(tables["student_badges"]).where(tables["student_badges"].c.user_id.in_(user_ids)))
    db.execute(delete(tables["leaderboard_snapshots"]).where(tables["leaderboard_snapshots"].c.user_id.in_(user_ids)))
    db.execute(delete(tables["instructor_profiles"]).where(tables["instructor_profiles"].c.user_id.in_(user_ids)))
    db.execute(delete(tables["user_devices"]).where(tables["user_devices"].c.user_id.in_(user_ids)))
    db.execute(delete(tables["user_sessions"]).where(tables["user_sessions"].c.user_id.in_(user_ids)))

    # Retained platform content must not keep a foreign key to a deleted user.
    for table_name, column_name in (
        ("courses", "created_by_id"),
        ("course_assets", "uploaded_by_id"),
        ("question_banks", "created_by_id"),
        ("questions", "created_by_id"),
        ("assessments", "created_by_id"),
        ("exam_modules", "created_by_id"),
        ("exam_module_assets", "uploaded_by_id"),
        ("exam_module_questions", "created_by_id"),
    ):
        table = tables[table_name]
        db.execute(
            update(table)
            .where(table.c[column_name].in_(user_ids))
            .values({column_name: replacement_user_id})
        )

    for table_name, column_name in (
        ("attempt_part_grades", "grader_id"),
        ("grading_queue", "assigned_to_id"),
        ("reevaluation_requests", "assigned_to_id"),
        ("api_logs", "user_id"),
        ("audit_logs", "user_id"),
        ("error_logs", "user_id"),
    ):
        table = tables[table_name]
        db.execute(
            update(table)
            .where(table.c[column_name].in_(user_ids))
            .values({column_name: None})
        )


def _remove_deleted_announcement_targets(
    db: Session,
    announcements,
    institute_id: int,
    user_ids: list[int],
) -> None:
    rows = db.execute(
        select(
            announcements.c.id,
            announcements.c.target_institute_ids,
            announcements.c.target_user_ids,
        ).where(announcements.c.institute_id.is_(None))
    ).all()
    deleted_users = set(user_ids)
    for row in rows:
        institute_targets = _without_json_ids(row.target_institute_ids, {institute_id})
        user_targets = _without_json_ids(row.target_user_ids, deleted_users)
        if (
            institute_targets != row.target_institute_ids
            or user_targets != row.target_user_ids
        ):
            db.execute(
                update(announcements)
                .where(announcements.c.id == row.id)
                .values(
                    target_institute_ids=institute_targets,
                    target_user_ids=user_targets,
                )
            )


def _without_json_ids(value: Optional[str], removed: set[int]) -> Optional[str]:
    if not value or not removed:
        return value
    try:
        ids = [int(item) for item in json.loads(value)]
    except (TypeError, ValueError, json.JSONDecodeError):
        return value
    remaining = [item for item in ids if item not in removed]
    return json.dumps(remaining) if remaining else None


def _delete_storage_files(relative_paths: list[str]) -> None:
    root = settings.storage_path.resolve()
    for relative_path in set(relative_paths):
        candidate = (root / relative_path).resolve()
        if candidate != root and root in candidate.parents:
            try:
                candidate.unlink(missing_ok=True)
            except OSError:
                logger.warning(
                    "Could not remove deleted institute file %s",
                    candidate,
                    exc_info=True,
                )


def _get_or_create_branding(db: Session, institute_id: int) -> InstituteBranding:
    branding = db.query(InstituteBranding).filter(InstituteBranding.institute_id == institute_id).first()
    if branding is None:
        branding = InstituteBranding(institute_id=institute_id)
        db.add(branding)
        db.commit()
        db.refresh(branding)
    return branding


def _serialize_branding(branding: InstituteBranding, institute_name: str) -> dict:
    return {
        "institute_id": branding.institute_id,
        "institute_name": institute_name,
        "logo_url": f"/storage/{branding.logo_path}" if branding.logo_path else None,
        "primary_color": branding.primary_color,
        "secondary_color": branding.secondary_color,
        "font_family": branding.font_family,
        "heading_font_weight": branding.heading_font_weight,
        "body_font_weight": branding.body_font_weight,
    }


def get_branding(db: Session, institute_id: int) -> dict:
    institute = get_institute_or_404(db, institute_id)
    return _serialize_branding(_get_or_create_branding(db, institute_id), institute.name)


_HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def update_branding(
    db: Session,
    actor: User,
    institute_id: int,
    primary_color: Optional[str],
    secondary_color: Optional[str],
    ip: Optional[str],
    font_family: Optional[str] = None,
    heading_font_weight: Optional[int] = None,
    body_font_weight: Optional[int] = None,
) -> dict:
    institute = get_institute_or_404(db, institute_id)
    branding = _get_or_create_branding(db, institute_id)

    for label, value in (("primary_color", primary_color), ("secondary_color", secondary_color)):
        if value is not None:
            if not _HEX_COLOR_RE.match(value):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{label} must be a hex color like #4f46e5")
            setattr(branding, label, value)

    if font_family is not None:
        if font_family not in ALLOWED_FONT_FAMILIES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported font family")
        branding.font_family = font_family
    for label, value in (
        ("heading_font_weight", heading_font_weight),
        ("body_font_weight", body_font_weight),
    ):
        if value is not None:
            if value not in ALLOWED_FONT_WEIGHTS:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported {label}")
            setattr(branding, label, value)

    db.add(branding)
    _audit(db, actor, "institute.update_branding", institute_id, ip)
    db.commit()
    db.refresh(branding)
    return _serialize_branding(branding, institute.name)


async def save_logo(db: Session, actor: User, institute_id: int, upload: UploadFile, ip: Optional[str]) -> dict:
    institute = get_institute_or_404(db, institute_id)
    ext, content = await read_validated_image(upload, MAX_LOGO_BYTES, "Logo")

    logos_dir = settings.storage_path / "institute_logos"
    logos_dir.mkdir(parents=True, exist_ok=True)

    branding = _get_or_create_branding(db, institute_id)
    if branding.logo_path:
        old = settings.storage_path / branding.logo_path
        if old.is_file():
            old.unlink()

    relative_path = f"institute_logos/institute_{institute_id}{ext}"
    (settings.storage_path / relative_path).write_bytes(content)

    branding.logo_path = relative_path
    db.add(branding)
    _audit(db, actor, "institute.update_logo", institute_id, ip)
    db.commit()
    db.refresh(branding)
    return _serialize_branding(branding, institute.name)


def get_public_branding(db: Session, slug: str) -> dict:
    institute = db.query(Institute).filter(Institute.slug == slug).first()
    if institute is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institute not found")
    branding = _get_or_create_branding(db, institute.id)
    return _serialize_branding(branding, institute.name)
