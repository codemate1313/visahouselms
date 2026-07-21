from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Badge(Base):
    __tablename__ = "badges"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    icon: Mapped[str] = mapped_column(String(40), nullable=False)
    criteria: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class StudentBadge(Base):
    __tablename__ = "student_badges"
    __table_args__ = (UniqueConstraint("user_id", "badge_id", name="uq_student_badge"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    badge_id: Mapped[int] = mapped_column(ForeignKey("badges.id", ondelete="CASCADE"), nullable=False, index=True)
    attempt_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("test_attempts.id", ondelete="SET NULL"), nullable=True
    )
    awarded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship()  # noqa: F821
    badge: Mapped[Badge] = relationship()
    attempt: Mapped[Optional["TestAttempt"]] = relationship()  # noqa: F821


class LeaderboardSnapshot(Base):
    __tablename__ = "leaderboard_snapshots"
    __table_args__ = (
        UniqueConstraint("institute_id", "period_key", "user_id", name="uq_leaderboard_student_period"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    institute_id: Mapped[int] = mapped_column(
        ForeignKey("institutes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    period_key: Mapped[str] = mapped_column(String(30), nullable=False, default="all_time", index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    attempts_count: Mapped[int] = mapped_column(Integer, nullable=False)
    average_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    best_cefr_level: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    user: Mapped["User"] = relationship()  # noqa: F821
