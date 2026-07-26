from typing import Optional

from fastapi import HTTPException, Request, Response, status

from app.config import settings


def find_refresh_token(request: Request, supplied: Optional[str] = None) -> Optional[str]:
    return supplied or request.cookies.get(settings.refresh_cookie_name)


def get_refresh_token(request: Request, supplied: Optional[str] = None) -> str:
    token = find_refresh_token(request, supplied)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    return token


def set_refresh_cookie(response: Response, refresh_token: str, *, persistent: bool = True) -> None:
    cookie_options = {
        "key": settings.refresh_cookie_name,
        "value": refresh_token,
        "httponly": True,
        "secure": settings.refresh_cookie_secure,
        "samesite": settings.refresh_cookie_samesite,
        "domain": settings.refresh_cookie_domain,
        "path": "/",
    }
    if persistent:
        cookie_options["max_age"] = settings.refresh_token_expire_days * 24 * 60 * 60
    response.set_cookie(**cookie_options)


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        settings.refresh_cookie_name,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite=settings.refresh_cookie_samesite,
        domain=settings.refresh_cookie_domain,
        path="/",
    )
