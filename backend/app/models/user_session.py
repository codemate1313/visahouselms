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
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
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
    # Set when this token was rotated away by a successful /auth/refresh, as
    # opposed to being revoked by a logout or a takeover login. Within a short
    # grace window a rotated token is still honoured, so a reload that aborts
    # the refresh mid-flight - or two refreshes racing on the same cookie - does
    # not strand the browser holding a dead token. Reuse after that window is
    # treated as theft and revokes the whole lineage.
    rotated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    # The session this one was rotated out of. A parent pointer rather than a
    # child one because a single token can be rotated more than once: a replay
    # inside the grace window mints a sibling, and both stay valid, since the
    # browser may have kept either one. Pointing back at the parent keeps every
    # sibling reachable, so revoking a lineage cannot leave one behind.
    rotated_from_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("user_sessions.id", ondelete="SET NULL"), nullable=True, index=True
    )

    user: Mapped["User"] = relationship()  # noqa: F821
    device: Mapped[Optional["UserDevice"]] = relationship()  # noqa: F821
    rotated_from: Mapped[Optional["UserSession"]] = relationship(
        remote_side=[id], foreign_keys=[rotated_from_id]
    )
