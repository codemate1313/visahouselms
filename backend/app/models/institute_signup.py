from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


STATUS_PENDING = "pending"
STATUS_APPROVED = "approved"
STATUS_REJECTED = "rejected"
SIGNUP_STATUSES = (STATUS_PENDING, STATUS_APPROVED, STATUS_REJECTED)


class InstituteSignupRequest(Base):
    """An application from the public site to run an institute on the platform.

    Deliberately not an Institute yet. Anyone can submit one of these, so it
    holds nothing but the applicant's own words until a Super Admin approves it;
    only then is a real institute and admin account created. Approved and
    rejected rows are kept rather than deleted - the queue is also the record of
    who was let in and who was turned away.
    """

    __tablename__ = "institute_signup_requests"

    id: Mapped[int] = mapped_column(primary_key=True)

    institute_name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    admin_first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    admin_last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    # The address the admin account is created against on approval, which is why
    # it is checked for collisions with existing users at submission time.
    admin_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    expected_students: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Which tier caught their eye on the pricing page. Context for the reviewer
    # only - the binding choice is made by the admin after approval.
    interested_plan_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("plans.id", ondelete="SET NULL"), nullable=True
    )

    status: Mapped[str] = mapped_column(String(20), nullable=False, default=STATUS_PENDING, index=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewed_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    # Set once approved, so the queue can link straight to what it produced.
    created_institute_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("institutes.id", ondelete="SET NULL"), nullable=True
    )

    submitted_ip: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=func.now())

    interested_plan: Mapped[Optional["Plan"]] = relationship()  # noqa: F821
    reviewed_by: Mapped[Optional["User"]] = relationship(foreign_keys=[reviewed_by_id])  # noqa: F821
    created_institute: Mapped[Optional["Institute"]] = relationship()  # noqa: F821
