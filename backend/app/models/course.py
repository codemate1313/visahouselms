from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


COURSE_DRAFT = "draft"
COURSE_PUBLISHED = "published"
COURSE_ARCHIVED = "archived"
COURSE_STATUSES = (COURSE_DRAFT, COURSE_PUBLISHED, COURSE_ARCHIVED)

ASSET_PDF = "pdf"
ASSET_AUDIO = "audio"
ASSET_TYPES = (ASSET_PDF, ASSET_AUDIO)


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(220), unique=True, nullable=False, index=True)
    summary: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    level: Mapped[str] = mapped_column(String(30), nullable=False, default="all_levels")
    estimated_duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="INR")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=COURSE_DRAFT, index=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=func.now())

    created_by: Mapped["User"] = relationship()  # noqa: F821
    assets: Mapped[List["CourseAsset"]] = relationship(
        back_populates="course", cascade="all, delete-orphan", order_by="CourseAsset.sort_order"
    )
    institute_assignments: Mapped[List["InstituteCourse"]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )
    question_banks: Mapped[List["QuestionBank"]] = relationship(  # noqa: F821
        back_populates="course", cascade="all, delete-orphan"
    )
    assessments: Mapped[List["Assessment"]] = relationship(  # noqa: F821
        back_populates="course", cascade="all, delete-orphan"
    )


class CourseAsset(Base):
    __tablename__ = "course_assets"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    asset_type: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    course: Mapped[Course] = relationship(back_populates="assets")
    uploaded_by: Mapped["User"] = relationship()  # noqa: F821


class InstituteCourse(Base):
    __tablename__ = "institute_courses"
    __table_args__ = (UniqueConstraint("institute_id", "course_id", name="uq_institute_course"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    institute_id: Mapped[int] = mapped_column(
        ForeignKey("institutes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assigned_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=func.now())

    institute: Mapped["Institute"] = relationship()  # noqa: F821
    course: Mapped[Course] = relationship(back_populates="institute_assignments")
    assigned_by: Mapped["User"] = relationship()  # noqa: F821
