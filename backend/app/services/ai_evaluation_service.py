import base64
import json
import logging
import mimetypes
import re
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models.attempt import (
    AiEvaluation,
    AiEvaluationLimit,
    AttemptPartGrade,
    PART_GRADE_AI_GRADED,
    PART_GRADE_PENDING,
    TestAttempt,
)
from app.models.exam_module import ExamModulePart
from app.models.user import User
from app.services import cefr_service
from app.services.settings_service import get_setting

from app.models.institute import Institute

logger = logging.getLogger(__name__)

DEFAULT_MONTHLY_LIMIT = 100
# A 429 means "too many requests this minute", so moving straight to the next
# key or the fallback model just spends another request into the same closed
# window. These pauses are deliberately short: the caller is a background job,
# but the student is watching a spinner.
RATE_LIMIT_RETRY_SECONDS = 4.0
RATE_LIMIT_KEY_SWITCH_SECONDS = 2.0
# How long an in-flight evaluation row blocks a duplicate request for the same
# part. Long enough to cover a slow provider call, short enough that a crashed
# worker cannot wedge a part for ever.
IN_FLIGHT_WINDOW_SECONDS = 300
DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
MASKED_SECRET = "********"
SUPPORTED_KEY_PROVIDERS = {"gemini", "custom_json", "openai"}
GEMINI_EVALUATION_MODELS = {
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
    "gemini-flash-latest",
    "gemini-pro-latest",
}
OPENAI_EVALUATION_MODEL_PREFIXES = (
    "gpt-5",
    "gpt-4.1",
    "gpt-4o",
    "o4",
    "o3",
)


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def config_status(db: Session) -> dict:
    db_enabled = get_setting(db, "ai.enabled")
    enabled = (db_enabled.lower() == "true") if db_enabled is not None else settings.ai_enabled
    
    provider = get_setting(db, "ai.provider") or settings.ai_provider or "gemini"
    model = get_setting(db, "ai.model") or settings.ai_model or DEFAULT_GEMINI_MODEL
    endpoint = get_setting(db, "ai.endpoint_url") or settings.ai_endpoint_url
    api_key = get_setting(db, "ai.api_key") or settings.ai_api_key
    monthly_limit_str = get_setting(db, "ai.monthly_limit")
    monthly_limit = int(monthly_limit_str) if monthly_limit_str else DEFAULT_MONTHLY_LIMIT

    api_keys = _configured_keys(db, mask=True)
    live_keys = [item for item in _configured_keys(db, mask=False) if item.get("enabled", True)]

    if provider in ("gemini", "openai"):
        configured = bool(enabled and (live_keys or api_key))
    elif provider == "custom_json":
        configured = bool(enabled and ((endpoint and api_key) or live_keys))
    else:
        configured = False

    return {
        "enabled": enabled,
        "provider": provider,
        "endpoint_url": endpoint,
        "model": model,
        "monthly_limit": monthly_limit,
        "configured": configured,
        "api_key": "********" if api_key else None,
        "api_keys": api_keys,
        "api_key_count": len([item for item in api_keys if item.get("enabled", True)]),
    }


def _config(db: Session) -> dict:
    status = config_status(db)
    if not status["configured"]:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI evaluation is not enabled or fully configured")
    status["api_key"] = get_setting(db, "ai.api_key") or settings.ai_api_key
    return status


def _mask_key(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    if value == MASKED_SECRET:
        return MASKED_SECRET
    if len(value) <= 8:
        return MASKED_SECRET
    return f"{value[:4]}...{value[-4:]}"


def _is_masked_key_input(value: str) -> bool:
    return value == MASKED_SECRET or "..." in value


def _provider_label(provider: str) -> str:
    return {
        "gemini": "Google Gemini",
        "custom_json": "Custom JSON evaluator",
        "openai": "OpenAI",
        "anthropic": "Anthropic Claude",
        "unknown": "Unknown provider",
    }.get(provider, provider.replace("_", " ").title())


def _detect_provider(
    *,
    api_key: str,
    endpoint_url: Optional[str],
    preferred_provider: Optional[str],
) -> dict:
    secret = (api_key or "").strip()
    endpoint = (endpoint_url or "").strip()
    preferred = (preferred_provider or "").strip() or None
    parsed = urlparse(endpoint) if endpoint else None
    host = (parsed.netloc if parsed else "").lower()

    if preferred == "custom_json" and endpoint:
        provider = "custom_json"
        reason = "Using selected Custom JSON evaluator endpoint."
    elif secret.startswith(("AIza", "AQ.")):
        provider = "gemini"
        reason = "Detected Google API key format used by Gemini."
    elif secret.startswith("sk-ant-"):
        provider = "anthropic"
        reason = "Detected Anthropic Claude key format."
    elif secret.startswith(("sk-proj-", "sk-")):
        provider = "openai"
        reason = "Detected OpenAI key format."
    elif endpoint and "generativelanguage.googleapis.com" in host:
        provider = "gemini"
        reason = "Detected Google Gemini endpoint."
    elif endpoint:
        provider = "custom_json"
        reason = "Detected a custom HTTP evaluator endpoint."
    elif preferred in SUPPORTED_KEY_PROVIDERS:
        provider = preferred
        reason = f"No provider-specific key prefix was detected; using selected {_provider_label(provider)} provider."
    else:
        provider = "unknown"
        reason = "No supported provider pattern was detected."

    supported = provider in SUPPORTED_KEY_PROVIDERS
    if not supported:
        reason = (
            f"{reason} This evaluator currently supports Google Gemini, OpenAI, and Custom JSON evaluator endpoints."
        )
    return {
        "provider": provider,
        "provider_label": _provider_label(provider),
        "supported": supported,
        "reason": reason,
    }


def _model_label(name: str, display_name: Optional[str] = None) -> str:
    model = name.removeprefix("models/")
    return (display_name or model).strip()


def _model_option(name: str, display_name: Optional[str] = None) -> dict:
    model = name.removeprefix("models/")
    return {"value": model, "label": _model_label(model, display_name)}


def _default_model(provider: str) -> str:
    if provider == "openai":
        return DEFAULT_OPENAI_MODEL
    if provider == "gemini":
        return DEFAULT_GEMINI_MODEL
    if provider == "custom_json":
        return ""
    return ""


def _model_matches_provider(provider: str, model: Optional[str]) -> bool:
    value = (model or "").removeprefix("models/")
    if not value:
        return False
    if provider == "gemini":
        return value.startswith("gemini-")
    if provider == "openai":
        return value.startswith(OPENAI_EVALUATION_MODEL_PREFIXES)
    if provider == "custom_json":
        return True
    return False


def _resolve_model_for_provider(provider: str, model: Optional[str]) -> str:
    value = (model or "").removeprefix("models/")
    return value if _model_matches_provider(provider, value) else _default_model(provider)


def _default_model_options(provider: str, model: Optional[str] = None) -> list[dict]:
    if provider == "gemini":
        selected = _resolve_model_for_provider(provider, model)
        values = [selected, DEFAULT_GEMINI_MODEL, "gemini-flash-latest"]
        return [_model_option(value) for value in dict.fromkeys(value for value in values if value)]
    if provider == "openai":
        selected = _resolve_model_for_provider(provider, model)
        values = [selected, DEFAULT_OPENAI_MODEL]
        return [_model_option(value) for value in dict.fromkeys(value for value in values if value)]
    if provider == "custom_json" and model:
        return [_model_option(model)]
    return []


def list_evaluation_models(
    *,
    provider: str,
    api_key: str,
    model: Optional[str] = None,
    endpoint_url: Optional[str] = None,
) -> list[dict]:
    if provider != "gemini":
        if provider == "openai":
            try:
                with httpx.Client(timeout=15.0) as client:
                    response = client.get(
                        "https://api.openai.com/v1/models",
                        headers={"Authorization": f"Bearer {api_key}"},
                    )
                    response.raise_for_status()
                    data = response.json()
            except Exception as exc:
                logger.warning("Could not list OpenAI models for AI evaluation: %s", exc)
                return _default_model_options(provider, model)

            options = []
            for item in data.get("data", []):
                model_id = str(item.get("id") or "")
                if not model_id.startswith(OPENAI_EVALUATION_MODEL_PREFIXES):
                    continue
                if any(skip in model_id for skip in ("audio", "realtime", "transcribe", "tts", "image")):
                    continue
                options.append(_model_option(model_id))
            selected = _resolve_model_for_provider(provider, model)
            if selected and not any(option["value"] == selected for option in options):
                options.insert(0, _model_option(selected))
            return options or _default_model_options(provider, model)
        return _default_model_options(provider, model)

    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.get(
                f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
            )
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        logger.warning("Could not list Gemini models for AI evaluation: %s", exc)
        return _default_model_options(provider, model)

    options = []
    for item in data.get("models", []):
        name = str(item.get("name") or "")
        model_id = name.removeprefix("models/")
        methods = set(item.get("supportedGenerationMethods") or [])
        if not model_id or "generateContent" not in methods:
            continue
        if model_id not in GEMINI_EVALUATION_MODELS and not (
            model_id.startswith("gemini-") and ("flash" in model_id or "pro" in model_id)
        ):
            continue
        options.append(_model_option(model_id, item.get("displayName")))

    selected = (model or DEFAULT_GEMINI_MODEL).removeprefix("models/")
    if selected and not any(option["value"] == selected for option in options):
        options.insert(0, _model_option(selected))
    return options or _default_model_options(provider, model)


def _configured_keys(db: Session, *, mask: bool) -> list[dict]:
    raw = get_setting(db, "ai.api_keys")
    keys: list[dict] = []
    if raw:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                for index, item in enumerate(parsed):
                    if not isinstance(item, dict):
                        continue
                    api_key = str(item.get("api_key") or "").strip()
                    if not api_key:
                        continue
                    keys.append({
                        "id": str(item.get("id") or f"key-{index + 1}"),
                        "label": str(item.get("label") or f"API Key {index + 1}"),
                        "provider": str(item.get("provider") or "gemini"),
                        "model": str(item.get("model") or ""),
                        "endpoint_url": str(item.get("endpoint_url") or ""),
                        "api_key": MASKED_SECRET if mask else api_key,
                        "enabled": bool(item.get("enabled", True)),
                        "priority": int(item.get("priority", index + 1)),
                        "last_status": item.get("last_status"),
                        "last_checked_at": item.get("last_checked_at"),
                        "info": item.get("info"),
                        "model_options": item.get("model_options") if isinstance(item.get("model_options"), list) else [],
                    })
        except (TypeError, ValueError, json.JSONDecodeError):
            logger.warning("Ignoring malformed ai.api_keys setting")
    return sorted(keys, key=lambda item: item.get("priority") or 9999)


def save_configured_keys(db: Session, keys: list[dict]) -> None:
    from app.services.settings_service import set_setting

    existing_by_id = {item["id"]: item for item in _configured_keys(db, mask=False)}
    normalized = []
    for index, item in enumerate(keys):
        if not isinstance(item, dict):
            continue
        key_id = str(item.get("id") or f"key-{int(time.time() * 1000)}-{index}")
        api_key = str(item.get("api_key") or "").strip()
        if _is_masked_key_input(api_key) or not api_key:
            api_key = existing_by_id.get(key_id, {}).get("api_key", "")
        if not api_key:
            continue
        selected_provider = str(item.get("provider") or "gemini")
        endpoint_url = str(item.get("endpoint_url") or "").strip()[:500]
        detected = _detect_provider(
            api_key=api_key,
            endpoint_url=endpoint_url,
            preferred_provider=selected_provider,
        )
        provider = detected["provider"] if detected["supported"] or detected["provider"] != "unknown" else selected_provider
        model = _resolve_model_for_provider(provider, str(item.get("model") or "").strip()[:120])
        normalized.append({
            "id": key_id,
            "label": str(item.get("label") or f"API Key {index + 1}").strip()[:80],
            "provider": provider,
            "model": model,
            "endpoint_url": endpoint_url,
            "api_key": api_key,
            "enabled": bool(item.get("enabled", True)),
            "priority": index + 1,
            "last_status": item.get("last_status"),
            "last_checked_at": item.get("last_checked_at"),
            "info": item.get("info"),
            "model_options": item.get("model_options") if isinstance(item.get("model_options"), list) else [],
        })
    set_setting(db, "ai.api_keys", json.dumps(normalized) if normalized else None)


def _candidate_configs(db: Session) -> list[dict]:
    base = _config(db)
    candidates = []
    for item in _configured_keys(db, mask=False):
        if not item.get("enabled", True):
            continue
        provider = item.get("provider") or base["provider"]
        if provider not in SUPPORTED_KEY_PROVIDERS:
            continue
        candidates.append({
            **base,
            "provider": provider,
            "model": item.get("model") or base.get("model"),
            "endpoint_url": item.get("endpoint_url") or base.get("endpoint_url"),
            "api_key": item["api_key"],
            "key_id": item.get("id"),
            "key_label": item.get("label"),
        })
    if candidates:
        return candidates
    return [{**base, "key_id": "legacy", "key_label": "Primary API Key"}]


def test_connection(
    *,
    provider: str,
    api_key: str,
    model: Optional[str] = None,
    endpoint_url: Optional[str] = None,
    evaluator: Optional[Callable[[dict, dict], dict]] = None,
) -> dict:
    started = time.monotonic()
    config = {
        "provider": provider,
        "api_key": api_key,
        "model": _resolve_model_for_provider(provider, model),
        "endpoint_url": endpoint_url,
    }
    payload = {
        "task": "connection_test",
        "framework": cefr_service.FRAMEWORK_VERSION,
        "policy_version": cefr_service.POLICY_VERSION,
        "skill": "writing",
        "part": {"title": "Connection test", "skill_focus": "Connectivity"},
        "rubric": [{"criterion": "Connection", "max_marks": "1"}],
        "responses": [{"prompt": "Reply with valid JSON.", "text": "This is a connection test."}],
        "instructions": (
            "Return JSON ONLY with one criterion named Connection, marks_awarded 1, "
            "a short comment, and confidence 1."
        ),
    }
    try:
        raw = (evaluator or _remote_evaluator)(config, payload)
        elapsed_ms = int((time.monotonic() - started) * 1000)
        _normalize(raw, type("Part", (), {"rubric": payload["rubric"]})())
        model_options = list_evaluation_models(
            provider=provider,
            api_key=api_key,
            model=config["model"],
            endpoint_url=endpoint_url,
        )
        return {
            "ok": True,
            "provider": provider,
            "provider_label": _provider_label(provider),
            "detected_provider": provider,
            "model": config["model"],
            "model_options": model_options,
            "key_preview": _mask_key(api_key),
            "latency_ms": elapsed_ms,
            "supported": True,
            "message": f"{_provider_label(provider)} accepted the key and returned valid evaluator JSON.",
        }
    except Exception as exc:
        elapsed_ms = int((time.monotonic() - started) * 1000)
        return {
            "ok": False,
            "provider": provider,
            "provider_label": _provider_label(provider),
            "detected_provider": provider,
            "model": config["model"],
            "model_options": _default_model_options(provider, config["model"]),
            "key_preview": _mask_key(api_key),
            "latency_ms": elapsed_ms,
            "supported": provider in SUPPORTED_KEY_PROVIDERS,
            "message": str(getattr(exc, "detail", exc))[:500],
        }


def test_configured_key(
    db: Session,
    *,
    key_id: Optional[str],
    provider: str,
    api_key: Optional[str],
    model: Optional[str] = None,
    endpoint_url: Optional[str] = None,
    preferred_provider: Optional[str] = None,
) -> dict:
    secret = (api_key or "").strip()
    stored = None
    if key_id:
        stored = next((item for item in _configured_keys(db, mask=False) if item.get("id") == key_id), None)
    if not secret or _is_masked_key_input(secret):
        secret = (stored or {}).get("api_key") or ""
    if not secret:
        return {
            "ok": False,
            "provider": provider,
            "provider_label": _provider_label(provider),
            "detected_provider": provider,
            "model": _resolve_model_for_provider(provider, model),
            "model_options": [],
            "key_preview": None,
            "latency_ms": 0,
            "supported": provider in SUPPORTED_KEY_PROVIDERS,
            "message": "Enter or select a saved API key before testing.",
        }
    detected = _detect_provider(
        api_key=secret,
        endpoint_url=endpoint_url or (stored or {}).get("endpoint_url"),
        preferred_provider=preferred_provider or provider or (stored or {}).get("provider"),
    )
    if not detected["supported"]:
        return {
            "ok": False,
            "provider": detected["provider"],
            "provider_label": detected["provider_label"],
            "detected_provider": detected["provider"],
            "model": _resolve_model_for_provider(detected["provider"], model or (stored or {}).get("model")),
            "model_options": [],
            "key_preview": _mask_key(secret),
            "latency_ms": 0,
            "supported": False,
            "message": detected["reason"],
        }
    return test_connection(
        provider=detected["provider"],
        api_key=secret,
        model=_resolve_model_for_provider(detected["provider"], model or (stored or {}).get("model")),
        endpoint_url=endpoint_url or (stored or {}).get("endpoint_url"),
    ) | {
        "detected_provider": detected["provider"],
        "provider_label": detected["provider_label"],
        "detection_message": detected["reason"],
    }


def _bucket(
    db: Session,
    scope: str,
    period: str,
    effective_limit: int,
    institute_id: Optional[int],
    user_id: Optional[int],
) -> AiEvaluationLimit:
    """Fetch-or-create one monthly counter, re-syncing its ceiling so limit
    changes take effect mid-period without waiting for the next month."""
    row = db.query(AiEvaluationLimit).filter(AiEvaluationLimit.scope_key == scope).with_for_update().first()
    if row is None:
        row = AiEvaluationLimit(
            scope_key=scope,
            institute_id=institute_id,
            user_id=user_id,
            period_key=period,
            monthly_limit=effective_limit,
            used_count=0,
        )
        db.add(row)
        db.flush()
    else:
        row.monthly_limit = effective_limit
        if row.user_id is None and user_id is not None:
            row.user_id = user_id
    return row


def _direct_student_limit(db: Session, user_id: int, platform_default: int) -> int:
    """A direct (B2C) student's monthly ceiling comes from their subscribed
    plan's `ai_evaluation_limit` (set by the Super Admin when authoring the
    plan). Direct students without an active subscription receive 0 quota."""
    from app.services.subscription_service import STATE_ACTIVE, STATE_GRACE, current_user_subscription

    subscription, state = current_user_subscription(db, user_id)
    if subscription is not None and state in (STATE_ACTIVE, STATE_GRACE) and subscription.plan is not None:
        limit = subscription.plan.ai_evaluation_limit
        if limit is not None and limit > 0:
            return limit
        return platform_default
    return 0


def _limit_rows(db: Session, attempt: TestAttempt, monthly_limit: int) -> list[AiEvaluationLimit]:
    """Every student - institute or direct - is still metered individually
    against their own monthly bucket for usage-reporting purposes (the
    quota dashboards read these rows), but no cap is enforced here - AI
    evaluation is never blocked for any student or module."""
    period = _now().strftime("%Y-%m")
    institute_id = attempt.user.institute_id

    if not institute_id:
        student_limit = _direct_student_limit(db, attempt.user_id, monthly_limit)
        student = _bucket(
            db, f"direct_student:{attempt.user_id}:{period}", period, student_limit, None, attempt.user_id
        )
        return [student]

    inst = db.query(Institute).filter(Institute.id == institute_id).first()
    student_limit = monthly_limit
    if inst and inst.ai_student_monthly_limit is not None and inst.ai_student_monthly_limit > 0:
        student_limit = inst.ai_student_monthly_limit

    student = _bucket(
        db, f"student:{attempt.user_id}:{period}", period, student_limit, institute_id, attempt.user_id
    )
    return [student]


def get_student_ai_quota_summary(db: Session, user: User) -> dict:
    """Returns AI evaluation quota & usage for a student for the current month,
    along with total AI evaluations completed/received across all time."""
    status = config_status(db)
    monthly_limit = status["monthly_limit"]
    period = _now().strftime("%Y-%m")
    institute_id = user.institute_id

    if not institute_id:
        student_limit = _direct_student_limit(db, user.id, monthly_limit)
        scope = f"direct_student:{user.id}:{period}"
    else:
        inst = db.query(Institute).filter(Institute.id == institute_id).first()
        student_limit = (
            inst.ai_student_monthly_limit
            if (inst and inst.ai_student_monthly_limit is not None and inst.ai_student_monthly_limit > 0)
            else monthly_limit
        )
        scope = f"student:{user.id}:{period}"

    row = db.query(AiEvaluationLimit).filter(AiEvaluationLimit.scope_key == scope).first()
    stored_used = row.used_count if row else 0

    period_start = datetime.strptime(f"{period}-01", "%Y-%m-%d")
    current_month_count = (
        db.query(AiEvaluation)
        .join(TestAttempt, TestAttempt.id == AiEvaluation.attempt_id)
        .filter(
            TestAttempt.user_id == user.id,
            AiEvaluation.status != "failed",
            AiEvaluation.created_at >= period_start,
        )
        .count()
    )
    used_count = max(stored_used, current_month_count)

    effective_limit = row.monthly_limit if (row and row.monthly_limit) else student_limit
    evaluations_left = max(0, effective_limit - used_count)

    total_evaluations_got = (
        db.query(AiEvaluation)
        .join(TestAttempt, TestAttempt.id == AiEvaluation.attempt_id)
        .filter(TestAttempt.user_id == user.id, AiEvaluation.status != "failed")
        .count()
    )

    return {
        "ai_evaluations_used": used_count,
        "ai_evaluations_limit": effective_limit,
        "ai_evaluations_left": evaluations_left,
        "ai_evaluations_got": total_evaluations_got,
        "ai_enabled": status["configured"],
    }


def get_student_ai_evaluation_history(db: Session, user: User) -> dict:
    """Returns detailed history of all AI evaluations requested/used by the student,
    along with their quota summary."""
    try:
        quota = get_student_ai_quota_summary(db, user)
        period = _now().strftime("%Y-%m")

        evaluations = (
            db.query(AiEvaluation)
            .join(TestAttempt, TestAttempt.id == AiEvaluation.attempt_id)
            .filter(TestAttempt.user_id == user.id)
            .order_by(AiEvaluation.created_at.desc())
            .all()
        )

        history = []
        for ev in evaluations:
            attempt = getattr(ev, "attempt", None)
            module = getattr(attempt, "module", None) if attempt else None
            part = getattr(ev, "part", None)
            created_at_dt = getattr(ev, "created_at", None)
            is_current_month = bool(created_at_dt and created_at_dt.strftime("%Y-%m") == period)

            history.append({
                "id": ev.id,
                "attempt_id": ev.attempt_id,
                "module_id": getattr(attempt, "module_id", None) if attempt else None,
                "module_title": getattr(module, "title", "Unknown Test") if module else "Unknown Test",
                "module_type": getattr(module, "module_type", None) if module else None,
                "part_id": ev.part_id,
                "part_title": getattr(part, "title", f"Part {ev.part_id}") if part else f"Part {ev.part_id}",
                "section_type": getattr(part, "section_type", None) if part else None,
                "status": getattr(ev, "status", "completed"),
                "provider": getattr(ev, "provider", "ai"),
                "model": getattr(ev, "model", None),
                "created_at": created_at_dt.isoformat() if created_at_dt else None,
                "overall_band": str(attempt.overall_band) if (attempt and getattr(attempt, "overall_band", None)) else None,
                "is_current_month": is_current_month,
            })

        quota["ai_evaluations_got"] = len(history)

        return {
            "quota": quota,
            "history": history,
        }
    except Exception as exc:
        logger.exception("Error fetching AI evaluation history for user %s: %s", getattr(user, "id", None), exc)
        return {
            "quota": get_student_ai_quota_summary(db, user),
            "history": [],
        }


def _payload(attempt: TestAttempt, part: ExamModulePart) -> dict:
    answers = {answer.question_id: answer for answer in attempt.answers}
    responses = []
    
    for question in sorted(part.questions, key=lambda item: item.sort_order):
        answer = answers.get(question.id)
        if not answer:
            continue
            
        text_resp = (answer.response or {}).get("text") if answer.response else None
        audio_path = answer.audio_path
        
        if part.section_type == "speaking" and audio_path:
            full_path = settings.storage_path / audio_path
            if full_path.exists():
                audio_bytes = full_path.read_bytes()
                mime_type, _ = mimetypes.guess_type(str(full_path))
                if not mime_type:
                    ext = full_path.suffix.lower()
                    if ext == ".webm":
                        mime_type = "audio/webm"
                    elif ext in (".mp3", ".mpeg"):
                        mime_type = "audio/mp3"
                    elif ext == ".wav":
                        mime_type = "audio/wav"
                    else:
                        mime_type = "audio/webm"
                
                # Max 10MB audio inline payload safeguard
                if len(audio_bytes) <= 10 * 1024 * 1024:
                    responses.append({
                        "prompt": question.prompt,
                        "audio_b64": base64.b64encode(audio_bytes).decode("utf-8"),
                        "mime_type": mime_type,
                    })
        elif text_resp:
            responses.append({
                "prompt": question.prompt,
                "text": str(text_resp)[:12000],
            })

    if not responses:
        if part.section_type == "speaking":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No audio recording found for this Speaking part to evaluate",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No textual response found for this Writing part to evaluate",
            )

    return {
        "task": "cefr_rubric_evaluation",
        "framework": cefr_service.FRAMEWORK_VERSION,
        "policy_version": cefr_service.POLICY_VERSION,
        "skill": part.section_type,
        "part": {"title": part.title, "skill_focus": part.skill_focus},
        "rubric": part.rubric or [],
        "responses": responses,
        "instructions": (
            "You are an expert Language CERT and CEFR language examiner. "
            "Analyze the student's submission carefully against the provided rubric criteria. "
            "Return JSON ONLY matching the required schema. "
            "Score EVERY rubric criterion strictly between 0 and its max_marks. "
            "Provide a brief, evidence-based rationale for each criterion, an overall examiner summary comment, "
            "and a confidence rating between 0 and 1. "
            "This is an advisory draft requiring human instructor review."
        ),
    }


def _request_summary(payload: dict, config: dict) -> dict:
    """A readable record of what was sent, for the AI evaluation log.

    Deliberately a description and not a copy: a Speaking request carries the
    recording as base64, and nobody needs megabytes of that in a log row."""
    submissions = []
    for item in payload.get("responses", []):
        if "audio_b64" in item:
            submissions.append({
                "prompt": str(item.get("prompt") or "")[:300],
                "kind": "audio",
                # base64 inflates by 4/3; report what the recording weighs.
                "audio_kb": round(len(item["audio_b64"]) * 3 / 4 / 1024),
                "format": item.get("mime_type"),
            })
        else:
            text = str(item.get("text") or "")
            submissions.append({
                "prompt": str(item.get("prompt") or "")[:300],
                "kind": "text",
                "words": len(text.split()),
                "characters": len(text),
            })
    return {
        "provider": config.get("provider"),
        "model": config.get("model"),
        "key_label": config.get("key_label"),
        "skill": payload.get("skill"),
        "part_title": payload.get("part", {}).get("title"),
        "skill_focus": payload.get("part", {}).get("skill_focus"),
        "criteria": [
            {"criterion": item.get("criterion"), "max_marks": str(item.get("max_marks"))}
            for item in payload.get("rubric", [])
        ],
        "submissions": submissions,
    }


def _gemini_response_schema(rubric: list) -> Optional[dict]:
    """OpenAPI-subset schema Gemini validates its own JSON against.

    The criterion enum is the point: it makes the model return the rubric's
    exact labels instead of its own wording for them."""
    names = [str(item.get("criterion")) for item in (rubric or []) if item.get("criterion")]
    if not names:
        return None
    return {
        "type": "OBJECT",
        "properties": {
            "criteria": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "criterion": {"type": "STRING", "enum": names},
                        "marks_awarded": {"type": "NUMBER"},
                        "rationale": {"type": "STRING"},
                    },
                    "required": ["criterion", "marks_awarded", "rationale"],
                },
            },
            "comment": {"type": "STRING"},
            "confidence": {"type": "NUMBER"},
        },
        "required": ["criteria", "comment", "confidence"],
    }


def _gemini_evaluator(config: dict, payload: dict) -> dict:
    api_key = config["api_key"]
    model = config.get("model") or DEFAULT_GEMINI_MODEL
    if model in ("gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.5"):
        model = "gemini-2.0-flash"
    if model.startswith("models/"):
        model = model[len("models/"):]
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    # Build Gemini request prompt & contents
    prompt_text = (
        f"Framework: {payload['framework']} ({payload['policy_version']})\n"
        f"Skill: {payload['skill'].upper()}\n"
        f"Part Title: {payload['part']['title']}\n"
        f"Skill Focus: {payload['part']['skill_focus']}\n\n"
        f"Rubric Criteria:\n"
        + "\n".join(
            f"- {item['criterion']}: Max Marks = {item['max_marks']}"
            for item in payload["rubric"]
        )
        + "\n\nInstructions:\n"
        + payload["instructions"]
        + "\n\nREQUIRED JSON RESPONSE SCHEMA:\n"
        "{\n"
        '  "criteria": [\n'
        '    {"criterion": "string", "marks_awarded": number, "rationale": "string"}\n'
        "  ],\n"
        '  "comment": "string",\n'
        '  "confidence": number\n'
        "}\n\n"
    )

    parts = []
    for resp in payload["responses"]:
        parts.append({"text": f"Question Prompt: {resp['prompt']}\n"})
        if "audio_b64" in resp:
            parts.append({
                "inlineData": {
                    "mimeType": resp["mime_type"],
                    "data": resp["audio_b64"],
                }
            })
            parts.append({"text": "Please evaluate the audio recording above.\n"})
        elif "text" in resp:
            parts.append({"text": f"Student Response:\n{resp['text']}\n"})

    parts.insert(0, {"text": prompt_text})

    generation_config = {
        "responseMimeType": "application/json",
        "temperature": 0.2,
    }
    # Pin the criterion names to the rubric's own spelling. Asking for JSON
    # without a schema left the model free to rename a criterion, and
    # `_normalize` then rejected an otherwise perfect evaluation.
    schema = _gemini_response_schema(payload["rubric"])
    if schema:
        generation_config["responseSchema"] = schema

    gemini_payload = {
        "contents": [{"parts": parts}],
        "generationConfig": generation_config,
    }

    headers = {"Content-Type": "application/json"}
    
    with httpx.Client(timeout=45.0) as client:
        res = client.post(url, headers=headers, json=gemini_payload)

        # A schema this endpoint will not accept must not cost the student
        # their evaluation - drop it and ask again in the original shape.
        if res.status_code == 400 and "responseSchema" in generation_config:
            logger.info("Gemini rejected the response schema; retrying without it")
            generation_config.pop("responseSchema")
            res = client.post(url, headers=headers, json=gemini_payload)

        if res.status_code == 429 and model != "gemini-flash-latest":
            logger.info("Primary Gemini model %s returned 429, falling back to gemini-flash-latest", model)
            # Retrying inside the same minute just spends another request into
            # a window that is already closed.
            time.sleep(RATE_LIMIT_RETRY_SECONDS)
            fallback_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={api_key}"
            res = client.post(fallback_url, headers=headers, json=gemini_payload)

        if res.status_code == 429:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Google Gemini API rate limit reached (15 RPM free tier limit). Please wait a moment and try again.",
            )
        
        res.raise_for_status()
        data = res.json()

    try:
        candidate_text = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(candidate_text)
        return parsed
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        logger.error("Failed to parse Gemini response: %s | Raw: %s", exc, data)
        raise ValueError(f"Gemini API returned unparseable output: {exc}") from exc


def _evaluation_prompt(payload: dict) -> str:
    return (
        f"Framework: {payload['framework']} ({payload['policy_version']})\n"
        f"Skill: {payload['skill'].upper()}\n"
        f"Part Title: {payload['part']['title']}\n"
        f"Skill Focus: {payload['part']['skill_focus']}\n\n"
        f"Rubric Criteria:\n"
        + "\n".join(
            f"- {item['criterion']}: Max Marks = {item['max_marks']}"
            for item in payload["rubric"]
        )
        + "\n\nInstructions:\n"
        + payload["instructions"]
        + "\n\nReturn JSON only with this schema:\n"
        "{\n"
        '  "criteria": [\n'
        '    {"criterion": "string", "marks_awarded": number, "rationale": "string"}\n'
        "  ],\n"
        '  "comment": "string",\n'
        '  "confidence": number\n'
        "}\n\n"
    )


def _extract_openai_text(data: dict) -> str:
    output_text = data.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text

    chunks: list[str] = []
    for item in data.get("output", []):
        for content in item.get("content", []):
            text = content.get("text")
            if isinstance(text, str):
                chunks.append(text)
    return "\n".join(chunks)


def _audio_format(mime_type: Optional[str]) -> str:
    mime = (mime_type or "").lower()
    if "mpeg" in mime or "mp3" in mime:
        return "mp3"
    if "wav" in mime:
        return "wav"
    if "m4a" in mime or "mp4" in mime:
        return "m4a"
    if "webm" in mime:
        return "webm"
    return "mp3"


def _openai_evaluator(config: dict, payload: dict) -> dict:
    api_key = config["api_key"]
    model = _resolve_model_for_provider("openai", config.get("model"))
    content = [{"type": "input_text", "text": _evaluation_prompt(payload)}]
    for resp in payload["responses"]:
        content.append({"type": "input_text", "text": f"Question Prompt: {resp['prompt']}\n"})
        if "text" in resp:
            content.append({"type": "input_text", "text": f"Student Response:\n{resp['text']}\n"})
        elif "audio_b64" in resp:
            content.append({
                "type": "input_audio",
                "input_audio": {
                    "data": resp["audio_b64"],
                    "format": _audio_format(resp.get("mime_type")),
                },
            })
            content.append({"type": "input_text", "text": "Evaluate the attached audio response.\n"})

    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "criteria": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "criterion": {"type": "string"},
                        "marks_awarded": {"type": "number"},
                        "rationale": {"type": "string"},
                    },
                    "required": ["criterion", "marks_awarded", "rationale"],
                },
            },
            "comment": {"type": "string"},
            "confidence": {"type": "number"},
        },
        "required": ["criteria", "comment", "confidence"],
    }
    request = {
        "model": model,
        "input": [{"role": "user", "content": content}],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "ai_evaluation_result",
                "schema": schema,
                "strict": False,
            }
        },
    }
    with httpx.Client(timeout=45.0) as client:
        response = client.post(
            "https://api.openai.com/v1/responses",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=request,
        )
        if response.status_code == 429:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="OpenAI API rate limit or quota was reached. Trying the next configured evaluator if available.",
            )
        response.raise_for_status()
        data = response.json()

    text = _extract_openai_text(data)
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse OpenAI response: %s | Raw: %s", exc, data)
        raise ValueError(f"OpenAI API returned unparseable output: {exc}") from exc


def _remote_evaluator(config: dict, payload: dict) -> dict:
    provider = config.get("provider") or "gemini"
    
    if provider == "gemini":
        return _gemini_evaluator(config, payload)
    if provider == "openai":
        return _openai_evaluator(config, payload)
    
    # Custom JSON HTTP endpoint
    parsed = urlparse(config.get("endpoint_url") or "")
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI evaluator endpoint must be an HTTP or HTTPS URL")
    response = httpx.post(
        config["endpoint_url"],
        headers={"Authorization": f"Bearer {config['api_key']}", "Content-Type": "application/json"},
        json={"model": config.get("model"), **payload},
        timeout=30.0,
    )
    response.raise_for_status()
    data = response.json()
    return data.get("result", data)


def _interlocutor_instruction(current_prompt: str, next_prompt: str, next_turn_type: str) -> str:
    return (
        "You are the interlocutor in a LanguageCert Academic practice speaking interview. "
        "Listen to the candidate's previous response and produce exactly one concise examiner prompt. "
        "Keep the intent and difficulty of the authored next prompt, respond naturally to what the candidate said, "
        "do not score or coach the candidate, and do not mention AI.\n\n"
        f"Previous authored prompt: {current_prompt}\n"
        f"Next turn type: {next_turn_type}\n"
        f"Authored next prompt: {next_prompt}\n\n"
        'Return JSON only: {"next_prompt":"..."}'
    )


def _gemini_interlocutor(config: dict, prompt: str, audio_b64: str, mime_type: str) -> dict:
    model = str(config.get("model") or DEFAULT_GEMINI_MODEL).removeprefix("models/")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={config['api_key']}"
    payload = {
        "contents": [{"parts": [
            {"text": prompt},
            {"inlineData": {"mimeType": mime_type, "data": audio_b64}},
        ]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.25},
    }
    with httpx.Client(timeout=45.0) as client:
        response = client.post(url, headers={"Content-Type": "application/json"}, json=payload)
        response.raise_for_status()
        data = response.json()
    return json.loads(data["candidates"][0]["content"]["parts"][0]["text"])


def _openai_interlocutor(config: dict, prompt: str, audio_b64: str, mime_type: str) -> dict:
    request = {
        "model": _resolve_model_for_provider("openai", config.get("model")),
        "input": [{"role": "user", "content": [
            {"type": "input_text", "text": prompt},
            {"type": "input_audio", "input_audio": {"data": audio_b64, "format": _audio_format(mime_type)}},
        ]}],
        "text": {"format": {
            "type": "json_schema",
            "name": "speaking_interlocutor_prompt",
            "schema": {
                "type": "object",
                "additionalProperties": False,
                "properties": {"next_prompt": {"type": "string"}},
                "required": ["next_prompt"],
            },
            "strict": True,
        }},
    }
    with httpx.Client(timeout=45.0) as client:
        response = client.post(
            "https://api.openai.com/v1/responses",
            headers={"Authorization": f"Bearer {config['api_key']}", "Content-Type": "application/json"},
            json=request,
        )
        response.raise_for_status()
        data = response.json()
    return json.loads(_extract_openai_text(data))


def generate_speaking_follow_up(
    db: Session,
    *,
    audio_path: Path,
    current_prompt: str,
    next_prompt: str,
    next_turn_type: str,
    evaluator: Optional[Callable[[dict, str, str, str], dict]] = None,
) -> dict:
    """Generate one cached interview turn without making the exam depend on AI availability."""
    fallback = {"next_prompt": next_prompt, "generated": False}
    if not audio_path.is_file() or not config_status(db)["configured"]:
        return fallback

    mime_type = mimetypes.guess_type(audio_path.name)[0] or "audio/webm"
    audio_b64 = base64.b64encode(audio_path.read_bytes()).decode("ascii")
    prompt = _interlocutor_instruction(current_prompt, next_prompt, next_turn_type)
    for config in _candidate_configs(db):
        try:
            if evaluator is not None:
                result = evaluator(config, prompt, audio_b64, mime_type)
            elif config["provider"] == "gemini":
                result = _gemini_interlocutor(config, prompt, audio_b64, mime_type)
            elif config["provider"] == "openai":
                result = _openai_interlocutor(config, prompt, audio_b64, mime_type)
            else:
                response = httpx.post(
                    config["endpoint_url"],
                    headers={"Authorization": f"Bearer {config['api_key']}", "Content-Type": "application/json"},
                    json={
                        "task": "speaking_interlocutor_follow_up",
                        "model": config.get("model"),
                        "instructions": prompt,
                        "audio_b64": audio_b64,
                        "mime_type": mime_type,
                    },
                    timeout=45.0,
                )
                response.raise_for_status()
                result = response.json().get("result", response.json())
            generated_prompt = str(result.get("next_prompt") or "").strip()
            if generated_prompt:
                return {"next_prompt": generated_prompt[:1000], "generated": True}
        except Exception:
            logger.exception("Adaptive Speaking prompt generation failed with %s", config.get("provider"))
    return fallback


def _criterion_key(name: object) -> str:
    """Match key for a rubric criterion name.

    Models paraphrase the label they are handed - "Task Achievement" comes back
    as "Task achievement", "Grammar" as "Grammar & Accuracy". The marks are
    still right, so an exact-string comparison here used to throw away a
    completed (and billed) evaluation and push the whole attempt to the manual
    queue. Compare on a squashed key instead, and keep the authored spelling
    for everything downstream."""
    return re.sub(r"[^a-z0-9]+", "", str(name or "").lower())


def _marks_value(raw: object) -> Decimal:
    """Coerce whatever the model put in `marks_awarded` into a number.

    Seen in the wild: 6, "6", "6.0", "6/8", "6 out of 8", None. Everything but
    the last is a usable score, and `Decimal(str(...))` raised on all of them
    except the first two."""
    if raw is None:
        raise ValueError("Criterion is missing marks_awarded")
    if isinstance(raw, (int, float, Decimal)):
        return Decimal(str(raw))
    match = re.search(r"-?\d+(?:\.\d+)?", str(raw))
    if not match:
        raise ValueError(f"Criterion marks_awarded is not a number: {raw!r}")
    return Decimal(match.group(0))


def _normalize(result: dict, part: ExamModulePart) -> dict:
    if not isinstance(result, dict) or not isinstance(result.get("criteria"), list):
        raise ValueError("Evaluator response must contain a criteria list")
    rubric = {item["criterion"]: Decimal(str(item["max_marks"])) for item in (part.rubric or [])}
    by_key = {_criterion_key(name): name for name in rubric}
    normalized = []
    seen = set()
    for item in result["criteria"]:
        name = by_key.get(_criterion_key(item.get("criterion")))
        if name is None or name in seen:
            raise ValueError(f"Unexpected or duplicate criterion: {item.get('criterion')}")
        awarded = _marks_value(item.get("marks_awarded"))
        if awarded < 0:
            awarded = Decimal("0")
        if awarded > rubric[name]:
            awarded = rubric[name]
        seen.add(name)
        normalized.append({
            "criterion": name,
            "max_marks": str(rubric[name]),
            "marks_awarded": str(awarded),
            "cefr_level": cefr_service.criterion_level(awarded, rubric[name]),
            "rationale": str(item.get("rationale") or "")[:2000],
        })
    if seen != set(rubric):
        raise ValueError("Evaluator response did not score every rubric criterion")
    confidence = Decimal(str(result.get("confidence", 0)))
    if confidence < 0 or confidence > 1:
        confidence = Decimal("0.85")
    return {
        "criteria": normalized,
        "comment": str(result.get("comment") or "")[:4000],
        "confidence": str(confidence),
        "human_review_required": True,
        "framework_version": cefr_service.FRAMEWORK_VERSION,
        "policy_version": cefr_service.POLICY_VERSION,
    }


def _readable_response(raw: object) -> str:
    """The provider's own reply, kept for the log. Truncated: a rationale-heavy
    response is a few KB, but a misbehaving endpoint can return anything."""
    try:
        return json.dumps(raw, indent=2, default=str)[:8000]
    except Exception:
        return str(raw)[:8000]


def _evaluation_in_flight(db: Session, attempt_id: int, part_id: int) -> bool:
    """True while another request for this same part is still with a provider.

    The pre-emptive trigger fires whenever a student leaves a Writing or
    Speaking part, so tabbing between two parts used to queue a fresh provider
    call each time - the fastest way there is to hit a per-minute rate limit
    with duplicate work. The cutoff keeps a crashed worker's abandoned row from
    blocking the part for ever."""
    cutoff = _now() - timedelta(seconds=IN_FLIGHT_WINDOW_SECONDS)
    return (
        db.query(AiEvaluation)
        .filter(
            AiEvaluation.attempt_id == attempt_id,
            AiEvaluation.part_id == part_id,
            AiEvaluation.status == "running",
            AiEvaluation.created_at >= cutoff,
        )
        .first()
        is not None
    )


def request_suggestion(
    db: Session,
    actor: User,
    attempt: TestAttempt,
    part: ExamModulePart,
    evaluator: Optional[Callable[[dict, dict], dict]] = None,
    configs: Optional[list[dict]] = None,
) -> dict:
    configs_to_try = configs or (_candidate_configs(db) if evaluator is None else [{
        "provider": "test_evaluator",
        "model": "test-model",
        "monthly_limit": DEFAULT_MONTHLY_LIMIT,
        "api_key": "test",
    }])
    if not configs_to_try:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI evaluation is not enabled or fully configured")

    limits = _limit_rows(db, attempt, int(configs_to_try[0].get("monthly_limit") or DEFAULT_MONTHLY_LIMIT))
    payload = _payload(attempt, part)
    last_error: Optional[Exception] = None
    failed_records: list[AiEvaluation] = []

    for index, config in enumerate(configs_to_try):
        record = AiEvaluation(
            attempt_id=attempt.id,
            part_id=part.id,
            requested_by_id=actor.id,
            provider=config["provider"],
            model=config.get("model"),
            status="running",
            request_summary=_request_summary(payload, config),
        )
        db.add(record)
        db.flush()
        started = time.monotonic()
        try:
            raw = (evaluator or _remote_evaluator)(config, payload)
            record.duration_ms = int((time.monotonic() - started) * 1000)
            record.response_raw = _readable_response(raw)
            suggestion = _normalize(raw, part)
            record.status = "completed"
            record.suggestions = suggestion
            for limit in limits:
                limit.used_count += 1
            db.add_all([record, *limits, *failed_records])
            db.commit()
            return {"id": record.id, **suggestion}
        except HTTPException as exc:
            last_error = exc
            record.status = "failed"
            record.duration_ms = int((time.monotonic() - started) * 1000)
            record.error = str(exc.detail)[:4000]
            db.add(record)
            failed_records.append(record)
            if exc.status_code == 429 and index == len(configs_to_try) - 1:
                db.commit()
                raise
            if exc.status_code == 429 and index < len(configs_to_try) - 1:
                # Separate keys can still share a project quota, so give the
                # window a moment before spending the next one.
                time.sleep(RATE_LIMIT_KEY_SWITCH_SECONDS)
        except Exception as exc:
            last_error = exc
            record.status = "failed"
            record.duration_ms = int((time.monotonic() - started) * 1000)
            record.error = str(exc)[:4000]
            db.add(record)
            failed_records.append(record)

    db.commit()
    detail = str(getattr(last_error, "detail", last_error)) if last_error else "All AI evaluators failed"
    raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"All configured AI evaluators failed: {detail[:500]}")


def _apply_ai_grade(db: Session, attempt: TestAttempt, part: ExamModulePart, suggestion: dict) -> None:
    grade = next((g for g in attempt.part_grades if g.part_id == part.id), None)
    if grade is None:
        grade = AttemptPartGrade(attempt_id=attempt.id, part_id=part.id)
        db.add(grade)
        attempt.part_grades.append(grade)
    grade.criteria = suggestion["criteria"]
    grade.total_marks = sum(
        (Decimal(item["marks_awarded"]) for item in suggestion["criteria"]), Decimal("0")
    )
    grade.comment = suggestion.get("comment")
    # No human graded this - grader_id stays NULL, status distinguishes it as
    # AI-sourced so the student/instructor UI can label it and offer a
    # "request manual evaluation" escalation (the existing reevaluation flow).
    grade.grader_id = None
    grade.status = PART_GRADE_AI_GRADED
    grade.graded_at = _now()
    db.add(grade)


def auto_evaluate_submission(db: Session, attempt: TestAttempt) -> bool:
    """Best-effort automatic AI grading for a freshly submitted attempt's
    human-graded parts (Writing/Speaking), run right after submission (via a
    background job - see job_service's "ai_auto_grade" handler) so the
    student sees a real result without waiting on an instructor.

    Falls back silently to the pre-existing manual grading queue for any part
    AI can't or won't cover: module part has AI disabled, provider not
    configured, quota exhausted, provider error, or no answerable response yet.
    Returns True if the quota was exhausted for at least one part, so the
    caller can flag it (surfaced to the student via the notification already
    sent from `_limit_rows`)."""
    if not config_status(db)["configured"]:
        return False

    quota_exhausted = False
    for part in attempt.module.parts:
        if part.auto_marked or not part.ai_evaluation_enabled:
            continue
        grade = next((g for g in attempt.part_grades if g.part_id == part.id), None)
        if grade is not None and grade.status != PART_GRADE_PENDING:
            continue  # already graded (human beat the job to it, or re-run)

        try:
            suggestion = request_suggestion(db, attempt.user, attempt, part)
        except HTTPException as exc:
            if exc.status_code == 429:
                quota_exhausted = True
            continue
        except Exception:
            logger.exception(
                "Automatic AI evaluation failed for attempt %s part %s", attempt.id, part.id
            )
            continue

        _apply_ai_grade(db, attempt, part, suggestion)
        db.commit()

    from app.services.attempt_service import _finalize_if_all_graded

    _finalize_if_all_graded(db, attempt)
    return quota_exhausted


def evaluate_attempt_part_directly(database_url: str, attempt_id: int, part_id: int) -> None:
    """Evaluate one specific subjective part (Writing/Speaking) of an attempt
    in the background immediately after the student finishes that part, rather
    than waiting for the final test submission. This greatly reduces latency.
    """
    from app.database import create_database_engine
    from sqlalchemy.orm import sessionmaker
    from app.models.attempt import TestAttempt, AttemptPartGrade
    from app.models.exam_module import ExamModulePart
    from app.services import grading_service

    engine = create_database_engine(database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        if not config_status(db)["configured"]:
            return

        attempt = db.query(TestAttempt).filter(TestAttempt.id == attempt_id).first()
        if attempt is None:
            return

        part = db.query(ExamModulePart).filter(ExamModulePart.id == part_id).first()
        if part is None or part.auto_marked or not part.ai_evaluation_enabled:
            return

        # Check if it was already graded
        grade = next((g for g in attempt.part_grades if g.part_id == part_id), None)
        if grade is not None and grade.status != "pending":
            return  # Already graded

        if _evaluation_in_flight(db, attempt_id, part_id):
            logger.info(
                "Skipping duplicate pre-emptive AI evaluation for attempt %s part %s",
                attempt_id,
                part_id,
            )
            return

        try:
            suggestion = request_suggestion(db, attempt.user, attempt, part)
        except Exception:
            logger.exception(
                "Pre-emptive background AI evaluation failed for attempt %s part %s",
                attempt_id,
                part_id,
            )
            return

        grading_service.ensure_queue_entry(db, attempt)
        _apply_ai_grade(db, attempt, part, suggestion)
        db.commit()

        # Check if the whole attempt is ready to finalize (if student already submitted)
        from app.services.attempt_service import _finalize_if_all_graded
        _finalize_if_all_graded(db, attempt)
        db.commit()
    finally:
        db.close()
        # This runs in the API process, once per part the student leaves. The
        # engine owns a connection pool, so leaving it to the garbage collector
        # leaked a pool per call and slowly starved the database of
        # connections over a sitting.
        engine.dispose()
