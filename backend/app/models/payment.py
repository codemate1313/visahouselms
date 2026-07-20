from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(10), nullable=False)  # b2b | b2c
    institute_id: Mapped[Optional[int]] = mapped_column(ForeignKey("institutes.id"), nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    plan_id: Mapped[Optional[int]] = mapped_column(ForeignKey("plans.id"), nullable=True)
    course_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # no FK yet - Phase 3

    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    final_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="INR")

    coupon_id: Mapped[Optional[int]] = mapped_column(ForeignKey("coupons.id"), nullable=True)
    gateway: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    gateway_reference: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending|partial|paid|failed|refunded
    subscription_id: Mapped[Optional[int]] = mapped_column(ForeignKey("subscriptions.id"), nullable=True)
    invoice_number: Mapped[Optional[str]] = mapped_column(String(50), unique=True, nullable=True)

    payment_method_id: Mapped[Optional[int]] = mapped_column(ForeignKey("payment_methods.id"), nullable=True)
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    institute: Mapped[Optional["Institute"]] = relationship()  # noqa: F821
    plan: Mapped[Optional["Plan"]] = relationship()  # noqa: F821
    coupon: Mapped[Optional["Coupon"]] = relationship()  # noqa: F821
    payment_method: Mapped[Optional["PaymentMethod"]] = relationship()  # noqa: F821
