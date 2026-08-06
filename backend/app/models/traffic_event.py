from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TrafficEvent(Base):
    """One page view or click, as reported by the browser.

    This is analytics, not audit: it is coarse, best-effort, and never trusted
    for anything that matters. The client sends it, so every field is taken as a
    hint - the path is capped, the visitor id is an opaque token the browser
    made up, and `user_id` is only set when a request happens to carry a valid
    session. Nothing here identifies a person on its own.

    Kept deliberately thin. Aggregates (views per day, top paths, unique
    visitors) are computed on read; storing them pre-rolled would mean a second
    schema to migrate every time a new breakdown is wanted.
    """

    __tablename__ = "traffic_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    # "pageview" or "click"; a short string rather than an enum so a new event
    # type does not need a migration.
    event_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    path: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    referrer: Mapped[Optional[str]] = mapped_column(String(500))
    # A random token the browser keeps for the session, used only to count
    # unique visitors. Not linked to identity.
    visitor_id: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    # Set only when the request carried a signed-in session; null for the
    # public marketing site.
    user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # Free-text label for a click event, e.g. a button name. Null for pageviews.
    label: Mapped[Optional[str]] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), index=True
    )
