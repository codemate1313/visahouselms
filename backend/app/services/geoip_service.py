"""IP -> approximate location, from a bundled offline GeoLite2 database.

This is intentionally soft. IP geolocation is city-level at best and often only
country-level; it is a hint about where a session signed in from, not a fix on a
person. And it is optional infrastructure: the `geoip2` library or the `.mmdb`
file may not be present, in which case every lookup returns "unknown" and
nothing above this cares. Session listing must never fail because a location
could not be resolved.

The reader is opened once and reused - the database is memory-mapped, so a
single reader across requests is both correct and cheap. Private and loopback
addresses (localhost, LAN) are short-circuited to a friendly label rather than
sent to a lookup that would only miss.
"""
import ipaddress
import logging
import threading
from pathlib import Path
from typing import Optional

from app.config import BACKEND_DIR, settings

logger = logging.getLogger(__name__)

_reader = None
_reader_tried = False
_lock = threading.Lock()


def _db_path() -> Path:
    path = Path(settings.geoip_db_path)
    if not path.is_absolute():
        path = BACKEND_DIR / path
    return path


def _get_reader():
    """Open the reader once. A failure (missing library or file) is remembered,
    so a broken or absent database is not re-probed on every request."""
    global _reader, _reader_tried
    if _reader_tried:
        return _reader
    with _lock:
        if _reader_tried:
            return _reader
        _reader_tried = True
        try:
            import geoip2.database  # imported lazily so the app runs without it

            path = _db_path()
            if not path.exists():
                logger.info("GeoIP database not found at %s; locations disabled", path)
                _reader = None
            else:
                _reader = geoip2.database.Reader(str(path))
        except Exception as exc:  # library missing, unreadable file, etc.
            logger.info("GeoIP disabled: %s", exc)
            _reader = None
    return _reader


def _local_label(ip: str) -> Optional[str]:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return None
    if addr.is_loopback:
        return "Local (this server)"
    if addr.is_private:
        return "Private network"
    return None


def locate(ip_address: Optional[str]) -> dict:
    """A best-effort location for an IP.

    Always returns the same shape so the caller never has to special-case a
    miss: label plus optional city/country/coords, and `resolved` telling the
    UI whether there is anything real to show.
    """
    empty = {
        "label": "Unknown",
        "city": None,
        "country": None,
        "latitude": None,
        "longitude": None,
        "resolved": False,
    }
    if not ip_address:
        return empty

    local = _local_label(ip_address)
    if local:
        return {**empty, "label": local}

    reader = _get_reader()
    if reader is None:
        return empty

    try:
        response = reader.city(ip_address)
    except Exception:
        # AddressNotFoundError and friends: a real IP the DB simply does not know.
        return empty

    city = response.city.name
    country = response.country.name
    label = ", ".join(part for part in (city, country) if part) or "Unknown"
    return {
        "label": label,
        "city": city,
        "country": country,
        "latitude": response.location.latitude,
        "longitude": response.location.longitude,
        "resolved": bool(city or country),
    }
