from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class DemoAccount(Base):
    """A demo account IS an institute + first admin (created via
    institute_service.create_institute), flagged with its own expiry and
    demo-specific content limits independent of the real subscription system."""

    __tablename__ = "demo_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    institute_id: Mapped[int] = mapped_column(ForeignKey("institutes.id"), unique=True, nullable=False)
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)
    course_limit: Mapped[int] = mapped_column(Integer, nullable=False)
    test_limit: Mapped[int] = mapped_column(Integer, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    converted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    institute: Mapped["Institute"] = relationship()  # noqa: F821
