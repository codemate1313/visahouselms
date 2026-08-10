from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.cache import app_cache
from app.database import get_db
from app.dependencies.auth import get_current_user, require_super_admin_or_verified_developer
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.dev import (
    AiEvaluationKeyTestIn,
    AiEvaluationSettingsIn,
    BackupSettingsIn,
    FcmSettingsIn,
    LogSettingsIn,
    PaymentGatewaySettingsIn,
    SmtpSettingsIn,
    StaticOtpSettingsIn,
    TestEmailIn,
    TestFcmIn,
)
from app.services import ai_evaluation_service, fcm_service, job_service, smtp_service
from app.services.settings_service import get_settings_group, set_setting, set_settings_group
from app.core.security import get_static_otp_code, is_static_otp_enabled

from app.config import settings as app_config

router = APIRouter(
    prefix="/super-admin/dev-settings",
    tags=["dev-settings"],
    dependencies=[Depends(require_super_admin_or_verified_developer)],
)


def _audit(db: Session, actor: User, action: str, request: Request, details=None) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            action=action,
            entity_type="settings",
            entity_id=None,
            details=details,
            ip_address=request.client.host if request.client else None,
        )
    )
    db.commit()


# ---------- SMTP ----------

@router.get("/smtp")
def get_smtp(db: Session = Depends(get_db)):
    return get_settings_group(db, "smtp")


@router.put("/smtp")
def put_smtp(
    payload: SmtpSettingsIn,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    set_settings_group(db, "smtp", payload.model_dump())
    _audit(db, actor, "dev_settings.update_smtp", request)
    return get_settings_group(db, "smtp")


@router.post("/smtp/test")
def test_smtp(payload: TestEmailIn, db: Session = Depends(get_db)):
    smtp_service.send_test_email(db, payload.to_address)
    return {"sent": True, "to": payload.to_address}


# ---------- FCM ----------

@router.get("/fcm")
def get_fcm(db: Session = Depends(get_db)):
    return fcm_service.get_config_status(db)


@router.put("/fcm")
def put_fcm(
    payload: FcmSettingsIn,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    if payload.service_account_json:
        fcm_service.validate_service_account_json(payload.service_account_json)
    set_settings_group(db, "fcm", payload.model_dump())
    _audit(db, actor, "dev_settings.update_fcm", request)
    return fcm_service.get_config_status(db)


@router.post("/fcm/test")
def test_fcm(payload: TestFcmIn, db: Session = Depends(get_db)):
    if payload.device_token:
        return fcm_service.send_test_notification(
            db, payload.device_token, "IELTS LMS", "FCM test notification"
        )
    return fcm_service.test_credentials(db)


# The D-ID video-presenter settings used to live here. That vendor integration
# was replaced by the local TTS + viseme examiner in `avatar_service`, which
# needs no API key and no configuration, so the endpoints were removed rather
# than left calling functions that no longer exist.


# ---------- AI-assisted evaluation ----------

@router.get("/ai-evaluation")
def get_ai_evaluation(db: Session = Depends(get_db)):
    return ai_evaluation_service.config_status(db)


@router.put("/ai-evaluation")
def put_ai_evaluation(
    payload: AiEvaluationSettingsIn,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    data = payload.model_dump()
    api_keys = data.pop("api_keys", None)
    set_settings_group(db, "ai", {key: str(value) if isinstance(value, bool) else value for key, value in data.items()})
    if api_keys is not None:
        ai_evaluation_service.save_configured_keys(db, api_keys)
    _audit(db, actor, "dev_settings.update_ai_evaluation", request)
    return ai_evaluation_service.config_status(db)


@router.post("/ai-evaluation/test-key")
def test_ai_evaluation_key(payload: AiEvaluationKeyTestIn, db: Session = Depends(get_db)):
    return ai_evaluation_service.test_configured_key(
        db,
        key_id=payload.key_id,
        provider=payload.provider,
        api_key=payload.api_key,
        model=payload.model,
        endpoint_url=payload.endpoint_url,
        preferred_provider=payload.preferred_provider,
    )


# ---------- Backup / log settings ----------

@router.get("/backup")
def get_backup_settings(db: Session = Depends(get_db)):
    return get_settings_group(db, "backup")


@router.put("/backup")
def put_backup_settings(
    payload: BackupSettingsIn,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    if payload.schedule and payload.schedule not in ("none", "daily", "weekly"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="schedule must be none, daily, or weekly")
    set_settings_group(db, "backup", payload.model_dump())
    _audit(db, actor, "dev_settings.update_backup", request)
    return get_settings_group(db, "backup")


@router.get("/logs")
def get_log_settings(db: Session = Depends(get_db)):
    return get_settings_group(db, "logs")


@router.put("/logs")
def put_log_settings(
    payload: LogSettingsIn,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    set_settings_group(db, "logs", payload.model_dump())
    _audit(db, actor, "dev_settings.update_logs", request)
    return get_settings_group(db, "logs")


# ---------- Maintenance actions ----------

@router.post("/migrate")
def run_migrations(
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    job = job_service.enqueue(db, "migrate")
    _audit(db, actor, "dev_settings.run_migrations", request, {"job_id": job.id})
    return {"job_id": job.id, "status": job.status}


@router.post("/clear-cache")
def clear_cache(
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    cleared = app_cache.clear_all()
    _audit(db, actor, "dev_settings.clear_cache", request, {"entries_cleared": cleared})
    return {"cleared": True, "entries_cleared": cleared}


@router.post("/storage-link")
def storage_link(
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    """Validate/create the local storage layout (Laravel storage:link equivalent
    for our direct-mount setup) and report status."""
    root = app_config.storage_path
    created = []
    # Deliberately does NOT create a "backups" folder here: this tree is served
    # publicly at /storage, and dumps carry predictable timestamp filenames.
    # Backups belong in app_config.backup_path, outside the mount.
    for sub in ("", "avatars"):
        path = root / sub if sub else root
        if not path.exists():
            path.mkdir(parents=True, exist_ok=True)
            created.append(str(path))
    if not app_config.backup_path.exists():
        app_config.backup_path.mkdir(parents=True, exist_ok=True)
        created.append(str(app_config.backup_path))
    writable = True
    try:
        probe = root / ".write_probe"
        probe.write_text("ok")
        probe.unlink()
    except OSError:
        writable = False
    _audit(db, actor, "dev_settings.storage_link", request)
    return {
        "storage_root": str(root),
        "mounted_at": "/storage",
        "writable": writable,
        "created": created,
    }


@router.post("/seed")
def seed_sample_data(
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    """Seed sample institutes, demo accounts, and assessment modules for local testing."""
    import sys
    from pathlib import Path
    root_dir = Path(__file__).resolve().parent.parent.parent
    if str(root_dir) not in sys.path:
        sys.path.insert(0, str(root_dir))

    from scripts.seed_dummy_modules import (
        COMPOSITE_MODULE_TYPES,
        SKILL_MODULE_TYPES,
        _create_module,
        _get_or_create_instructor,
    )
    from scripts.seed_cms_and_seo import seed_cms_and_seo

    instructor = _get_or_create_instructor(db)
    created_modules = 0
    for module_type in (*SKILL_MODULE_TYPES, *COMPOSITE_MODULE_TYPES):
        if _create_module(db, instructor, module_type):
            created_modules += 1

    db.commit()

    # Seed testing blogs, testimonials, and SEO settings
    seed_cms_and_seo()

    _audit(db, actor, "dev_settings.seed_data", request, {"created_modules": created_modules})
    return {
        "success": True,
        "message": "Sample seed data (modules, testing blogs, testimonials, SEO) successfully populated!",
        "instructor_email": instructor.email,
        "created_modules": created_modules,
        "module_types": [*SKILL_MODULE_TYPES, *COMPOSITE_MODULE_TYPES],
    }


@router.get("/jobs/{job_id}")
def job_status(job_id: int, db: Session = Depends(get_db)):
    job = job_service.get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return {
        "id": job.id,
        "type": job.type,
        "status": job.status,
        "result": job.result,
        "created_at": job.created_at,
        "started_at": job.started_at,
        "finished_at": job.finished_at,
    }



# ---------- Payment Gateways (Razorpay & Stripe) ----------

# NOTE: More-specific sub-routes must be declared BEFORE the base /payment-gateways GET,
# otherwise FastAPI may shadow them.

@router.get("/payment-gateways/status")
def get_payment_gateways_status(db: Session = Depends(get_db)):
    gw_settings = get_settings_group(db, "payment_gateways", mask_secrets=False)

    razorpay_key = gw_settings.get("razorpay_key_id")
    razorpay_secret = gw_settings.get("razorpay_key_secret")
    stripe_sec = gw_settings.get("stripe_secret_key")

    razorpay_status = "not_configured"
    if razorpay_key and razorpay_secret:
        try:
            import requests as req_lib
            res = req_lib.get(
                "https://api.razorpay.com/v1/orders?count=1",
                auth=(razorpay_key, razorpay_secret),
                timeout=5,
            )
            razorpay_status = "success" if res.status_code == 200 else "failed"
        except Exception:
            razorpay_status = "failed"

    stripe_status = "not_configured"
    if stripe_sec:
        try:
            import urllib.request as urllib_req
            req2 = urllib_req.Request("https://api.stripe.com/v1/balance")
            req2.add_header("Authorization", f"Bearer {stripe_sec}")
            with urllib_req.urlopen(req2, timeout=5) as resp:
                stripe_status = "success" if resp.status == 200 else "failed"
        except Exception:
            stripe_status = "failed"

    return {"razorpay": razorpay_status, "stripe": stripe_status}


@router.post("/payment-gateways/test-connection")
def test_payment_gateways_connection(payload: PaymentGatewaySettingsIn, db: Session = Depends(get_db)):
    data = payload.model_dump()

    razorpay_key = data.get("razorpay_key_id")
    razorpay_secret = data.get("razorpay_key_secret")
    if razorpay_secret == "********" or not razorpay_secret:
        stored = get_settings_group(db, "payment_gateways", mask_secrets=False)
        razorpay_secret = stored.get("razorpay_key_secret")

    stripe_sec = data.get("stripe_secret_key")
    if stripe_sec == "********" or not stripe_sec:
        stored = get_settings_group(db, "payment_gateways", mask_secrets=False)
        stripe_sec = stored.get("stripe_secret_key")

    razorpay_status = "not_configured"
    if razorpay_key and razorpay_secret:
        try:
            import requests as req_lib
            res = req_lib.get(
                "https://api.razorpay.com/v1/orders?count=1",
                auth=(razorpay_key, razorpay_secret),
                timeout=5,
            )
            razorpay_status = "success" if res.status_code == 200 else "failed"
        except Exception:
            razorpay_status = "failed"

    stripe_status = "not_configured"
    if stripe_sec:
        try:
            import urllib.request as urllib_req
            req2 = urllib_req.Request("https://api.stripe.com/v1/balance")
            req2.add_header("Authorization", f"Bearer {stripe_sec}")
            with urllib_req.urlopen(req2, timeout=5) as resp:
                stripe_status = "success" if resp.status == 200 else "failed"
        except Exception:
            stripe_status = "failed"

    return {"razorpay": razorpay_status, "stripe": stripe_status}


@router.get("/payment-gateways")
def get_payment_gateways(db: Session = Depends(get_db)):
    return get_settings_group(db, "payment_gateways")


@router.put("/payment-gateways")
def put_payment_gateways(
    payload: PaymentGatewaySettingsIn,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    data = payload.model_dump()
    # Convert booleans to string for storage in setting table
    data["razorpay_enabled"] = "true" if data.get("razorpay_enabled") else "false"
    data["stripe_enabled"] = "true" if data.get("stripe_enabled") else "false"

    set_settings_group(db, "payment_gateways", data)
    _audit(db, actor, "dev_settings.update_payment_gateways", request)
    return get_settings_group(db, "payment_gateways")


# ---------- STATIC TESTING OTP ----------

@router.get("/static-otp")
def get_static_otp(db: Session = Depends(get_db)):
    return {
        "enabled": is_static_otp_enabled(db),
        "code": get_static_otp_code(db),
    }


@router.put("/static-otp")
def put_static_otp(
    payload: StaticOtpSettingsIn,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    # Refuse rather than accept-and-ignore: is_static_otp_enabled() hard-disables
    # the bypass in production, so silently storing "true" would leave the switch
    # reading as on while every login still demands a real OTP.
    if payload.enabled and app_config.app_environment == "production":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The static testing OTP cannot be enabled in production.",
        )
    set_setting(db, "testing.static_otp_enabled", "true" if payload.enabled else "false")
    if payload.code and payload.code.strip():
        set_setting(db, "testing.static_otp_code", payload.code.strip())
    _audit(db, actor, "dev_settings.update_static_otp", request)
    return {
        "enabled": is_static_otp_enabled(db),
        "code": get_static_otp_code(db),
    }

