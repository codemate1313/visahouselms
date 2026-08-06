"""Ingest and aggregation for site traffic.

Writes are cheap and untrusted: the browser reports a page view, this clamps it
to sane bounds and stores it. Reads are where the value is - views over time,
unique visitors, top pages, click counts - and they are all computed from the
raw rows, so a new breakdown is a new query rather than a new table.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.traffic_event import TrafficEvent

_ALLOWED_EVENTS = ("pageview", "click")
_MAX_PATH = 500
_MAX_REFERRER = 500
_MAX_VISITOR = 64
_MAX_LABEL = 120


def _clamp(value: Optional[str], length: int) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value[:length] if value else None


def record_event(
    db: Session,
    *,
    event_type: str,
    path: str,
    referrer: Optional[str] = None,
    visitor_id: Optional[str] = None,
    user_id: Optional[int] = None,
    label: Optional[str] = None,
) -> None:
    """Store one reported event. Silently ignores anything malformed - analytics
    must never be able to turn a bad beacon into a failed page load."""
    if event_type not in _ALLOWED_EVENTS:
        return
    clean_path = _clamp(path, _MAX_PATH)
    if not clean_path:
        return

    db.add(
        TrafficEvent(
            event_type=event_type,
            path=clean_path,
            referrer=_clamp(referrer, _MAX_REFERRER),
            visitor_id=_clamp(visitor_id, _MAX_VISITOR),
            user_id=user_id,
            label=_clamp(label, _MAX_LABEL),
        )
    )
    db.commit()


def _window_start(days: int) -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)


def summary(db: Session, days: int = 30) -> dict:
    """Everything the traffic panel needs in one shape.

    Kept to a handful of aggregate queries rather than pulling rows into Python;
    the events table is the fastest-growing one in the system and this endpoint
    must stay a few index scans, not a table load.
    """
    since = _window_start(days)
    base = db.query(TrafficEvent).filter(TrafficEvent.created_at >= since)

    total_views = base.filter(TrafficEvent.event_type == "pageview").count()
    total_clicks = base.filter(TrafficEvent.event_type == "click").count()
    unique_visitors = (
        base.filter(TrafficEvent.visitor_id.isnot(None))
        .with_entities(func.count(func.distinct(TrafficEvent.visitor_id)))
        .scalar()
        or 0
    )

    # Views per day for the time series.
    per_day = (
        base.filter(TrafficEvent.event_type == "pageview")
        .with_entities(
            func.date(TrafficEvent.created_at).label("day"),
            func.count(TrafficEvent.id).label("views"),
        )
        .group_by(func.date(TrafficEvent.created_at))
        .order_by(func.date(TrafficEvent.created_at))
        .all()
    )

    top_pages = (
        base.filter(TrafficEvent.event_type == "pageview")
        .with_entities(TrafficEvent.path, func.count(TrafficEvent.id).label("views"))
        .group_by(TrafficEvent.path)
        .order_by(func.count(TrafficEvent.id).desc())
        .limit(10)
        .all()
    )

    top_clicks = (
        base.filter(TrafficEvent.event_type == "click", TrafficEvent.label.isnot(None))
        .with_entities(TrafficEvent.label, func.count(TrafficEvent.id).label("clicks"))
        .group_by(TrafficEvent.label)
        .order_by(func.count(TrafficEvent.id).desc())
        .limit(10)
        .all()
    )

    return {
        "window_days": days,
        "total_views": total_views,
        "total_clicks": total_clicks,
        "unique_visitors": unique_visitors,
        "views_per_day": [{"day": str(row.day), "views": row.views} for row in per_day],
        "top_pages": [{"path": row.path, "views": row.views} for row in top_pages],
        "top_clicks": [{"label": row.label, "clicks": row.clicks} for row in top_clicks],
    }
