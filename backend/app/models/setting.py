from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Setting(Base):
    """Phase 1.2 (Developer Settings) owns CRUD/UI for this table. Schema-only
    stub for now, scoped global (institute_id NULL) or per-institute."""

    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    value: Mapped[Optional[str]] = mapped_column(Text)
    institute_id: Mapped[Optional[int]] = mapped_column(ForeignKey("institutes.id"), nullable=True)
    is_encrypted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=func.now())
