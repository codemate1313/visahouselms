from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class InstagramSettings(Base):
    """Singleton row storing Instagram Graph API settings and cached feed data."""

    __tablename__ = "instagram_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    access_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    instagram_account_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    username: Mapped[str] = mapped_column(String(100), default="visa_house_imm", nullable=False)
    fetch_limit: Mapped[int] = mapped_column(Integer, default=8, nullable=False)
    feed_data_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_fetched_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
