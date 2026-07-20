from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class InstructorProfile(Base):
    """Central-content profile for a Super Admin Instructor.

    Keeping authoring metadata separate from ``users`` avoids adding
    instructor-only fields to every account type and gives Phase 3.2/3.3 a
    stable owner record to reference.
    """

    __tablename__ = "instructor_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False, default="IELTS Instructor")
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    specializations: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=func.now())

    user: Mapped["User"] = relationship(back_populates="instructor_profile")  # noqa: F821
