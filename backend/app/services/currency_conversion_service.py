"""Reference currency conversion used for display-only price estimates."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_CEILING
import json
import logging
import urllib.request
from typing import Optional

from app.config import settings


logger = logging.getLogger(__name__)

RATE_URL = "https://api.frankfurter.dev/v2/rate/INR/USD"
CACHE_TTL = timedelta(hours=12)

_cached_rate: Optional[Decimal] = None
_cached_date: Optional[str] = None
_cached_at: Optional[datetime] = None


def get_inr_usd_display_rate() -> dict:
    """Return a cached daily rate, with a configurable safe fallback.

    The rate is only for approximate prices shown to visitors. Checkout keeps
    using the plan's configured billing currency unless international pricing
    has explicitly been enabled for that plan.
    """
    global _cached_rate, _cached_date, _cached_at

    now = datetime.now(timezone.utc)
    if _cached_rate is not None and _cached_at is not None and now - _cached_at < CACHE_TTL:
        return {
            "rate": float(_cached_rate),
            "date": _cached_date,
            "source": "Frankfurter reference rate",
        }

    try:
        request = urllib.request.Request(RATE_URL, headers={"User-Agent": "VisaHouseLMS/1.0"})
        with urllib.request.urlopen(request, timeout=2.0) as response:
            payload = json.loads(response.read().decode("utf-8"))
        rate = Decimal(str(payload["rate"]))
        if rate <= 0:
            raise ValueError("Exchange rate must be positive")

        _cached_rate = rate
        _cached_date = str(payload.get("date") or "") or None
        _cached_at = now
        return {
            "rate": float(rate),
            "date": _cached_date,
            "source": "Frankfurter reference rate",
        }
    except (KeyError, TypeError, ValueError, InvalidOperation, OSError, json.JSONDecodeError) as exc:
        logger.warning("Unable to refresh INR/USD display rate; using configured fallback: %s", exc)
        return {
            "rate": float(settings.inr_usd_display_rate),
            "date": None,
            "source": "configured fallback rate",
        }


def inr_to_usd(inr_amount: Decimal) -> Decimal:
    """A dollar price for a plan that only has a rupee one.

    Rounded up to a whole dollar rather than left at the raw conversion: a
    catalogue that reads $58.49 today and $58.61 tomorrow looks broken, and
    the rounding is in the buyer's favour by pennies rather than the seller's.
    Never returns zero - a free plan is a decision, not a rounding artefact.
    """
    rate = Decimal(str(get_inr_usd_display_rate()["rate"]))
    if rate <= 0:
        rate = Decimal(str(settings.inr_usd_display_rate))
    converted = (Decimal(inr_amount) * rate).quantize(Decimal("1"), rounding=ROUND_CEILING)
    return max(converted, Decimal("1"))
