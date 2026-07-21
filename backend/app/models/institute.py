from datetime import datetime
from typing import Optional

from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Integer, JSON, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Institute(Base):
    """Phase 2 owns CRUD/branding for this table. Schema-only stub for now so
    users.institute_id has a valid target and Phase 2 needs no retrofit migration."""

    __tablename__ = "institutes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    admin_permissions: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    onboarding_status: Mapped[str] = mapped_column(String(20), nullable=False, default="published", index=True)
    agreement_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    agreement_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    agreed_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    agreement_currency: Mapped[str] = mapped_column(String(8), nullable=False, default="INR")
    student_limit: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    staff_limit: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    test_limit: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    access_duration_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    session_duration_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=24)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=func.now())
