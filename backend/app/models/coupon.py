from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Coupon(Base):
    __tablename__ = "coupons"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    discount_type: Mapped[str] = mapped_column(String(10), nullable=False)  # percent | flat
    value: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    scope: Mapped[str] = mapped_column(String(10), nullable=False, default="all")  # all | plan
    scope_plan_id: Mapped[Optional[int]] = mapped_column(ForeignKey("plans.id"), nullable=True)
    # unused since the Course concept was retired in favor of Plan-based
    # module subscriptions (both B2B and B2C) - column kept, non-destructive
    scope_course_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # per-customer cap (checked against CouponRedemption rows keyed by email,
    # not a global total) - see CouponRedemption below
    usage_limit: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    usage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    valid_from: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    valid_until: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class CouponRedemption(Base):
    """One row per successful redemption, keyed by normalized email rather
    than user_id - a deleted-and-recreated account gets a new user_id but
    keeps the same email, so email is what actually stops reuse."""

    __tablename__ = "coupon_redemptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    coupon_id: Mapped[int] = mapped_column(ForeignKey("coupons.id"), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    payment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("payments.id", ondelete="SET NULL"), nullable=True)
    redeemed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
