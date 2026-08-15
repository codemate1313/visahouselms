"""Short-lived signed URLs for private files under the storage tree.

Public assets (logos, profile avatars, exam media) stay on the plain `/storage`
static mount. Private files - student speaking recordings, support attachments,
signed institute agreements - must not be reachable by URL alone.

A guarded route cannot use the normal `Authorization: Bearer` header, because
the access token lives in memory on the frontend and browsers do not attach it
to `<audio>`, `<img>` or `<video>` requests. So instead of a header we mint a
capability URL: the path plus an expiry, HMAC-signed with the app's JWT secret.
It works in a plain media tag, cannot be forged, and stops working on its own.
"""

from __future__ import annotations

import hashlib
import hmac
import time
from typing import Optional

from app.config import settings

# Files under these prefixes are never served by the public static mount and
# require a valid signature. Anything not listed stays public.
PRIVATE_PREFIXES: tuple[str, ...] = (
    "attempt-answers/",
    "support_attachments/",
    "institute_agreements/",
    # Legacy location: backups now live outside the storage tree entirely, but
    # an install mid-migration may still have archives here. Never serve them.
    "backups/",
)

DEFAULT_TTL_SECONDS = 6 * 60 * 60


# Speaking candidate material (role-play cards, presentation handouts) lives at
# `exam-modules/<module_id>/speaking-materials/...`, so the module id sits in the
# middle and a fixed prefix cannot match it. It is exam content a candidate must
# not be able to hand to the next candidate, so it is matched by segment instead.
PRIVATE_SEGMENTS: tuple[str, ...] = ("speaking-materials/",)


def is_private(relative_path: str) -> bool:
    normalized = relative_path.lstrip("/")
    if normalized.startswith(PRIVATE_PREFIXES):
        return True
    return any(f"/{segment}" in f"/{normalized}" for segment in PRIVATE_SEGMENTS)


def _signature(relative_path: str, expires_at: int) -> str:
    message = f"{relative_path.lstrip('/')}|{expires_at}".encode("utf-8")
    return hmac.new(
        settings.jwt_secret_key.encode("utf-8"), message, hashlib.sha256
    ).hexdigest()


def sign_path(relative_path: Optional[str], ttl_seconds: int = DEFAULT_TTL_SECONDS) -> Optional[str]:
    """Build a signed `/media/...` URL for a storage-relative path.

    Public paths are handed back on the plain `/storage` mount unchanged, so
    callers can pass any path without having to know which bucket it is in.
    """
    if not relative_path:
        return None
    normalized = relative_path.lstrip("/")
    if not is_private(normalized):
        return f"/storage/{normalized}"
    expires_at = int(time.time()) + max(ttl_seconds, 60)
    return f"/media/{normalized}?exp={expires_at}&sig={_signature(normalized, expires_at)}"


def verify(relative_path: str, expires_at: int, signature: str) -> bool:
    if expires_at < int(time.time()):
        return False
    return hmac.compare_digest(_signature(relative_path, expires_at), signature or "")
