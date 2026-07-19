from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    institute_id: Mapped[int] = mapped_column(ForeignKey("institutes.id"), nullable=False, index=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id"), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    # copied from the plan at assign time so later plan edits don't
    # retroactively change existing subscriptions
    grace_days: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    plan: Mapped["Plan"] = relationship()  # noqa: F821
