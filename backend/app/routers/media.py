"""Serves private storage files against a short-lived signature.

See `app.core.media_signing` for why this is signature-based rather than
header-based. The signature proves the URL was minted by the backend for a
caller it had already authorised; this route re-checks the expiry and the
signature, and refuses anything that escapes the storage root.
"""

from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse

from app.config import settings
from app.core.media_signing import is_private, verify

router = APIRouter(prefix="/media", tags=["media"])


@router.get("/{file_path:path}")
def get_private_media(
    file_path: str,
    exp: int = Query(..., description="Unix expiry embedded in the signature"),
    sig: str = Query(..., description="HMAC signature of path and expiry"),
):
    forbidden = HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="This link is invalid or has expired.",
    )

    normalized = file_path.lstrip("/")
    if not is_private(normalized):
        # Public assets are served by the static mount; refuse to become a
        # second, signature-shaped door onto the same tree.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    if not verify(normalized, exp, sig):
        raise forbidden

    root = settings.storage_path.resolve()
    target = (root / normalized).resolve()
    # Defence in depth: the signature already pins the path, but resolve() plus
    # this check means a traversal attempt can never read outside storage.
    if target != root and root not in target.parents:
        raise forbidden
    if not target.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    return FileResponse(
        path=target,
        filename=Path(normalized).name,
        headers={
            # These are per-user documents and recordings: keep them out of
            # shared caches and out of search indexes.
            "Cache-Control": "private, max-age=0, no-store",
            "X-Robots-Tag": "noindex, nofollow",
        },
    )
