from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Table, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

# Plain join table (no extra columns on the link itself) - a Plan's module
# bundle has no per-item ordering need, unlike a Course's linear sequence.
plan_modules = Table(
    "plan_modules",
    Base.metadata,
    Column("plan_id", ForeignKey("plans.id", ondelete="CASCADE"), primary_key=True),
    Column("module_id", ForeignKey("exam_modules.id", ondelete="CASCADE"), primary_key=True),
)


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="INR")
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)
    student_limit: Mapped[int] = mapped_column(Integer, nullable=False)
    test_limit: Mapped[int] = mapped_column(Integer, nullable=False)
    staff_limit: Mapped[int] = mapped_column(Integer, nullable=False)
    grace_days: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=func.now())

    modules: Mapped[List["ExamModule"]] = relationship(  # noqa: F821
        secondary=plan_modules, order_by="ExamModule.title"
    )
