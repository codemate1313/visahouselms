from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TrialConfig(Base):
    """Single-row singleton (like a settings table) governing the direct-student
    (B2C) trial: how long it lasts and which courses are offered. There is no
    separate cap on the number of tests: a module can only be sat once, so the
    demo course list already decides how many tests a trial student gets.
    The state machine is in trial_service.py."""

    __tablename__ = "trial_configs"

    id: Mapped[int] = mapped_column(primary_key=True)
    trial_duration_days: Mapped[int] = mapped_column(Integer, nullable=False, default=14)
    course_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=func.now())
