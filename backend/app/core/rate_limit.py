from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import HTTPException, status

_events: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()


def enforce_rate_limit(key: str, limit: int, window_seconds: int) -> None:
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
                detail="Too many registration attempts. Please try again later.",
                headers={"Retry-After": str(retry_after)},
            )
        events.append(now)


def reset_rate_limits() -> None:
    with _lock:
        _events.clear()
