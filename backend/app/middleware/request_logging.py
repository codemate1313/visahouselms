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


def _extract_user_id(request: Request) -> Optional[int]:
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
    try:
        return int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        return None


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        latency_ms = int((time.perf_counter() - start) * 1000)

        if request.url.path.startswith(SKIP_PREFIXES):
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
        finally:
            db.close()

        return response
