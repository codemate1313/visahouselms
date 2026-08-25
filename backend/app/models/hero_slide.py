from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

HOME_LOCATION = "home"
LOGIN_LOCATION = "login"
HERO_LOCATIONS = (HOME_LOCATION, LOGIN_LOCATION)


class HeroSlide(Base):
    """One slide of a hero carousel.

    Backs both carousels the platform shows to logged-out visitors: the public
    home page hero (which also carries a highlight, two CTAs and stat chips) and
    the login/register side panel (image plus badge, title and subtitle). They
    share a table so Super Admin edits both from one screen; the home-only
    columns stay null for login slides.
    """

    __tablename__ = "hero_slides"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    location: Mapped[str] = mapped_column(String(20), nullable=False, index=True, default=HOME_LOCATION)

    badge: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    highlight: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    subtitle: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_url: Mapped[str] = mapped_column(String(1000), nullable=False)

    cta_text: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    cta_link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    alt_text: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    alt_link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    #: list of {"value": str, "label": str} chips shown under the home hero copy
    stats: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=list)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=func.now(), nullable=True)
