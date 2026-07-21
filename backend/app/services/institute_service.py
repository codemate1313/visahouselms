import re
import secrets
from typing import List, Optional

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import hash_password
from app.core.uploads import read_validated_image
from app.models.audit_log import AuditLog
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
DEFAULT_ADMIN_PERMISSIONS = {
    "view_students": False,
    "manage_students": False,
    "view_student_activity": False,
    "manage_student_sessions": False,
    "manage_staff": False,
    "view_billing": False,
}


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
    return {
        "id": institute.id,
        "name": institute.name,
        "slug": institute.slug,
        "contact_email": institute.contact_email,
        "admin_permissions": normalized_admin_permissions(institute.admin_permissions),
        "is_active": institute.is_active,
        "subscription_state": sub_state,
        "created_at": institute.created_at,
    }


def list_institutes(db: Session) -> List[dict]:
    institutes = db.query(Institute).order_by(Institute.name).all()
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
    ip: Optional[str],
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
        is_active=True,
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
        is_active=True,
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
    """Guarded like Plans (subscriptions) and Coupons (payments): an institute
    with any subscription or payment history can only be suspended, never
    hard-deleted, to protect revenue/audit history. A fresh institute with no
    history deletes cleanly, cascading its branding/demo/user rows."""
    institute = get_institute_or_404(db, institute_id)

    has_subscriptions = db.query(Subscription).filter(Subscription.institute_id == institute_id).count() > 0
    has_payments = db.query(Payment).filter(Payment.institute_id == institute_id).count() > 0
    if has_subscriptions or has_payments:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This institute has subscription or payment history and cannot be deleted - suspend it instead",
        )

    _audit(db, actor, "institute.delete", institute.id, ip, {"name": institute.name})

    user_ids = [uid for (uid,) in db.query(User.id).filter(User.institute_id == institute_id).all()]
    if user_ids:
        # api_logs/audit_logs/user_sessions all FK to users.id (ON DELETE has
        # no cascade/set-null) - logs are historical records, so detach them
        # (keep the row, null the actor) rather than deleting log history;
        # sessions are just live refresh tokens, safe to drop outright
        from app.models.api_log import ApiLog

        db.query(ApiLog).filter(ApiLog.user_id.in_(user_ids)).update({"user_id": None}, synchronize_session=False)
        db.query(AuditLog).filter(AuditLog.user_id.in_(user_ids)).update({"user_id": None}, synchronize_session=False)
        db.query(UserSession).filter(UserSession.user_id.in_(user_ids)).delete(synchronize_session=False)

    db.query(InstituteBranding).filter(InstituteBranding.institute_id == institute_id).delete()
    db.query(DemoAccount).filter(DemoAccount.institute_id == institute_id).delete()
    db.query(User).filter(User.institute_id == institute_id).delete()
    db.delete(institute)
    db.commit()


def _get_or_create_branding(db: Session, institute_id: int) -> InstituteBranding:
    branding = db.query(InstituteBranding).filter(InstituteBranding.institute_id == institute_id).first()
    if branding is None:
        branding = InstituteBranding(institute_id=institute_id)
        db.add(branding)
        db.commit()
        db.refresh(branding)
    return branding


def _serialize_branding(branding: InstituteBranding) -> dict:
    return {
        "institute_id": branding.institute_id,
        "logo_url": f"/storage/{branding.logo_path}" if branding.logo_path else None,
        "primary_color": branding.primary_color,
        "secondary_color": branding.secondary_color,
    }


def get_branding(db: Session, institute_id: int) -> dict:
    get_institute_or_404(db, institute_id)
    return _serialize_branding(_get_or_create_branding(db, institute_id))


_HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def update_branding(
    db: Session, actor: User, institute_id: int, primary_color: Optional[str], secondary_color: Optional[str], ip: Optional[str]
) -> dict:
    get_institute_or_404(db, institute_id)
    branding = _get_or_create_branding(db, institute_id)

    for label, value in (("primary_color", primary_color), ("secondary_color", secondary_color)):
        if value is not None:
            if not _HEX_COLOR_RE.match(value):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{label} must be a hex color like #4f46e5")
            setattr(branding, label, value)

    db.add(branding)
    _audit(db, actor, "institute.update_branding", institute_id, ip)
    db.commit()
    db.refresh(branding)
    return _serialize_branding(branding)


async def save_logo(db: Session, actor: User, institute_id: int, upload: UploadFile, ip: Optional[str]) -> dict:
    get_institute_or_404(db, institute_id)
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
    return _serialize_branding(branding)


def get_public_branding(db: Session, slug: str) -> dict:
    institute = db.query(Institute).filter(Institute.slug == slug).first()
    if institute is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institute not found")
    branding = _get_or_create_branding(db, institute.id)
    data = _serialize_branding(branding)
    data["institute_name"] = institute.name
    return data
