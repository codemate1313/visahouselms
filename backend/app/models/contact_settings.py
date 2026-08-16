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
    phone_note: Mapped[Optional[str]] = mapped_column(String(255), default="Mon–Fri · 9am to 5pm IST")
    support_url: Mapped[str] = mapped_column(String(255), default="support.visahouse.com (to be created)")
    support_note: Mapped[Optional[str]] = mapped_column(String(255), default="Existing partners only")
    office_name: Mapped[str] = mapped_column(String(255), default="Visa House Immigration")
    office_address: Mapped[str] = mapped_column(
        Text, default="Gali lakeer Sahib wali, Amritsar bypass Road\nTarntaran, 143401"
    )

    # Head Office (Amritsar)
    head_office_name: Mapped[Optional[str]] = mapped_column(
        String(255), default="Amritsar Office (Head Office)"
    )
    head_office_address: Mapped[Optional[str]] = mapped_column(
        String(1000), default="Mezzanine floor, Sco-21, B-Block, Ranjit Avenue, Amritsar, Punjab 143001"
    )
    head_office_map_link: Mapped[Optional[str]] = mapped_column(
        String(1000), default="https://www.google.com/maps/place/VISA+HOUSE+immigration/@31.65075,74.8629167,17z"
    )
    head_office_map_embed: Mapped[Optional[str]] = mapped_column(
        String(2000),
        default="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3692.6816320116436!2d74.8629167!3d31.65075!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3919650028ff0af9%3A0x7c60b7408534d94d!2sVISA%20HOUSE%20immigration!5e0!3m2!1sen!2sin!4v1786779632431!5m2!1sen!2sin",
    )

    # Branch Office (Tarn Taran)
    branch_office_name: Mapped[Optional[str]] = mapped_column(
        String(255), default="Tarn Taran Office (Branch Office)"
    )
    branch_office_address: Mapped[Optional[str]] = mapped_column(
        String(1000), default="Gali Lakeer Sahib Wali, Amritsar Bypass Road, Tarn Taran, Punjab 143401"
    )
    branch_office_map_link: Mapped[Optional[str]] = mapped_column(
        String(1000), default="https://maps.app.goo.gl/9DfwXmJcfyzQnwC67"
    )
    branch_office_map_embed: Mapped[Optional[str]] = mapped_column(
        String(2000),
        default="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3403.475908208477!2d74.9170435!3d31.4638482!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39197f991e05cd0f%3A0x64c8d99f3ec4c656!2sVisa%20House!5e0!3m2!1sen!2sin!4v1786779800000!5m2!1sen!2sin",
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
