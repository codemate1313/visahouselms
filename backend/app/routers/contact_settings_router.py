from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_super_admin_or_verified_developer
from app.models.audit_log import AuditLog
from app.models.contact_settings import ContactSettings, SocialLink
from app.models.user import User
from app.schemas.contact_settings import (
    SOCIAL_PLATFORMS,
    ContactInfoUpdate,
    ContactSettingsAdmin,
    ContactSettingsPublic,
    SocialLinkCreate,
    SocialLinkUpdate,
)

public_router = APIRouter(prefix="/contact-settings", tags=["contact-settings"])
admin_router = APIRouter(
    prefix="/super-admin/contact-settings",
    tags=["admin-contact-settings"],
    dependencies=[Depends(require_super_admin_or_verified_developer)],
)

DEFAULT_CONTACT_INFO = {
    "email": "enquiry.langugaecert@gmail.com",
    "email_note": "Replies within 1 working day",
    "phone": "+91 9779047164",
    "phone_note": "Mon-Fri · 9am to 5pm IST",
    "support_url": "support.visahouse.com (to be created)",
    "support_note": "Existing partners only",
    "office_name": "Visa House Immigration",
    "office_address": "Gali lakeer Sahib wali, Amritsar bypass Road\nTarntaran, 143401",
}


def _default_contact_response() -> dict:
    return {"id": 0, "updated_at": None, **DEFAULT_CONTACT_INFO}


def _get_contact_info(db: Session) -> Optional[ContactSettings]:
    return db.scalar(select(ContactSettings).limit(1))


def _get_or_create_contact_info(db: Session) -> ContactSettings:
    info = _get_contact_info(db)
    if not info:
        info = ContactSettings()
        db.add(info)
        db.commit()
        db.refresh(info)
    return info


def _get_social_link_or_404(db: Session, link_id: int) -> SocialLink:
    link = db.get(SocialLink, link_id)
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Social link not found")
    return link


def _validate_platform(platform: str) -> None:
    if platform not in SOCIAL_PLATFORMS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Platform must be one of: {', '.join(SOCIAL_PLATFORMS)}",
        )


def _audit(db: Session, actor: User, action: str, request: Request, entity_id=None, details=None) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            action=action,
            entity_type="contact_settings",
            entity_id=entity_id,
            details=details,
            ip_address=request.client.host if request.client else None,
        )
    )
    db.commit()


@public_router.get("", response_model=ContactSettingsPublic)
def get_public_contact_settings(db: Session = Depends(get_db)):
    contact = _get_contact_info(db) or _default_contact_response()
    links = db.scalars(
        select(SocialLink).where(SocialLink.is_enabled.is_(True)).order_by(SocialLink.id)
    ).all()
    return {"contact": contact, "social_links": links}


@admin_router.get("", response_model=ContactSettingsAdmin)
def get_admin_contact_settings(db: Session = Depends(get_db)):
    contact = _get_or_create_contact_info(db)
    links = db.scalars(select(SocialLink).order_by(SocialLink.id)).all()
    return {"contact": contact, "social_links": links}


@admin_router.put("/contact", response_model=ContactSettingsAdmin)
def update_contact_info(
    payload: ContactInfoUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    contact = _get_or_create_contact_info(db)
    update_data = payload.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(contact, key, val)
    db.commit()
    db.refresh(contact)
    _audit(db, actor, "contact_settings.update", request, entity_id=contact.id, details=update_data)
    links = db.scalars(select(SocialLink).order_by(SocialLink.id)).all()
    return {"contact": contact, "social_links": links}


@admin_router.post("/social-links", status_code=status.HTTP_201_CREATED, response_model=ContactSettingsAdmin)
def create_social_link(
    payload: SocialLinkCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    _validate_platform(payload.platform)
    link = SocialLink(platform=payload.platform, url=payload.url, is_enabled=payload.is_enabled)
    db.add(link)
    db.commit()
    db.refresh(link)
    _audit(
        db, actor, "social_link.create", request, entity_id=link.id,
        details={"platform": link.platform, "url": link.url},
    )
    contact = _get_or_create_contact_info(db)
    links = db.scalars(select(SocialLink).order_by(SocialLink.id)).all()
    return {"contact": contact, "social_links": links}


@admin_router.patch("/social-links/{link_id}", response_model=ContactSettingsAdmin)
def update_social_link(
    link_id: int,
    payload: SocialLinkUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    link = _get_social_link_or_404(db, link_id)
    update_data = payload.model_dump(exclude_unset=True)
    if "platform" in update_data:
        _validate_platform(update_data["platform"])
    for key, val in update_data.items():
        setattr(link, key, val)
    db.commit()
    _audit(db, actor, "social_link.update", request, entity_id=link.id, details=update_data)
    contact = _get_or_create_contact_info(db)
    links = db.scalars(select(SocialLink).order_by(SocialLink.id)).all()
    return {"contact": contact, "social_links": links}


@admin_router.delete("/social-links/{link_id}", response_model=ContactSettingsAdmin)
def delete_social_link(
    link_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    link = _get_social_link_or_404(db, link_id)
    _audit(
        db, actor, "social_link.delete", request, entity_id=link.id,
        details={"platform": link.platform, "url": link.url},
    )
    db.delete(link)
    db.commit()
    contact = _get_or_create_contact_info(db)
    links = db.scalars(select(SocialLink).order_by(SocialLink.id)).all()
    return {"contact": contact, "social_links": links}
