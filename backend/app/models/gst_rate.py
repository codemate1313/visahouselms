from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, DateTime, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

TAX_TYPE_EXCLUSIVE = "exclusive"
TAX_TYPE_INCLUSIVE = "inclusive"
TAX_TYPES = (TAX_TYPE_EXCLUSIVE, TAX_TYPE_INCLUSIVE)


class GstRate(Base):
    __tablename__ = "gst_rates"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "GST 18%", "GST 5%"
    percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=18.00)
    tax_type: Mapped[str] = mapped_column(String(20), nullable=False, default=TAX_TYPE_EXCLUSIVE)  # exclusive | inclusive
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=func.now())
