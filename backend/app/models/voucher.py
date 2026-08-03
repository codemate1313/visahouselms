from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class VoucherType(Base):
    __tablename__ = "voucher_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., IELTS Academic, PTE Academic
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)  # e.g., ielts-academic
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    badge_color: Mapped[str] = mapped_column(String(20), nullable=False, default="#0284c7")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    offerings: Mapped[List["VoucherOffering"]] = relationship("VoucherOffering", back_populates="voucher_type", cascade="all, delete-orphan")
    codes: Mapped[List["VoucherCode"]] = relationship("VoucherCode", back_populates="voucher_type", cascade="all, delete-orphan")


class VoucherOffering(Base):
    __tablename__ = "voucher_offerings"

    id: Mapped[int] = mapped_column(primary_key=True)
    voucher_type_id: Mapped[int] = mapped_column(ForeignKey("voucher_types.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    discount_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    validity_days: Mapped[int] = mapped_column(Integer, nullable=False, default=180)
    gst_rate_id: Mapped[Optional[int]] = mapped_column(ForeignKey("gst_rates.id", ondelete="SET NULL"), nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    voucher_type: Mapped["VoucherType"] = relationship("VoucherType", back_populates="offerings")
    gst_rate: Mapped[Optional["GstRate"]] = relationship("GstRate")  # noqa: F821
    purchases: Mapped[List["VoucherPurchase"]] = relationship("VoucherPurchase", back_populates="offering")


class VoucherCode(Base):
    __tablename__ = "voucher_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    voucher_type_id: Mapped[int] = mapped_column(ForeignKey("voucher_types.id", ondelete="CASCADE"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)  # 16-digit alphanumeric
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="available", index=True)  # available | purchased | expired | disabled
    added_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    source_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    purchased_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    purchase_id: Mapped[Optional[int]] = mapped_column(ForeignKey("voucher_purchases.id", ondelete="SET NULL"), nullable=True)

    voucher_type: Mapped["VoucherType"] = relationship("VoucherType", back_populates="codes")
    purchase: Mapped[Optional["VoucherPurchase"]] = relationship("VoucherPurchase", foreign_keys=[purchase_id])


class VoucherPurchase(Base):
    __tablename__ = "voucher_purchases"

    id: Mapped[int] = mapped_column(primary_key=True)
    purchase_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    voucher_offering_id: Mapped[int] = mapped_column(ForeignKey("voucher_offerings.id"), nullable=False, index=True)
    voucher_code_id: Mapped[Optional[int]] = mapped_column(ForeignKey("voucher_codes.id"), nullable=True, unique=True)
    student_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    buyer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    buyer_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    buyer_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    gst_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    gst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    final_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="INR")

    gateway: Mapped[str] = mapped_column(String(50), nullable=False, default="demo")
    gateway_transaction_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="completed", index=True)  # pending | completed | failed | refunded
    valid_until: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    offering: Mapped["VoucherOffering"] = relationship("VoucherOffering", back_populates="purchases")
    voucher_code: Mapped[Optional["VoucherCode"]] = relationship("VoucherCode", foreign_keys=[voucher_code_id])
    student: Mapped[Optional["User"]] = relationship("User")  # noqa: F821
