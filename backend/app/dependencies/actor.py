"""Global dependency that tags each request with whether the developer made it.

Runs as an app-level dependency, so it executes in the same context as the path
operation and every service it calls - which a BaseHTTPMiddleware would not
reliably do for a ContextVar. The value is reset on the way out so it never
leaks into the worker's next request.

It reads the role straight from the access token rather than loading the user,
so it stays cheap and never raises on the public, unauthenticated routes it also
runs for.
"""
from fastapi import Request

from app.core import actor_context
from app.middleware.request_logging import is_developer_request


def track_developer_action(request: Request):
    token = actor_context.set_developer_action(is_developer_request(request))
    try:
        yield
    finally:
        actor_context.reset_developer_action(token)
