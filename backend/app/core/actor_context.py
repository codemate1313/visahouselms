"""Request-scoped knowledge of whether the current actor is the developer.

The developer layer is invisible to everyone else by design: its requests are
already excluded from the telemetry logs the Super Admin can read. In-app
notifications are the other channel that would otherwise reveal it - "Institute
created by ...", "Access revoked", and so on fan out to Super Admins - so a
developer's actions must not generate any.

The actor is known where a request is authenticated, but the notification is
written deep inside a service that never sees the request. A context variable
bridges that gap: a dependency sets it at the top of every request, and the
notification layer reads it at the bottom. A ContextVar (not a global) is what
makes this safe under concurrency - each request gets its own value.
"""
from contextvars import ContextVar, Token

_developer_action: ContextVar[bool] = ContextVar("developer_action", default=False)


def set_developer_action(value: bool) -> Token:
    return _developer_action.set(value)


def reset_developer_action(token: Token) -> None:
    _developer_action.reset(token)


def is_developer_action() -> bool:
    return _developer_action.get()
