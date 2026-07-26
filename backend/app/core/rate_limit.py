"""Fixed-window attempt limiting for unauthenticated endpoints.

Counters live in this process only. A multi-worker deployment gives each worker
its own window, so the effective limit is (workers x limit); move `_events` to a
shared store (Redis) before scaling out horizontally.
"""

from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import HTTPException, status

DEFAULT_MESSAGE = "Too many attempts. Please try again later."

_events: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()


def enforce_rate_limit(
    key: str,
    limit: int,
    window_seconds: int,
    message: str = DEFAULT_MESSAGE,
) -> None:
    """Records an attempt against `key`, raising 429 once `limit` is reached
    within `window_seconds`. A non-positive limit disables the check."""
    if limit <= 0:
        return

    now = monotonic()
    cutoff = now - window_seconds
    with _lock:
        events = _events[key]
        while events and events[0] <= cutoff:
            events.popleft()
        if len(events) >= limit:
            retry_after = max(1, int(window_seconds - (now - events[0])))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=message,
                headers={"Retry-After": str(retry_after)},
            )
        events.append(now)


def clear_rate_limit(key: str) -> None:
    """Drops a key's window, used to release a counter after the attempt it was
    guarding succeeds (e.g. a correct OTP)."""
    with _lock:
        _events.pop(key, None)


def reset_rate_limits() -> None:
    with _lock:
        _events.clear()
