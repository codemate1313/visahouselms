"""Marks each request with whether the developer made it, for notification
suppression.

This has to be a pure ASGI middleware, not a dependency. A sync generator
(`yield`) dependency runs its setup and teardown in two *different* threadpool
context copies, so the ContextVar token created before the yield is invalid when
`reset()` runs after it - raising ValueError and turning every request into a
500. Here set and reset happen in the one middleware coroutine, in the same
context, so reset is valid; and because that context is the request's own task
context, the flag is visible to the sync endpoint and the services it calls.
"""
from starlette.requests import Request

from app.core import actor_context
from app.middleware.request_logging import is_developer_request


class DeveloperActionMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope)
        token = actor_context.set_developer_action(is_developer_request(request))
        try:
            await self.app(scope, receive, send)
        finally:
            actor_context.reset_developer_action(token)
