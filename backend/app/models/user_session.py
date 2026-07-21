from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class UserSession(Base):
    """Holds hashed refresh tokens so refresh/logout can be verified and revoked
    server-side, and re-login after a device compromise can invalidate old ones."""

    __tablename__ = "user_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    device_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("user_devices.id", ondelete="SET NULL"), nullable=True, index=True
    )
    session_key: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=True)
    refresh_token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(255))
    ip_address: Mapped[Optional[str]] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    device: Mapped[Optional["UserDevice"]] = relationship()  # noqa: F821
