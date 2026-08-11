from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ContactSettings(Base):
    """Singleton row backing the public /contact page's info cards."""

    __tablename__ = "contact_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), default="enquiry.langugaecert@gmail.com")
    email_note: Mapped[Optional[str]] = mapped_column(String(255), default="Replies within 1 working day")
    phone: Mapped[str] = mapped_column(String(50), default="+91 9779047164")
    phone_note: Mapped[Optional[str]] = mapped_column(String(255), default="Mon-Fri · 9am to 5pm IST")
    support_url: Mapped[str] = mapped_column(String(255), default="support.visahouse.com (to be created)")
    support_note: Mapped[Optional[str]] = mapped_column(String(255), default="Existing partners only")
    office_name: Mapped[str] = mapped_column(String(255), default="Visa House Immigration")
    office_address: Mapped[str] = mapped_column(
        Text, default="Gali lakeer Sahib wali, Amritsar bypass Road\nTarntaran, 143401"
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class SocialLink(Base):
    """One row per social icon shown in the public site footer."""

    __tablename__ = "social_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
