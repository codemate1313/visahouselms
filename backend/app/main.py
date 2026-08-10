import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.media_signing import is_private
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.middleware.developer_action import DeveloperActionMiddleware
from app.middleware.request_logging import RequestLoggingMiddleware, _extract_user_id, is_developer_request
from app.middleware.security_headers import add_security_headers
from app.routers import (
    announcements,
    auth,
    backups,
    blogs_router,
    contact_settings_router,
    coupons,
    dashboard,
    dev_settings,
    developer,
    gst_rates,
    grading_admin,
    institutes,
    institute_admin,
    institute_instructor,
    institute_signups,
    instructor_grading,
    instructor_portal,
    instructors,
    logs,
    module_authoring,
    module_catalog,
    notifications,
    onboarding,
    payment_methods,
    payments,
    payment_webhooks,
    platform_router,
    plans,

    retake_admin,
    revenue,
    seo_router,
    student_portal,
    subscriptions,
    super_admin,
    support,
    terminal,
    media,
    testimonials_router,
    trial_config,
    vouchers,
)

app = FastAPI(title="IELTS LMS API")

settings.storage_path.mkdir(parents=True, exist_ok=True)


class _PublicStorageFiles(StaticFiles):
    """The storage tree is public by default, with an explicit private list.

    Student speaking recordings, support attachments and signed agreements live
    in this tree but must not be fetchable by URL alone. Rather than enumerate
    every public folder as its own mount (easy to forget one when a new feature
    adds a folder), this denies the known-private prefixes and leaves the rest
    served as before, so no existing public asset URL changes.
    """

    async def get_response(self, path: str, scope):
        if is_private(path.lstrip("/")):
            raise StarletteHTTPException(status_code=404)
        return await super().get_response(path, scope)


app.mount("/storage", _PublicStorageFiles(directory=str(settings.storage_path)), name="storage")

app.add_middleware(DeveloperActionMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_host_list)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.middleware("http")(add_security_headers)


@app.middleware("http")
async def platform_settings_alias(request: Request, call_next):
    path = request.scope.get("path", "")
    if path.startswith("/super-admin/platform-settings"):
        request.scope["path"] = path.replace("/super-admin/platform-settings", "/super-admin/dev-settings", 1)
    return await call_next(request)


# Paths that must answer even while the site is closed, or the developer could
# not sign in to reopen it: the auth endpoints, the developer panel itself, the
# maintenance state the frontend polls to render its notice, and static assets.
_MAINTENANCE_EXEMPT_PREFIXES = (
    "/auth",
    "/developer",
    "/storage",
    "/docs",
    "/openapi.json",
    "/health",
    "/platform/status",
)


@app.middleware("http")
async def maintenance_gate(request: Request, call_next):
    """Turn ordinary traffic away while the site is closed for maintenance.

    The developer role is let through everywhere - it is who closes and reopens
    the site - and so is the owner, checked from the access token without a
    database read on the hot path. Exempt prefixes cover the routes needed to
    get back in and to render the notice. Everything else gets a 503.
    """
    from app.core.maintenance import is_enabled, is_read_only, get_message
    from app.middleware.request_logging import is_developer_request
    from app.database import SessionLocal, get_db

    path = request.scope.get("path", "")
    method = request.method

    if method in ("OPTIONS", "HEAD") or any(path.startswith(p) for p in _MAINTENANCE_EXEMPT_PREFIXES):
        return await call_next(request)

    # An impersonated session is read-only: it may look at anything and change
    # nothing. Enforced here, before any handler, on the method rather than the
    # route, so no write endpoint can be reached while impersonating.
    from app.middleware.request_logging import is_impersonation_request

    if method not in ("GET", "HEAD", "OPTIONS") and is_impersonation_request(request):
        return JSONResponse(
            status_code=403,
            content={"detail": "You are viewing as another user. Exit impersonation to make changes.", "impersonation": True},
        )

    db_override = app.dependency_overrides.get(get_db)
    db_generator = db_override() if db_override is not None else None
    db = next(db_generator) if db_generator is not None else SessionLocal()
    try:
        developer = is_developer_request(request)
        if is_enabled(db):
            # Developer requests are always allowed; that is the way back in.
            if developer:
                return await call_next(request)
            message = get_message(db) or "The platform is temporarily unavailable for maintenance."
            return JSONResponse(
                status_code=503,
                content={"detail": message, "maintenance": True},
                headers={"Retry-After": "3600"},
            )
        # Read-only mode: the site is viewable, but non-developers cannot change
        # anything. Safe methods pass; writes are refused with a clear 423.
        if is_read_only(db) and method not in ("GET", "HEAD", "OPTIONS") and not developer:
            return JSONResponse(
                status_code=423,
                content={
                    "detail": "The platform is in read-only mode for maintenance. Changes are paused; please try again shortly.",
                    "read_only": True,
                },
            )
    finally:
        if db_generator is not None:
            db_generator.close()
        else:
            db.close()

    return await call_next(request)

app.include_router(media.router)
app.include_router(auth.router)
app.include_router(platform_router.router)
app.include_router(dashboard.router)
app.include_router(super_admin.router)
app.include_router(developer.router)
app.include_router(dev_settings.router)
app.include_router(grading_admin.router)
app.include_router(retake_admin.router)
app.include_router(backups.router)
app.include_router(logs.router)
app.include_router(terminal.router)
app.include_router(plans.router)
app.include_router(plans.public_router)
app.include_router(subscriptions.router)
app.include_router(institutes.router)
app.include_router(institutes.public_router)
app.include_router(institute_admin.router)
app.include_router(institute_instructor.router)
app.include_router(instructors.router)
app.include_router(instructor_portal.router)
app.include_router(instructor_grading.router)
app.include_router(trial_config.router)
app.include_router(coupons.router)
app.include_router(module_authoring.router)
app.include_router(module_catalog.router)
app.include_router(onboarding.router)
app.include_router(institute_signups.router)
app.include_router(institute_signups.public_router)
app.include_router(payments.router)
app.include_router(payment_methods.router)
app.include_router(gst_rates.router)
app.include_router(payment_webhooks.router)
app.include_router(revenue.router)
app.include_router(vouchers.router)

app.include_router(student_portal.router)
app.include_router(notifications.router)
app.include_router(support.public_router)
app.include_router(support.admin_router)
app.include_router(support.institute_router)
app.include_router(announcements.institute_router)
app.include_router(announcements.platform_router)
app.include_router(announcements.student_router)
app.include_router(testimonials_router.public_router)
app.include_router(testimonials_router.admin_router)
app.include_router(blogs_router.public_router)
app.include_router(blogs_router.admin_router)
app.include_router(seo_router.public_router)
app.include_router(seo_router.admin_router)
app.include_router(contact_settings_router.public_router)
app.include_router(contact_settings_router.admin_router)


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    """A constraint violation is the caller's problem, not a crash.

    Every unique index and foreign key in the schema can be tripped by a request
    that was valid when it was checked and stale by the time it was written -
    two admins claiming one email, a row deleted while its parent was being
    edited. Pre-checks narrow that window but cannot close it, so the violation
    has to have a defined answer. Without this handler it fell through to the
    500 below, which tells the caller nothing and reads as an outage.

    The driver's message is deliberately not forwarded: it names tables and
    constraints, which is internal detail. It is recorded instead, so the
    specific constraint is still recoverable from the error log.
    """
    from app.database import SessionLocal
    from app.services.log_service import record_error

    if not is_developer_request(request):
        db = SessionLocal()
        try:
            record_error(
                db,
                message=f"IntegrityError: {exc.orig if exc.orig is not None else exc}",
                stack_trace=traceback.format_exc(),
                path=request.url.path,
                method=request.method,
                user_id=_extract_user_id(request),
                ip_address=request.client.host if request.client else None,
            )
        except Exception:
            pass
        finally:
            db.close()

    return JSONResponse(
        status_code=409,
        content={
            "detail": (
                "That change conflicts with existing data. It may already exist, "
                "or something still depends on it."
            )
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    from app.database import SessionLocal
    from app.services.log_service import record_error

    db = SessionLocal()
    try:
        if not is_developer_request(request):
            record_error(
                db,
                message=f"{type(exc).__name__}: {exc}",
                stack_trace=traceback.format_exc(),
                path=request.url.path,
                method=request.method,
                user_id=_extract_user_id(request),
                ip_address=request.client.host if request.client else None,
            )
    except Exception:
        pass  # error logging must never mask the original failure
    finally:
        db.close()
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.on_event("startup")
def on_startup() -> None:
    from app.core.crash_detection import check_and_mark_startup
    from app.services.job_service import start_background_threads

    check_and_mark_startup()
    start_background_threads()


@app.on_event("shutdown")
def on_shutdown() -> None:
    from app.core.crash_detection import mark_clean_shutdown
    from app.services.job_service import stop_background_threads

    stop_background_threads()
    mark_clean_shutdown()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/db")
def database_health():
    from sqlalchemy import text

    from app.database import SessionLocal

    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"status": "error", "database": "unavailable"},
        )
    finally:
        db.close()
