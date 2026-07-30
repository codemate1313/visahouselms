from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, JSON, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class DailyEnglishChallenge(Base):
    __tablename__ = "daily_english_challenges"
    __table_args__ = (
        UniqueConstraint("user_id", "challenge_date", name="uq_daily_english_student_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    challenge_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    question_keys: Mapped[list] = mapped_column(JSON, nullable=False)
    answers: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=func.now(), nullable=True)

    user: Mapped["User"] = relationship()  # noqa: F821
