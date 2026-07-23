from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Testimonial(Base):
    __tablename__ = "testimonials"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    student_role: Mapped[Optional[str]] = mapped_column(String(255), default="Academic IELTS Student")
    target_score: Mapped[Optional[str]] = mapped_column(String(50), default="Band 7.5+")
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    rating: Mapped[int] = mapped_column(Integer, default=5)
    quote: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=func.now(), nullable=True)
