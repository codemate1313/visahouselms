"""Minimal in-process TTL cache behind an interface (roadmap 0.2: no Redis;
keep the cache swappable so Redis can slot in later without touching callers)."""

import threading
import time
from typing import Any, Optional


class TTLCache:
    def __init__(self) -> None:
        self._store: dict = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if expires_at is not None and expires_at < time.monotonic():
                del self._store[key]
                return None
            return value

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        expires_at = time.monotonic() + ttl_seconds if ttl_seconds else None
        with self._lock:
            self._store[key] = (value, expires_at)

    def delete(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)

    def clear_all(self) -> int:
        with self._lock:
            count = len(self._store)
            self._store.clear()
            return count


app_cache = TTLCache()
