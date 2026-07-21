from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    # exactly one of institute_id/user_id is set (B2B institute subscription
    # vs a direct/B2C student's personal subscription) - enforced at the
    # application layer in subscription_service, not a DB constraint.
    institute_id: Mapped[Optional[int]] = mapped_column(ForeignKey("institutes.id"), nullable=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id"), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    # copied from the plan at assign time so later plan edits don't
    # retroactively change existing subscriptions
    grace_days: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    plan: Mapped["Plan"] = relationship()  # noqa: F821
    user: Mapped[Optional["User"]] = relationship()  # noqa: F821
