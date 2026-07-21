from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class InstituteBranding(Base):
    __tablename__ = "institute_branding"

    id: Mapped[int] = mapped_column(primary_key=True)
    institute_id: Mapped[int] = mapped_column(ForeignKey("institutes.id"), unique=True, nullable=False)
    logo_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    primary_color: Mapped[str] = mapped_column(String(9), nullable=False, default="#4f46e5")
    secondary_color: Mapped[str] = mapped_column(String(9), nullable=False, default="#1e2130")
    font_family: Mapped[str] = mapped_column(String(50), nullable=False, default="Plus Jakarta Sans")
    heading_font_weight: Mapped[int] = mapped_column(Integer, nullable=False, default=700)
    body_font_weight: Mapped[int] = mapped_column(Integer, nullable=False, default=400)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=func.now())
