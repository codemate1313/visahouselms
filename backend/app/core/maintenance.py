"""Site-wide maintenance switch.

One stored flag decides whether the platform is open. When it is on, ordinary
traffic - public pages, tenant logins, every institute and student request - is
turned away with a 503 and a maintenance notice. The owner and the developer
role are never turned away, because the switch that closes the site has to leave
a way back in to open it again; a gate you cannot reach from outside is not a
maintenance mode, it is an outage.

The flag lives in the settings table so it survives restarts, but every request
cannot afford a database read to check it. It is cached in-process with a short
TTL, and the toggle clears the cache immediately, so turning the site off takes
effect at once on the process that flipped it and within the TTL everywhere
else.
"""
import threading
import time
from typing import Optional

from sqlalchemy.orm import Session

from app.services import settings_service

MAINTENANCE_KEY = "platform.maintenance_mode"
MAINTENANCE_MESSAGE_KEY = "platform.maintenance_message"
# Read-only mode is a lighter switch: the site stays fully viewable, but any
# state-changing request from a non-developer is refused. Good for a migration
# window where you want people to be able to look but not touch.
READ_ONLY_KEY = "platform.read_only_mode"

_CACHE_TTL_SECONDS = 10.0
_lock = threading.Lock()
_cached_value: Optional[bool] = None
_cached_at: float = 0.0
_ro_cached_value: Optional[bool] = None
_ro_cached_at: float = 0.0


def _read_flag(db: Session) -> bool:
    return (settings_service.get_setting(db, MAINTENANCE_KEY) or "").lower() == "on"


def is_enabled(db: Session) -> bool:
    """Whether the site is currently closed for maintenance.

    Cached so the guard that runs on every request is not a query on every
    request. A stale read can only ever be at most `_CACHE_TTL_SECONDS` old, and
    the process that toggles the flag refreshes its own cache synchronously.
    """
    global _cached_value, _cached_at
    now = time.monotonic()
    with _lock:
        if _cached_value is not None and (now - _cached_at) < _CACHE_TTL_SECONDS:
            return _cached_value
    value = _read_flag(db)
    with _lock:
        _cached_value = value
        _cached_at = now
    return value


def is_read_only(db: Session) -> bool:
    """Whether the platform is in read-only mode. Its own short cache, separate
    from the maintenance flag."""
    global _ro_cached_value, _ro_cached_at
    now = time.monotonic()
    with _lock:
        if _ro_cached_value is not None and (now - _ro_cached_at) < _CACHE_TTL_SECONDS:
            return _ro_cached_value
    value = (settings_service.get_setting(db, READ_ONLY_KEY) or "").lower() == "on"
    with _lock:
        _ro_cached_value = value
        _ro_cached_at = now
    return value


def set_read_only(db: Session, enabled: bool) -> None:
    settings_service.set_setting(db, READ_ONLY_KEY, "on" if enabled else "off")
    global _ro_cached_value, _ro_cached_at
    with _lock:
        _ro_cached_value = None
        _ro_cached_at = 0.0


def get_message(db: Session) -> Optional[str]:
    return settings_service.get_setting(db, MAINTENANCE_MESSAGE_KEY)


def set_enabled(db: Session, enabled: bool, message: Optional[str] = None) -> None:
    """Flip the switch and make the change visible immediately on this process."""
    settings_service.set_setting(db, MAINTENANCE_KEY, "on" if enabled else "off")
    if message is not None:
        settings_service.set_setting(db, MAINTENANCE_MESSAGE_KEY, message or None)
    _invalidate()


def _invalidate() -> None:
    global _cached_value, _cached_at
    with _lock:
        _cached_value = None
        _cached_at = 0.0
