from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


IELTS_SECTIONS = ("listening", "reading", "writing", "speaking")
QUESTION_TYPES = (
    "mcq_single",
    "mcq_multiple",
    "true_false_not_given",
    "yes_no_not_given",
    "short_answer",
    "fill_blank",
    "essay",
    "speaking_prompt",
)
QUESTION_DIFFICULTIES = ("easy", "medium", "hard")
QUESTION_SOURCES = ("manual", "pdf", "csv")

ASSESSMENT_TYPES = ("practice", "module_mock", "full_mock", "final")
ASSESSMENT_STATUSES = ("draft", "published", "archived")


class QuestionBank(Base):
    __tablename__ = "question_banks"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    section: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=func.now())

    course: Mapped["Course"] = relationship(back_populates="question_banks")  # noqa: F821
    created_by: Mapped["User"] = relationship()  # noqa: F821
    questions: Mapped[List["Question"]] = relationship(
        back_populates="bank", cascade="all, delete-orphan", order_by="Question.created_at"
    )


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    bank_id: Mapped[int] = mapped_column(
        ForeignKey("question_banks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    passage: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    options: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    correct_answers: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    points: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=1)
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    source_type: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    source_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=func.now())

    bank: Mapped[QuestionBank] = relationship(back_populates="questions")
    created_by: Mapped["User"] = relationship()  # noqa: F821
    assessment_links: Mapped[List["AssessmentQuestion"]] = relationship(back_populates="question")


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    assessment_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft", index=True)
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=func.now())

    course: Mapped["Course"] = relationship(back_populates="assessments")  # noqa: F821
    created_by: Mapped["User"] = relationship()  # noqa: F821
    question_links: Mapped[List["AssessmentQuestion"]] = relationship(
        back_populates="assessment", cascade="all, delete-orphan", order_by="AssessmentQuestion.sort_order"
    )


class AssessmentQuestion(Base):
    __tablename__ = "assessment_questions"
    __table_args__ = (
        UniqueConstraint("assessment_id", "question_id", name="uq_assessment_question"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    assessment_id: Mapped[int] = mapped_column(
        ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    points_override: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2), nullable=True)

    assessment: Mapped[Assessment] = relationship(back_populates="question_links")
    question: Mapped[Question] = relationship(back_populates="assessment_links")
