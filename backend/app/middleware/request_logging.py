import logging
import time
from typing import Optional

import jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.security import TOKEN_TYPE_ACCESS, decode_token
from app.database import SessionLocal
from app.models.api_log import ApiLog
from app.models.request_log import RequestLog

# request headers worth keeping in the fat log (never auth/cookies)
LOGGED_HEADERS = ("user-agent", "referer", "origin", "content-type", "accept-language")

# static file serving would flood the request logs
SKIP_PREFIXES = ("/storage/",)


def _decode_access_token(request: Request) -> Optional[dict]:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header[7:]
    try:
        payload = decode_token(token)
    except jwt.PyJWTError:
        return None
    if payload.get("type") != TOKEN_TYPE_ACCESS:
        return None
    return payload


def _extract_user_id(request: Request) -> Optional[int]:
    payload = _decode_access_token(request)
    if payload is None:
        return None
    try:
        return int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        return None


def is_impersonation_request(request: Request) -> bool:
    """True when the caller is impersonating someone (token carries `imp`).

    Used by the request gate to refuse writes: an impersonated session may look
    at anything and change nothing."""
    payload = _decode_access_token(request)
    return bool(payload) and payload.get("imp") is not None


def is_developer_request(request: Request) -> bool:
    """The developer portal must leave no trace anywhere another role can see -
    telemetry (request/API/error logs) is platform-wide and readable from the
    Super Admin Logs screen, so developer-authenticated calls are excluded at
    the source rather than filtered out downstream."""
    payload = _decode_access_token(request)
    return bool(payload) and payload.get("role") == "DEVELOPER"


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        latency_ms = int((time.perf_counter() - start) * 1000)

        if request.method == "OPTIONS" or request.url.path.startswith(SKIP_PREFIXES):
            return response

        if is_developer_request(request):
            return response

        user_id = _extract_user_id(request)
        ip_address = request.client.host if request.client else None

        try:
            request_bytes = int(request.headers.get("content-length") or 0)
        except ValueError:
            request_bytes = 0
        try:
            response_bytes = int(response.headers.get("content-length") or 0)
        except ValueError:
            response_bytes = 0

        # Telemetry must never turn a served response into a failure, so a
        # logging error is swallowed the same way the global handler swallows
        # its own. Without this, anything that breaks the log write (FK error,
        # database down) surfaces to the caller as a 500.
        db = SessionLocal()
        try:
            db.add(
                ApiLog(
                    method=request.method,
                    path=request.url.path,
                    status_code=response.status_code,
                    latency_ms=latency_ms,
                    user_id=user_id,
                    ip_address=ip_address,
                )
            )
            db.add(
                RequestLog(
                    method=request.method,
                    path=request.url.path,
                    status_code=response.status_code,
                    latency_ms=latency_ms,
                    user_id=user_id,
                    ip_address=ip_address,
                    user_agent=request.headers.get("user-agent"),
                    request_bytes=request_bytes,
                    response_bytes=response_bytes,
                    headers={k: request.headers[k] for k in LOGGED_HEADERS if k in request.headers},
                )
            )
            db.commit()
        except Exception:
            db.rollback()
            logging.getLogger(__name__).exception(
                "Request logging failed for %s %s", request.method, request.url.path
            )
        finally:
            db.close()

        return response
