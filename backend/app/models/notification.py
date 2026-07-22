from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


GRADE_RELEASED = "grade_released"


class StudentNotification(Base):
    __tablename__ = "student_notifications"
    __table_args__ = (
        UniqueConstraint("attempt_id", "kind", name="uq_student_notification_attempt_kind"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    attempt_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("test_attempts.id", ondelete="CASCADE"), nullable=True, index=True
    )
    kind: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    user: Mapped["User"] = relationship()  # noqa: F821
    attempt: Mapped[Optional["TestAttempt"]] = relationship()  # noqa: F821
