from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class UserDevice(Base):
    __tablename__ = "user_devices"
    __table_args__ = (
        UniqueConstraint("user_id", "identifier_hash", name="uq_user_device_identifier"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    identifier_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    login_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    # Set the moment this device completes an email OTP challenge, to
    # `now + settings.otp_bypass_minutes`. A login from this device before that
    # timestamp skips the OTP step; nothing here extends it, so the window is
    # always anchored to the verification that started it, not to later logins.
    otp_verified_until: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship()  # noqa: F821

