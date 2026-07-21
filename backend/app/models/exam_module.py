from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


MODULE_TYPES = (
    "reading",
    "speaking",
    "writing",
    "listening",
    "full_mock",
    "final_test",
)
MODULE_STATUSES = ("draft", "published", "archived")
MODULE_ASSET_TYPES = ("mp3", "tts_mp3", "avatar_mp4")


class ExamModule(Base):
    __tablename__ = "exam_modules"

    id: Mapped[int] = mapped_column(primary_key=True)
    module_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft", index=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    blueprint_version: Mapped[str] = mapped_column(
        String(80), nullable=False, default="LanguageCert Academic 2025"
    )
    source_module_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=list)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=func.now())

    created_by: Mapped["User"] = relationship()  # noqa: F821
    parts: Mapped[List["ExamModulePart"]] = relationship(
        back_populates="module",
        cascade="all, delete-orphan",
        order_by="ExamModulePart.sort_order",
    )
    assets: Mapped[List["ExamModuleAsset"]] = relationship(
        back_populates="module", cascade="all, delete-orphan"
    )


class ExamModulePart(Base):
    __tablename__ = "exam_module_parts"
    __table_args__ = (
        UniqueConstraint("module_id", "part_code", name="uq_exam_module_part_code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    module_id: Mapped[int] = mapped_column(
        ForeignKey("exam_modules.id", ondelete="CASCADE"), nullable=False, index=True
    )
    section_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    part_code: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    skill_focus: Mapped[str] = mapped_column(Text, nullable=False)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    question_limit: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    minimum_questions: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    max_marks: Mapped[Optional[Decimal]] = mapped_column(Numeric(7, 2), nullable=True)
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    auto_marked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    answer_constraints: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    rubric: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    module: Mapped[ExamModule] = relationship(back_populates="parts")
    questions: Mapped[List["ExamModuleQuestion"]] = relationship(
        back_populates="part",
        cascade="all, delete-orphan",
        order_by="ExamModuleQuestion.sort_order",
    )
    assets: Mapped[List["ExamModuleAsset"]] = relationship(back_populates="part")


class ExamModuleQuestion(Base):
    __tablename__ = "exam_module_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    part_id: Mapped[int] = mapped_column(
        ForeignKey("exam_module_parts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    passage: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    options: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    correct_answers: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    points: Mapped[Decimal] = mapped_column(Numeric(7, 2), nullable=False, default=1)
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    source_type: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    source_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=func.now())

    part: Mapped[ExamModulePart] = relationship(back_populates="questions")
    created_by: Mapped["User"] = relationship()  # noqa: F821


class ExamModuleAsset(Base):
    __tablename__ = "exam_module_assets"

    id: Mapped[int] = mapped_column(primary_key=True)
    module_id: Mapped[int] = mapped_column(
        ForeignKey("exam_modules.id", ondelete="CASCADE"), nullable=False, index=True
    )
    part_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("exam_module_parts.id", ondelete="CASCADE"), nullable=True, index=True
    )
    asset_type: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    transcript: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tts_voice: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, server_default=func.now())

    module: Mapped[ExamModule] = relationship(back_populates="assets")
    part: Mapped[Optional[ExamModulePart]] = relationship(back_populates="assets")
    uploaded_by: Mapped["User"] = relationship()  # noqa: F821
