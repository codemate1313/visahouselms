from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


GRADE_RELEASED = "grade_released"
ANNOUNCEMENT_PUBLISHED = "announcement_published"
SUPPORT_TICKET_CREATED = "support_ticket_created"
SUPPORT_TICKET_UPDATED = "support_ticket_updated"
AI_QUOTA_EXHAUSTED = "ai_quota_exhausted"
AI_EVALUATION_FAILED = "ai_evaluation_failed"
GRADING_QUEUE_ROUTED = "grading_queue_routed"
GRADING_CLAIMED = "grading_claimed"
GRADING_RELEASED = "grading_released"
REEVALUATION_REQUESTED = "reevaluation_requested"
REEVALUATION_CLAIMED = "reevaluation_claimed"
REEVALUATION_RESOLVED = "reevaluation_resolved"
RETAKE_REQUESTED = "retake_requested"
RETAKE_RESOLVED = "retake_resolved"
SYSTEM_JOB_FAILED = "system_job_failed"
SYSTEM_SECURITY_EVENT = "system_security_event"
SUPPORT_TICKET_ASSIGNED = "support_ticket_assigned"


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(primary_key=True)
    institute_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("institutes.id", ondelete="CASCADE"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    audience: Mapped[str] = mapped_column(String(100), nullable=False, default="students")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft", index=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    target_institute_ids: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    target_user_ids: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())


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
    announcement_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("announcements.id", ondelete="SET NULL"), nullable=True, index=True
    )
    link_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    kind: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    pinned_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

    user: Mapped["User"] = relationship()  # noqa: F821
    attempt: Mapped[Optional["TestAttempt"]] = relationship()  # noqa: F821
    announcement: Mapped[Optional["Announcement"]] = relationship()  # noqa: F821
