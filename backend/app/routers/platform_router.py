"""Public, unauthenticated platform endpoints.

Two things the browser needs before anyone has signed in: whether the site is
open, so it can show the maintenance notice instead of a broken app; and a place
to report a page view.

Only the status check is exempt from the maintenance gate - the notice depends
on it. The beacon is not exempt and stops recording while the site is closed,
which is the right outcome: there is no traffic worth counting during
maintenance, and it saves a write on every blocked request.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core import maintenance
from app.database import get_db
from app.services import traffic_service

router = APIRouter(prefix="/platform", tags=["platform"])


class PlatformStatus(BaseModel):
    maintenance: bool
    message: Optional[str] = None


class TrafficBeacon(BaseModel):
    event_type: str = Field(pattern="^(pageview|click)$")
    path: str = Field(max_length=500)
    referrer: Optional[str] = Field(default=None, max_length=500)
    visitor_id: Optional[str] = Field(default=None, max_length=64)
    label: Optional[str] = Field(default=None, max_length=120)


@router.get("/status", response_model=PlatformStatus)
def platform_status(db: Session = Depends(get_db)):
    """Polled by the frontend to decide whether to show the maintenance screen."""
    if maintenance.is_enabled(db):
        return PlatformStatus(maintenance=True, message=maintenance.get_message(db))
    return PlatformStatus(maintenance=False)


@router.post("/collect", status_code=204)
def collect(beacon: TrafficBeacon, request: Request, db: Session = Depends(get_db)):
    """Receive one traffic event from the browser.

    `user_id` is read from the session if the request happens to carry one, but
    the endpoint never requires it - the marketing site reports views with no
    one signed in. Returns 204 regardless, so a rejected or malformed beacon can
    never surface as an error in the page the visitor is looking at.
    """
    from app.middleware.request_logging import _extract_user_id

    traffic_service.record_event(
        db,
        event_type=beacon.event_type,
        path=beacon.path,
        referrer=beacon.referrer,
        visitor_id=beacon.visitor_id,
        user_id=_extract_user_id(request),
        label=beacon.label,
    )
