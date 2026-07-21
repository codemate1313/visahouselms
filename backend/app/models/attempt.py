from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


ENROLLMENT_SOURCES = ("b2c_purchase", "institute_assigned")

ATTEMPT_IN_PROGRESS = "in_progress"
ATTEMPT_SUBMITTED = "submitted"
ATTEMPT_GRADING = "grading"
ATTEMPT_GRADED = "graded"
ATTEMPT_EXPIRED = "expired"
ATTEMPT_STATUSES = (
    ATTEMPT_IN_PROGRESS,
    ATTEMPT_SUBMITTED,
    ATTEMPT_GRADING,
    ATTEMPT_GRADED,
    ATTEMPT_EXPIRED,
)

PART_GRADE_PENDING = "pending"
PART_GRADE_GRADED = "graded"
PART_GRADE_STATUSES = (PART_GRADE_PENDING, PART_GRADE_GRADED)

FLAG_BLUR = "blur"
FLAG_VISIBILITY_CHANGE = "visibility_change"
FLAG_FULLSCREEN_EXIT = "fullscreen_exit"
ATTEMPT_FLAG_TYPES = (FLAG_BLUR, FLAG_VISIBILITY_CHANGE, FLAG_FULLSCREEN_EXIT)


class CourseModule(Base):
    """Links a sellable Course to one or more published ExamModules."""

    __tablename__ = "course_modules"
    __table_args__ = (UniqueConstraint("course_id", "module_id", name="uq_course_module"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    module_id: Mapped[int] = mapped_column(
        ForeignKey("exam_modules.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    course: Mapped["Course"] = relationship(back_populates="course_modules")  # noqa: F821
    module: Mapped["ExamModule"] = relationship()  # noqa: F821


class Enrollment(Base):
    """Grants a User access to a Course, either via a B2C course purchase or
    because their institute assigned it (mirrors InstituteCourse for B2B)."""

    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("user_id", "course_id", name="uq_enrollment_user_course"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source: Mapped[str] = mapped_column(String(30), nullable=False)
    payment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("payments.id"), nullable=True)
    institute_course_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("institute_courses.id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    granted_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship()  # noqa: F821
    course: Mapped["Course"] = relationship(back_populates="enrollments")  # noqa: F821
    payment: Mapped[Optional["Payment"]] = relationship()  # noqa: F821


class TestAttempt(Base):
    __tablename__ = "test_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    module_id: Mapped[int] = mapped_column(
        ForeignKey("exam_modules.id"), nullable=False, index=True
    )
    course_id: Mapped[Optional[int]] = mapped_column(ForeignKey("courses.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=ATTEMPT_IN_PROGRESS, index=True)
    is_final: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    started_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    raw_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(7, 2), nullable=True)
    max_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(7, 2), nullable=True)
    band_label: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    graded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship()  # noqa: F821
    module: Mapped["ExamModule"] = relationship()  # noqa: F821
    course: Mapped[Optional["Course"]] = relationship()  # noqa: F821
    answers: Mapped[List["AttemptAnswer"]] = relationship(
        back_populates="attempt", cascade="all, delete-orphan"
    )
    part_grades: Mapped[List["AttemptPartGrade"]] = relationship(
        back_populates="attempt", cascade="all, delete-orphan"
    )
    flags: Mapped[List["AttemptFlag"]] = relationship(
        back_populates="attempt", cascade="all, delete-orphan"
    )


class AttemptAnswer(Base):
    __tablename__ = "attempt_answers"
    __table_args__ = (UniqueConstraint("attempt_id", "question_id", name="uq_attempt_answer_question"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    attempt_id: Mapped[int] = mapped_column(
        ForeignKey("test_attempts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_id: Mapped[int] = mapped_column(ForeignKey("exam_module_questions.id"), nullable=False, index=True)
    part_id: Mapped[int] = mapped_column(ForeignKey("exam_module_parts.id"), nullable=False, index=True)
    response: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    is_correct: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    points_awarded: Mapped[Optional[Decimal]] = mapped_column(Numeric(7, 2), nullable=True)
    audio_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    attempt: Mapped[TestAttempt] = relationship(back_populates="answers")
    question: Mapped["ExamModuleQuestion"] = relationship()  # noqa: F821
    part: Mapped["ExamModulePart"] = relationship()  # noqa: F821


class AttemptPartGrade(Base):
    """Human (rubric) scoring for a Writing/Speaking part of an attempt."""

    __tablename__ = "attempt_part_grades"
    __table_args__ = (UniqueConstraint("attempt_id", "part_id", name="uq_attempt_part_grade"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    attempt_id: Mapped[int] = mapped_column(
        ForeignKey("test_attempts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    part_id: Mapped[int] = mapped_column(ForeignKey("exam_module_parts.id"), nullable=False, index=True)
    criteria: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    total_marks: Mapped[Optional[Decimal]] = mapped_column(Numeric(7, 2), nullable=True)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    grader_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=PART_GRADE_PENDING)
    graded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    attempt: Mapped[TestAttempt] = relationship(back_populates="part_grades")
    part: Mapped["ExamModulePart"] = relationship()  # noqa: F821
    grader: Mapped[Optional["User"]] = relationship()  # noqa: F821


class AttemptFlag(Base):
    """Proctoring violation log (Final Test strict mode) - never auto-fails
    the student, just surfaced to the grader."""

    __tablename__ = "attempt_flags"

    id: Mapped[int] = mapped_column(primary_key=True)
    attempt_id: Mapped[int] = mapped_column(
        ForeignKey("test_attempts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    flag_type: Mapped[str] = mapped_column(String(30), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    meta: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    attempt: Mapped[TestAttempt] = relationship(back_populates="flags")
