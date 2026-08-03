import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.middleware.request_logging import RequestLoggingMiddleware, _extract_user_id
from app.middleware.security_headers import add_security_headers
from app.routers import (
    announcements,
    auth,
    backups,
    blogs_router,
    coupons,
    dashboard,
    dev_settings,
    developer,
    gst_rates,
    grading_admin,
    institutes,
    institute_admin,
    institute_instructor,
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
    plans,

    retake_admin,
    revenue,
    seo_router,
    student_portal,
    subscriptions,
    super_admin,
    support,
    terminal,
    testimonials_router,
    trial_config,
    vouchers,
)

app = FastAPI(title="IELTS LMS API")

settings.storage_path.mkdir(parents=True, exist_ok=True)
app.mount("/storage", StaticFiles(directory=str(settings.storage_path)), name="storage")

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

app.include_router(auth.router)
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


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    from app.database import SessionLocal
    from app.services.log_service import record_error

    db = SessionLocal()
    try:
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
