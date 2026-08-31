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
    ATTEMPT_GRADING,
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
DEFAULT_GEMINI_FLASH_RPM = 5
DEFAULT_GEMINI_PRO_RPM = 2
PROVIDER_RATE_LIMIT_WINDOW_SECONDS = 60
PROVIDER_RATE_LIMIT_BUFFER_SECONDS = 1
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
# A Final Test's call is allowed to run far longer than that (see
# AI_TIMEOUT_FINAL_MAX_SECONDS below), and a guard that expires mid-call is no
# guard: the next trigger would send the same recordings again, paying the
# quota twice and racing the first response to the grade. Kept a minute past
# the longest call the timeout can permit.
IN_FLIGHT_FINAL_WINDOW_SECONDS = 960
# Gemini accepts about 20 MB of inline data per request. Speaking answers are
# recorded as compressed audio, so a single long answer can still be several MB
# and a part with three of them can pass the limit - budget the whole part, not
# each file.
MAX_INLINE_BYTES_PER_PART = 18 * 1024 * 1024
# How long to wait on the provider for one evaluation. Speaking is the only
# skill whose payload varies by an order of magnitude - a written answer is
# kilobytes, a recorded one megabytes - so the window is chosen from the audio
# actually being sent.
AI_TIMEOUT_SMALL_SECONDS = 45.0
AI_TIMEOUT_MEDIUM_SECONDS = 180.0
AI_TIMEOUT_LARGE_SECONDS = 240.0
AI_TIMEOUT_EXTRA_LARGE_SECONDS = 300.0
# A Final Test sends the whole Speaking paper - every part, every prompt - in a
# single request, where a practice module sends one part at a time. The same
# megabyte therefore arrives alongside far more of it, so the window keeps
# growing with the payload instead of flattening out at the practice ceiling:
# a paper cut off mid-marking lands in the examiner queue as "manual review
# required" with the work all but done.
AI_TIMEOUT_FINAL_BASE_SECONDS = 240.0
AI_TIMEOUT_FINAL_SECONDS_PER_MB = 30.0
AI_TIMEOUT_FINAL_MAX_SECONDS = 900.0
# What counts as "nothing was said". Opus at the recorder's bitrate is roughly
# 3 KB a second, so this is about two seconds - long enough to clear a click or
# a breath, short enough that any real attempt at an answer is above it.
MIN_AUDIO_BYTES = 8 * 1024
MIN_WRITTEN_CHARACTERS = 15
DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
MASKED_SECRET = "********"
SUPPORTED_KEY_PROVIDERS = {"gemini", "custom_json", "openai"}
# Which Gemini models are suitable for marking. This is a filter over what
# Google actually offers - never a claim that these exist. Google retires model
# names on its own schedule, and a name hardcoded as a fallback becomes a
# disconnected number: every request to it fails, so no paper gets marked until
# somebody notices and edits the code.
GEMINI_EVALUATION_MODELS = {
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
}
# Preference order when a model has to be chosen for us - the configured one is
# gone, or it just came back rate-limited. Every candidate is checked against
# the live directory before it is used, so an entry Google switches off simply
# stops being picked instead of taking AI marking down with it.
GEMINI_FLASH_PREFERENCE = (
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite",
)
# A paper set to a "pro" model was chosen for marking quality. Falling back to
# flash is a real downgrade, so pro falls to pro first and only drops to flash
# when there is no pro model left to call.
GEMINI_PRO_PREFERENCE = (
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
)
# Names Google has already retired, mapped to the family they belonged to.
GEMINI_RETIRED_MODELS = {
    "gemini-1.5": "flash",
    "gemini-1.5-flash": "flash",
    "gemini-1.5-flash-8b": "flash",
    "gemini-flash-latest": "flash",
    "gemini-1.5-pro": "pro",
    "gemini-pro-latest": "pro",
}
# The live directory, cached so marking a paper never waits on Google's model
# list - the scheduler refreshes it in the background instead.
LIVE_MODELS_SETTING = "ai.live_gemini_models"
MODEL_CHECK_SETTING = "ai.models_checked_at"
MODEL_CHECK_INTERVAL_SECONDS = 7 * 24 * 60 * 60
OPENAI_EVALUATION_MODEL_PREFIXES = (
    "gpt-5",
    "gpt-4.1",
    "gpt-4o",
    "o4",
    "o3",
)


def _ai_timeout_for_payload(total_audio_bytes: int, *, is_final: bool = False) -> float:
    """Choose a provider timeout from the cumulative Speaking audio payload.

    Transcribing and marking a recording costs the model roughly in proportion
    to its length, so the wait is bought by the megabyte rather than fixed.
    """
    if total_audio_bytes <= 0:
        return AI_TIMEOUT_SMALL_SECONDS

    mb = total_audio_bytes / 1024 / 1024
    if is_final:
        return min(
            AI_TIMEOUT_FINAL_BASE_SECONDS + mb * AI_TIMEOUT_FINAL_SECONDS_PER_MB,
            AI_TIMEOUT_FINAL_MAX_SECONDS,
        )
    if mb <= 2:
        return AI_TIMEOUT_MEDIUM_SECONDS
    if mb <= 5:
        return AI_TIMEOUT_LARGE_SECONDS
    return AI_TIMEOUT_EXTRA_LARGE_SECONDS


def _timeout_for_request(payload: dict) -> float:
    """The window for a built payload - Final Tests carry their own flag."""
    return _ai_timeout_for_payload(
        int(payload.get("audio_bytes") or 0),
        is_final=bool(payload.get("is_final")),
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


GEMINI_API_ROOT = "https://generativelanguage.googleapis.com/v1beta"


def _gemini_headers(api_key: str) -> dict:
    """Gemini auth goes in a header, never in the query string.

    Two reasons. The newer Google AI Studio keys (the `AQ.` format) are only
    accepted as `x-goog-api-key` - sent as `?key=` they come back 401, which is
    exactly the failure this platform kept logging. And a key in the URL ends up
    inside httpx's error text, so it was being written into the AI evaluation
    log and shown on screen."""
    return {"Content-Type": "application/json", "x-goog-api-key": api_key}


_SECRET_PATTERN = re.compile(r"(key=|x-goog-api-key['\":\s]+)([A-Za-z0-9._\-]{12,})", re.IGNORECASE)


def _redact_secrets(text: object) -> str:
    """Strip anything key-shaped out of provider error text before it is stored."""
    return _SECRET_PATTERN.sub(lambda m: f"{m.group(1)}[redacted]", str(text))


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


def _fetch_gemini_model_ids(api_key: str) -> list[str]:
    """Ask Google which models this key can actually call today."""
    with httpx.Client(timeout=15.0) as client:
        response = client.get(f"{GEMINI_API_ROOT}/models", headers=_gemini_headers(api_key))
        response.raise_for_status()
        data = response.json()
    return [
        str(item.get("name") or "").removeprefix("models/")
        for item in data.get("models", [])
        if "generateContent" in set(item.get("supportedGenerationMethods") or [])
        and str(item.get("name") or "").removeprefix("models/") not in GEMINI_RETIRED_MODELS
    ]


def _read_model_directory(db: Session) -> dict:
    from app.services.settings_service import get_setting

    raw = get_setting(db, LIVE_MODELS_SETTING)
    if not raw:
        return {}
    try:
        return json.loads(raw) or {}
    except (TypeError, ValueError):
        return {}


def cached_gemini_models(db: Session, key_id: Optional[str]) -> list[str]:
    """What the directory said last time, for this key. Never calls Google.

    Marking a paper must not wait on Google's model list: the scheduler keeps
    this fresh in the background, and an empty result means "we do not know",
    never "nothing works" - the chain then falls back to its preference order
    and lets the call itself settle the question.
    """
    directory = _read_model_directory(db)
    by_key = directory.get("keys") or {}
    return list(by_key.get(str(key_id)) or [])


def refresh_gemini_models(db: Session, key_id: Optional[str], api_key: str) -> list[str]:
    """Ask Google what this key can call, and remember the answer."""
    from app.services.settings_service import set_setting

    directory = _read_model_directory(db)
    by_key = dict(directory.get("keys") or {})
    try:
        models = _fetch_gemini_model_ids(api_key)
    except Exception as exc:
        logger.warning("Could not refresh the Gemini model directory: %s", _redact_secrets(exc)[:200])
        # Stale beats nothing: yesterday's directory is still a better guide
        # than a name hardcoded a year ago.
        return list(by_key.get(str(key_id)) or [])

    if models:
        by_key[str(key_id)] = models
        set_setting(
            db,
            LIVE_MODELS_SETTING,
            json.dumps({"checked_at": _now().isoformat(), "keys": by_key}),
        )
    return models


def _gemini_model_family(model: str) -> str:
    return "pro" if "pro" in (model or "").lower() else "flash"


def gemini_model_chain(model: Optional[str], live_models: Optional[list[str]] = None) -> list[str]:
    """The model to call, then what to try if it will not answer.

    The configured model leads unless it is one Google has already retired, or
    the live directory says it is gone. Everything after it is a preference
    order filtered by that same directory, so the chain only ever contains
    numbers that were connected the last time we looked.
    """
    requested = (model or "").replace("–", "-").replace("—", "-").strip().removeprefix("models/")
    known_live = set(live_models or [])
    family = _gemini_model_family(requested or DEFAULT_GEMINI_MODEL)
    preference = GEMINI_PRO_PREFERENCE if family == "pro" else GEMINI_FLASH_PREFERENCE

    chain: list[str] = []
    retired = requested in GEMINI_RETIRED_MODELS
    gone_from_directory = bool(known_live) and requested not in known_live
    if requested and not retired and not gone_from_directory:
        chain.append(requested)

    for candidate in preference:
        # With no directory to check against, the preference order is all we
        # have; with one, only what it lists is worth dialling.
        if known_live and candidate not in known_live:
            continue
        chain.append(candidate)

    if not chain:
        chain.append(requested or DEFAULT_GEMINI_MODEL)
    return list(dict.fromkeys(chain))


def _default_model_options(provider: str, model: Optional[str] = None) -> list[dict]:
    if provider == "gemini":
        selected = _resolve_model_for_provider(provider, model)
        values = [selected, DEFAULT_GEMINI_MODEL, "gemini-1.5-flash"]
        return [_model_option(value) for value in dict.fromkeys(value for value in values if value)]
    if provider == "openai":
        selected = _resolve_model_for_provider(provider, model)
        values = [selected, DEFAULT_OPENAI_MODEL]
        return [_model_option(value) for value in dict.fromkeys(value for value in values if value)]
    if provider == "custom_json" and model:
        return [_model_option(model)]
    return []


def _choose_model_from_options(provider: str, preferred: Optional[str], options: list[dict]) -> str:
    preferred_value = (preferred or "").removeprefix("models/")
    values = [str(option.get("value") or "").removeprefix("models/") for option in options]
    if preferred_value and preferred_value in values:
        return preferred_value
    for value in values:
        if _model_matches_provider(provider, value):
            return value
    return _resolve_model_for_provider(provider, preferred)


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
            response = client.get(f"{GEMINI_API_ROOT}/models", headers=_gemini_headers(api_key))
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
        if model_id in GEMINI_RETIRED_MODELS:
            continue
        if model_id not in GEMINI_EVALUATION_MODELS and not (
            model_id.startswith("gemini-") and ("flash" in model_id or "pro" in model_id)
        ):
            continue
        options.append(_model_option(model_id, item.get("displayName")))

    selected = (model or DEFAULT_GEMINI_MODEL).removeprefix("models/")
    if selected and not any(option["value"] == selected for option in options):
        # Google did not list this model for this key. Dropping it silently
        # makes the settings screen look like it never saved; offering it as a
        # normal choice is how a retired model gets picked again. Show it, and
        # say what is wrong with it.
        options.insert(
            0,
            {
                "value": selected,
                "label": f"{_model_label(selected)} - no longer available",
                "available": False,
            },
        )
    return options or _default_model_options(provider, model)


def _persist_key_model(db: Session, *, key_id: str, provider: str, model: str, options: list[dict]) -> None:
    from app.services.settings_service import set_setting

    stored = _configured_keys(db, mask=False)
    changed = False
    for item in stored:
        if item["id"] == key_id:
            item["provider"] = provider
            item["model"] = model
            item["model_options"] = options
            changed = True
    if changed:
        set_setting(db, "ai.api_keys", json.dumps(stored))


def list_configured_key_models(
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
    effective_endpoint = endpoint_url or (stored or {}).get("endpoint_url")
    effective_model = model or (stored or {}).get("model")

    if not secret:
        return {
            "ok": False,
            "provider": provider,
            "provider_label": _provider_label(provider),
            "detected_provider": provider,
            "model": _resolve_model_for_provider(provider, effective_model),
            "model_options": [],
            "key_preview": None,
            "supported": provider in SUPPORTED_KEY_PROVIDERS,
            "message": "Enter or select a saved API key before loading models.",
        }

    detected = _detect_provider(
        api_key=secret,
        endpoint_url=effective_endpoint,
        preferred_provider=preferred_provider or provider or (stored or {}).get("provider"),
    )
    if not detected["supported"]:
        return {
            "ok": False,
            "provider": detected["provider"],
            "provider_label": detected["provider_label"],
            "detected_provider": detected["provider"],
            "model": _resolve_model_for_provider(detected["provider"], effective_model),
            "model_options": [],
            "key_preview": _mask_key(secret),
            "supported": False,
            "message": detected["reason"],
        }

    options = list_evaluation_models(
        provider=detected["provider"],
        api_key=secret,
        model=effective_model,
        endpoint_url=effective_endpoint,
    )
    selected = _choose_model_from_options(detected["provider"], effective_model, options)

    # Write the discovered model straight back onto the saved key. Loading
    # models used to leave the choice sitting in the form, so a reload before
    # "Save AI settings" quietly restored the model that was failing.
    if stored and options:
        _persist_key_model(db, key_id=stored["id"], provider=detected["provider"], model=selected, options=options)

    return {
        "ok": bool(options),
        "provider": detected["provider"],
        "provider_label": detected["provider_label"],
        "detected_provider": detected["provider"],
        "model": selected,
        "model_options": options,
        "key_preview": _mask_key(secret),
        "supported": True,
        "message": "Models loaded for this key." if options else "No supported evaluation models were found for this key.",
        "detection_message": detected["reason"],
    }


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


def check_configured_models(db: Session, *, force: bool = False) -> list[dict]:
    """Compare every configured Gemini key's model against the live directory.

    Google announces retirements well in advance, so this is the difference
    between hearing about it a month early and hearing about it from a student
    whose paper was not marked. Runs weekly from the scheduler.
    """
    from app.services.settings_service import get_setting, set_setting

    if not force:
        last = get_setting(db, MODEL_CHECK_SETTING)
        if last:
            try:
                if (_now() - datetime.fromisoformat(last)).total_seconds() < MODEL_CHECK_INTERVAL_SECONDS:
                    return []
            except (TypeError, ValueError):
                pass

    problems: list[dict] = []
    for item in _configured_keys(db, mask=False):
        if (item.get("provider") or "gemini") != "gemini" or not item.get("api_key"):
            continue
        model = (item.get("model") or "").removeprefix("models/")
        live = refresh_gemini_models(db, item.get("id"), item["api_key"])
        if not live or not model or model in live:
            continue  # no directory to judge against, or the model is fine

        replacement = gemini_model_chain(model, live)[0]
        problems.append({"key_label": item.get("label"), "model": model, "replacement": replacement})

    set_setting(db, MODEL_CHECK_SETTING, _now().isoformat())

    for problem in problems:
        try:
            from app.services import notification_service

            notification_service.notify_api_key_down(
                db,
                "Google Gemini",
                (
                    f"Model '{problem['model']}' is no longer offered to "
                    f"{problem['key_label'] or 'your Gemini key'}. AI marking will use "
                    f"'{problem['replacement']}' until you change it in Platform Settings."
                ),
            )
        except Exception:
            logger.exception("Could not send the model availability notification")
    return problems


def _persist_key_model_choice(db: Session, key_id: Optional[str], model: str) -> bool:
    """Point the stored key at a model that answers. Returns True if it moved."""
    from app.services.settings_service import set_setting

    if not key_id or key_id == "legacy":
        return False
    stored = _configured_keys(db, mask=False)
    changed = False
    for item in stored:
        if item.get("id") == key_id and item.get("model") != model:
            item["model"] = model
            changed = True
    if changed:
        set_setting(db, "ai.api_keys", json.dumps(stored))
    return changed


def _record_model_substitution(db: Session, config: dict, substitution: dict, record: AiEvaluation) -> None:
    """A retired model was dialled around. Make that visible everywhere.

    The evaluation log gets the model that actually marked the paper, the
    stored setting stops naming a dead one, and the super admins are told
    once - by correcting the setting first, the next call goes straight to
    the working model and never lands here again.
    """
    requested = substitution.get("requested")
    used = substitution.get("used")
    if not used or used == requested:
        return

    record.model = used
    logger.warning(
        "Gemini model %s was unavailable for key %s; marked with %s instead",
        requested,
        config.get("key_label") or "Primary API Key",
        used,
    )
    if not _persist_key_model_choice(db, config.get("key_id"), used):
        return

    try:
        from app.services import notification_service

        notification_service.notify_api_key_down(
            db,
            "Google Gemini",
            (
                f"The configured model '{requested}' is no longer available to "
                f"{config.get('key_label') or 'your Gemini key'}. AI marking has switched to "
                f"'{used}' and the setting has been updated - no papers were left unmarked."
            ),
        )
    except Exception:
        logger.exception("Could not send the retired-model notification")


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
            # Which models this key can actually call, so a retired one is
            # never dialled and the fallback is a number we know is connected.
            "live_models": cached_gemini_models(db, item.get("id")) if provider == "gemini" else [],
        })
    if candidates:
        return candidates
    legacy = {**base, "key_id": "legacy", "key_label": "Primary API Key"}
    if legacy.get("provider") == "gemini" and legacy.get("api_key"):
        legacy["live_models"] = cached_gemini_models(db, "legacy")
    return [legacy]


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
            "message": _redact_secrets(getattr(exc, "detail", exc))[:500],
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
    effective_model = (model if model and model != "auto" else None) or (stored or {}).get("model") or DEFAULT_GEMINI_MODEL
    effective_endpoint = endpoint_url or (stored or {}).get("endpoint_url")
    # Ask the key what it can actually run before testing it. A model saved in
    # settings months ago (or retired by the provider) answers 404, and testing
    # with it used to fail the whole check - taking the model list down with
    # it, so the screen could never offer a working model to switch to.
    discovered = list_evaluation_models(
        provider=detected["provider"],
        api_key=secret,
        model=effective_model,
        endpoint_url=effective_endpoint,
    )
    chosen = _choose_model_from_options(detected["provider"], effective_model, discovered)
    result = test_connection(
        provider=detected["provider"],
        api_key=secret,
        model=chosen,
        endpoint_url=effective_endpoint,
    )
    if not result.get("model_options"):
        result["model_options"] = discovered
    if stored and discovered:
        _persist_key_model(db, key_id=stored["id"], provider=detected["provider"], model=chosen, options=discovered)
    return result | {
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


def _speaking_audio_mime_type(path: Path) -> str:
    """Return an audio MIME for validated Speaking recordings."""
    suffix = path.suffix.lower()
    if suffix == ".webm":
        return "audio/webm"
    if suffix == ".ogg":
        return "audio/ogg"
    if suffix == ".m4a":
        return "audio/mp4"
    if suffix == ".mp3":
        return "audio/mpeg"
    if suffix == ".wav":
        return "audio/wav"
    mime_type, _ = mimetypes.guess_type(str(path))
    if mime_type and mime_type.startswith("audio/"):
        return mime_type
    return "audio/webm"


def _unanswered_reason(attempt: TestAttempt, part: ExamModulePart) -> Optional[str]:
    """Why this part cannot be marked, in words a student can read - or None
    when there is genuinely something to mark.

    An empty part is not an error to escalate, it is a zero. Leaving it pending
    put a blank answer in an instructor's queue and left the student's result
    unfinished for days, for a part nobody needed to listen to.
    """
    answers = {answer.question_id: answer for answer in attempt.answers}
    if part.section_type == "speaking":
        recorded = 0
        captured = 0
        for question in part.questions:
            answer = answers.get(question.id)
            if answer is None or not answer.audio_path:
                continue
            full_path = settings.storage_path / answer.audio_path
            if not full_path.exists():
                continue
            recorded += 1
            captured += full_path.stat().st_size
        if recorded == 0:
            return "No recording was captured for this part."
        if captured < MIN_AUDIO_BYTES:
            return "The recording for this part is silent or barely a second long, so there is nothing to assess."
        return None

    written = 0
    for question in part.questions:
        answer = answers.get(question.id)
        text = ((answer.response or {}).get("text") if answer and answer.response else None) or ""
        written += len(str(text).strip())
    if written == 0:
        return "No written answer was submitted for this part."
    if written < MIN_WRITTEN_CHARACTERS:
        return "The answer for this part is too short to assess."
    return None


def _apply_zero_grade(db: Session, attempt: TestAttempt, part: ExamModulePart, reason: str) -> None:
    """Score every rubric criterion zero, and say why on the result."""
    criteria = [
        {
            "criterion": item.get("criterion"),
            "max_marks": str(item.get("max_marks")),
            "marks_awarded": "0",
            "cefr_level": cefr_service.criterion_level(0, item.get("max_marks")),
            "rationale": reason,
        }
        for item in (part.rubric or [])
        if item.get("criterion")
    ]
    # Query rather than trust the loaded collection: submit creates the pending
    # grade rows in the same transaction, and they are not necessarily in
    # `attempt.part_grades` yet - inserting a second one hits the unique
    # constraint on (attempt_id, part_id).
    grade = (
        db.query(AttemptPartGrade)
        .filter(AttemptPartGrade.attempt_id == attempt.id, AttemptPartGrade.part_id == part.id)
        .first()
    ) or next((item for item in attempt.part_grades if item.part_id == part.id), None)
    if grade is None:
        grade = AttemptPartGrade(attempt_id=attempt.id, part_id=part.id)
        db.add(grade)
        attempt.part_grades.append(grade)
    grade.criteria = criteria
    grade.total_marks = Decimal("0")
    grade.comment = f"{reason} An instructor can change this if you think a recording was lost."
    grade.grader_id = None
    grade.status = PART_GRADE_AI_GRADED
    grade.graded_at = _now()
    db.add(grade)


def _payload(attempt: TestAttempt, part: ExamModulePart) -> dict:
    answers = {answer.question_id: answer for answer in attempt.answers}
    responses = []
    skipped: list[str] = []
    inline_bytes = 0
    
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
                mime_type = _speaking_audio_mime_type(full_path)
                
                if inline_bytes + len(audio_bytes) <= MAX_INLINE_BYTES_PER_PART:
                    inline_bytes += len(audio_bytes)
                    responses.append({
                        "prompt": question.prompt,
                        "audio_b64": base64.b64encode(audio_bytes).decode("utf-8"),
                        "mime_type": mime_type,
                    })
                else:
                    # Dropping this silently is how a part ended up "awaiting
                    # examiner marking" with no reason anywhere.
                    skipped.append(f"{len(audio_bytes) / 1024 / 1024:.1f} MB")
        elif text_resp:
            responses.append({
                "prompt": question.prompt,
                "text": str(text_resp)[:12000],
            })

    if not responses:
        if skipped:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"The recordings for this part are too large to send for AI marking "
                    f"({', '.join(skipped)}; the limit is {MAX_INLINE_BYTES_PER_PART // 1024 // 1024} MB per part)."
                ),
            )
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
        "audio_bytes": inline_bytes,
        "is_final": bool(attempt.is_final),
        "part": {"title": part.title, "skill_focus": part.skill_focus},
        "rubric": part.rubric or [],
        "responses": responses,
        "instructions": (
            "You are an expert Language CERT and CEFR language examiner. "
            "Analyze the student's submission carefully against the provided rubric criteria. "
            "Return JSON ONLY matching the required schema. "
            "Score EVERY rubric criterion strictly between 0 and its max_marks. "
            "If the response does not address the prompt, is inaudible, is in the wrong language, or is "
            "otherwise off-topic, score it zero (or near zero) and say so in the rationale - do not refuse "
            "to answer and do not return an error. A wrong answer is still an answer to be marked. "
            "Provide a brief, evidence-based rationale for each criterion, an overall examiner summary comment, "
            "and a confidence rating between 0 and 1. "
            "This is an advisory draft requiring human instructor review."
        ),
    }


def _batch_payload(attempt: TestAttempt, parts: list[ExamModulePart]) -> dict:
    answers = {answer.question_id: answer for answer in attempt.answers}
    payload_parts = []
    inline_bytes = 0

    for part in sorted(parts, key=lambda item: item.sort_order):
        responses = []
        skipped: list[str] = []
        for question in sorted(part.questions, key=lambda item: item.sort_order):
            answer = answers.get(question.id)
            if not answer:
                continue
            audio_path = answer.audio_path
            text_resp = (answer.response or {}).get("text") if answer.response else None
            if part.section_type == "speaking" and audio_path:
                full_path = settings.storage_path / audio_path
                if full_path.exists():
                    audio_bytes = full_path.read_bytes()
                    mime_type = _speaking_audio_mime_type(full_path)
                    if inline_bytes + len(audio_bytes) <= MAX_INLINE_BYTES_PER_PART:
                        inline_bytes += len(audio_bytes)
                        responses.append({
                            "prompt": question.prompt,
                            "audio_b64": base64.b64encode(audio_bytes).decode("utf-8"),
                            "mime_type": mime_type,
                        })
                    else:
                        skipped.append(f"{len(audio_bytes) / 1024 / 1024:.1f} MB")
            elif text_resp:
                responses.append({
                    "prompt": question.prompt,
                    "text": str(text_resp)[:12000],
                })
        if skipped:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "The recordings for this Speaking section are too large to send in one AI marking request "
                    f"({', '.join(skipped)}; the limit is {MAX_INLINE_BYTES_PER_PART // 1024 // 1024} MB per request)."
                ),
            )
        if responses:
            payload_parts.append({
                "part_id": part.id,
                "part_code": part.part_code,
                "title": part.title,
                "skill_focus": part.skill_focus,
                "rubric": part.rubric or [],
                "responses": responses,
            })

    if not payload_parts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No answerable Speaking recordings were found for AI marking.",
        )

    return {
        "task": "cefr_rubric_evaluation_batch",
        "framework": cefr_service.FRAMEWORK_VERSION,
        "policy_version": cefr_service.POLICY_VERSION,
        "skill": "speaking",
        "audio_bytes": inline_bytes,
        "is_final": bool(attempt.is_final),
        "parts": payload_parts,
        "instructions": (
            "You are an expert Language CERT and CEFR speaking examiner. "
            "Evaluate each Speaking part independently. Return JSON only. "
            "For every part_id supplied, return exactly one result object with that same part_id. "
            "Score every authored rubric criterion strictly between 0 and its max_marks. "
            "If a response is inaudible, off-topic, in the wrong language, or does not answer the prompt, "
            "score it zero or near zero and explain why in the rationale. Do not refuse the marking task."
        ),
    }


def _request_summary(payload: dict, config: dict) -> dict:
    """A readable record of what was sent, for the AI evaluation log.

    Deliberately a description and not a copy: a Speaking request carries the
    recording as base64, and nobody needs megabytes of that in a log row."""
    submissions = []
    response_items = []
    if payload.get("task") == "cefr_rubric_evaluation_batch":
        for part in payload.get("parts", []):
            for item in part.get("responses", []):
                response_items.append({**item, "part_title": part.get("title"), "part_id": part.get("part_id")})
    else:
        response_items = payload.get("responses", [])

    for item in response_items:
        if "audio_b64" in item:
            submissions.append({
                "part_id": item.get("part_id"),
                "part_title": item.get("part_title"),
                "prompt": str(item.get("prompt") or "")[:300],
                "kind": "audio",
                # base64 inflates by 4/3; report what the recording weighs.
                "audio_kb": round(len(item["audio_b64"]) * 3 / 4 / 1024),
                "format": item.get("mime_type"),
            })
        else:
            text = str(item.get("text") or "")
            submissions.append({
                "part_id": item.get("part_id"),
                "part_title": item.get("part_title"),
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
        "audio_kb_total": round(int(payload.get("audio_bytes") or 0) / 1024),
        "timeout_seconds": _timeout_for_request(payload),
        "part_title": payload.get("part", {}).get("title") if payload.get("part") else "Speaking section",
        "skill_focus": payload.get("part", {}).get("skill_focus") if payload.get("part") else None,
        "criteria": [
            {"criterion": item.get("criterion"), "max_marks": str(item.get("max_marks"))}
            for item in payload.get("rubric", [])
        ],
        "parts": [
            {
                "part_id": part.get("part_id"),
                "title": part.get("title"),
                "criteria": [
                    {"criterion": item.get("criterion"), "max_marks": str(item.get("max_marks"))}
                    for item in part.get("rubric", [])
                ],
            }
            for part in payload.get("parts", [])
        ],
        "submissions": submissions,
    }


def _declared_quota_limits(db: Session) -> dict:
    raw = get_setting(db, "ai.quota_limits")
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _default_rpm_limit(config: dict) -> Optional[int]:
    provider = str(config.get("provider") or "").lower()
    if provider != "gemini":
        return None
    model = str(config.get("model") or "").lower()
    return DEFAULT_GEMINI_PRO_RPM if "pro" in model else DEFAULT_GEMINI_FLASH_RPM


def _quota_limit_key(label: object, model: object) -> str:
    key = str(label or "Primary API Key").strip() or "Primary API Key"
    model_name = str(model or "").strip()
    return f"{key} · {model_name}" if model_name else key


def _rpm_limit_for_config(db: Session, config: dict) -> Optional[int]:
    label = config.get("key_label") or "Primary API Key"
    limits = _declared_quota_limits(db)
    declared = limits.get(_quota_limit_key(label, config.get("model"))) or limits.get(label) or {}
    try:
        rpm = int(declared.get("rpm") or 0)
    except (TypeError, ValueError):
        rpm = 0
    return rpm if rpm > 0 else _default_rpm_limit(config)


def _provider_quota_sleep_seconds(db: Session, config: dict, now: Optional[datetime] = None) -> float:
    """How long to wait before sending the next provider call for this key.

    Google does not expose live quota over an API, so this mirrors the quota
    dashboard: use our own provider-call records and the declared/free-tier RPM.
    """
    limit = _rpm_limit_for_config(db, config)
    if not limit:
        return 0.0

    now = now or _now()
    window_start = now - timedelta(seconds=PROVIDER_RATE_LIMIT_WINDOW_SECONDS)
    key_label = config.get("key_label") or "Primary API Key"
    model = config.get("model")
    rows = (
        db.query(AiEvaluation.created_at)
        .filter(
            AiEvaluation.key_label == key_label,
            AiEvaluation.model == model,
            AiEvaluation.created_at >= window_start,
            AiEvaluation.status.notin_(("auto_zero", "not_sent")),
        )
        .order_by(AiEvaluation.created_at)
        .all()
    )
    if len(rows) < limit:
        return 0.0
    oldest = rows[0][0]
    if oldest is None:
        return 0.0
    return max(
        0.0,
        (oldest + timedelta(seconds=PROVIDER_RATE_LIMIT_WINDOW_SECONDS + PROVIDER_RATE_LIMIT_BUFFER_SECONDS) - now).total_seconds(),
    )


def _throttle_provider_quota(db: Session, config: dict) -> None:
    sleep_seconds = _provider_quota_sleep_seconds(db, config)
    if sleep_seconds > 0:
        logger.info(
            "AI evaluator quota throttle: waiting %.1fs before using %s",
            sleep_seconds,
            config.get("key_label") or "Primary API Key",
        )
        time.sleep(sleep_seconds)


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


def _gemini_batch_response_schema(parts: list[dict]) -> Optional[dict]:
    part_ids = [part.get("part_id") for part in parts if part.get("part_id") is not None]
    if not part_ids:
        return None
    return {
        "type": "OBJECT",
        "properties": {
            "parts": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "part_id": {"type": "INTEGER", "enum": part_ids},
                        "criteria": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "criterion": {"type": "STRING"},
                                    "marks_awarded": {"type": "NUMBER"},
                                    "rationale": {"type": "STRING"},
                                },
                                "required": ["criterion", "marks_awarded", "rationale"],
                            },
                        },
                        "comment": {"type": "STRING"},
                        "confidence": {"type": "NUMBER"},
                    },
                    "required": ["part_id", "criteria", "comment", "confidence"],
                },
            },
        },
        "required": ["parts"],
    }


def _batch_evaluation_prompt(payload: dict) -> str:
    sections = []
    for part in payload.get("parts", []):
        sections.append(
            f"Part ID: {part['part_id']}\n"
            f"Part Title: {part['title']}\n"
            f"Skill Focus: {part.get('skill_focus') or ''}\n"
            "Rubric Criteria:\n"
            + "\n".join(
                f"- {item['criterion']}: Max Marks = {item['max_marks']}"
                for item in part.get("rubric", [])
            )
        )
    return (
        f"Framework: {payload['framework']} ({payload['policy_version']})\n"
        f"Skill: {payload['skill'].upper()}\n\n"
        "Evaluate all supplied Speaking parts in this single request.\n\n"
        + "\n\n".join(sections)
        + "\n\nInstructions:\n"
        + payload["instructions"]
        + "\n\nREQUIRED JSON RESPONSE SCHEMA:\n"
        "{\n"
        '  "parts": [\n'
        '    {"part_id": number, "criteria": [{"criterion": "string", "marks_awarded": number, "rationale": "string"}], "comment": "string", "confidence": number}\n'
        "  ]\n"
        "}\n\n"
    )


def _model_is_gone(response: httpx.Response) -> bool:
    """Google's way of saying the number is disconnected.

    A retired model answers 404, and sometimes 400 with the reason in the body.
    Either way it is the model that is wrong, not the request - so the fix is
    to dial a different one, not to fail the paper.
    """
    if response.status_code == 404:
        return True
    if response.status_code not in (400, 403):
        return False
    body = (response.text or "").lower()
    return any(
        phrase in body
        for phrase in ("not found", "is not supported", "does not exist", "has been deprecated", "no longer available")
    )


def _gemini_evaluator(config: dict, payload: dict) -> dict:
    api_key = config["api_key"]
    requested_model = (config.get("model") or DEFAULT_GEMINI_MODEL).replace("–", "-").replace("—", "-").strip().removeprefix("models/")
    # What to call, and what to call instead if it will not answer. Checked
    # against Google's live directory rather than a name pinned in this file.
    model_chain = gemini_model_chain(requested_model, config.get("live_models"))
    model = model_chain[0]

    parts = []
    if payload.get("task") == "cefr_rubric_evaluation_batch":
        prompt_text = _batch_evaluation_prompt(payload)
        for part in payload.get("parts", []):
            parts.append({"text": f"\nPart ID {part['part_id']} - {part['title']}\n"})
            for resp in part.get("responses", []):
                parts.append({"text": f"Question Prompt: {resp['prompt']}\n"})
                if "audio_b64" in resp:
                    parts.append({
                        "inlineData": {
                            "mimeType": resp["mime_type"],
                            "data": resp["audio_b64"],
                        }
                    })
                    parts.append({"text": f"Evaluate this audio recording for part_id {part['part_id']}.\n"})
                elif "text" in resp:
                    parts.append({"text": f"Student Response for part_id {part['part_id']}:\n{resp['text']}\n"})
    else:
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
    schema = (
        _gemini_batch_response_schema(payload.get("parts", []))
        if payload.get("task") == "cefr_rubric_evaluation_batch"
        else _gemini_response_schema(payload["rubric"])
    )
    if schema:
        generation_config["responseSchema"] = schema

    gemini_payload = {
        "contents": [{"parts": parts}],
        "generationConfig": generation_config,
    }

    headers = _gemini_headers(api_key)

    timeout = _timeout_for_request(payload)
    with httpx.Client(timeout=timeout) as client:
        res = None
        for index, candidate in enumerate(model_chain):
            model = candidate
            url = f"{GEMINI_API_ROOT}/models/{candidate}:generateContent"
            res = client.post(url, headers=headers, json=gemini_payload)

            # A schema this endpoint will not accept must not cost the student
            # their evaluation - drop it and ask again in the original shape.
            if res.status_code == 400 and "responseSchema" in generation_config:
                logger.info("Gemini rejected the response schema; retrying without it")
                generation_config.pop("responseSchema")
                res = client.post(url, headers=headers, json=gemini_payload)

            last_candidate = index == len(model_chain) - 1
            if _model_is_gone(res) and not last_candidate:
                logger.warning(
                    "Gemini model %s is no longer available; trying %s",
                    candidate,
                    model_chain[index + 1],
                )
                continue
            if res.status_code == 429 and not last_candidate:
                logger.info("Gemini model %s returned 429, falling back to %s", candidate, model_chain[index + 1])
                # Retrying inside the same minute just spends another request
                # into a window that is already closed.
                time.sleep(RATE_LIMIT_RETRY_SECONDS)
                continue
            break

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
        # Carried out-of-band so the quota screen can report real token spend
        # rather than counting requests and hoping. Stripped before scoring.
        usage = (data.get("usageMetadata") or {}).get("totalTokenCount")
        if isinstance(parsed, dict) and usage is not None:
            parsed["_usage_tokens"] = usage
        # Carried back so the caller can correct the stored setting and say so,
        # rather than substituting silently on every call for ever.
        if isinstance(parsed, dict) and model != requested_model:
            parsed["_model_substituted"] = {"requested": requested_model, "used": model}
        return parsed
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        logger.error("Failed to parse Gemini response: %s | Raw: %s", exc, data)
        raise ValueError(f"Gemini API returned unparseable output: {exc}") from exc


def _evaluation_prompt(payload: dict) -> str:
    if payload.get("task") == "cefr_rubric_evaluation_batch":
        return _batch_evaluation_prompt(payload)
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
    if payload.get("task") == "cefr_rubric_evaluation_batch":
        for part in payload.get("parts", []):
            content.append({"type": "input_text", "text": f"\nPart ID {part['part_id']} - {part['title']}\n"})
            for resp in part.get("responses", []):
                content.append({"type": "input_text", "text": f"Question Prompt: {resp['prompt']}\n"})
                if "text" in resp:
                    content.append({"type": "input_text", "text": f"Student Response for part_id {part['part_id']}:\n{resp['text']}\n"})
                elif "audio_b64" in resp:
                    content.append({
                        "type": "input_audio",
                        "input_audio": {
                            "data": resp["audio_b64"],
                            "format": _audio_format(resp.get("mime_type")),
                        },
                    })
                    content.append({"type": "input_text", "text": f"Evaluate the attached audio response for part_id {part['part_id']}.\n"})
        schema = {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "parts": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "part_id": {"type": "number"},
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
                        "required": ["part_id", "criteria", "comment", "confidence"],
                    },
                },
            },
            "required": ["parts"],
        }
    else:
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
    timeout = _timeout_for_request(payload)
    with httpx.Client(timeout=timeout) as client:
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
    url = f"{GEMINI_API_ROOT}/models/{model}:generateContent"
    payload = {
        "contents": [{"parts": [
            {"text": prompt},
            {"inlineData": {"mimeType": mime_type, "data": audio_b64}},
        ]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.25},
    }
    with httpx.Client(timeout=45.0) as client:
        response = client.post(url, headers=_gemini_headers(config["api_key"]), json=payload)
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

    mime_type = _speaking_audio_mime_type(audio_path)
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


def _normalize_batch(result: dict, parts: list[ExamModulePart]) -> dict[int, dict]:
    if not isinstance(result, dict) or not isinstance(result.get("parts"), list):
        raise ValueError("Evaluator batch response must contain a parts list")
    parts_by_id = {part.id: part for part in parts}
    normalized: dict[int, dict] = {}
    for item in result["parts"]:
        try:
            part_id = int(item.get("part_id"))
        except (TypeError, ValueError):
            raise ValueError(f"Evaluator batch response contained an invalid part_id: {item.get('part_id')!r}") from None
        part = parts_by_id.get(part_id)
        if part is None or part_id in normalized:
            raise ValueError(f"Evaluator batch response contained an unexpected or duplicate part_id: {part_id}")
        normalized[part_id] = _normalize(item, part)
    if set(normalized) != set(parts_by_id):
        missing = sorted(set(parts_by_id) - set(normalized))
        raise ValueError(f"Evaluator batch response did not score every requested part: {missing}")
    return normalized


TRANSIENT_RETRY_SECONDS = 3.0


def _is_transient(exc: Exception) -> bool:
    """A blip worth one more try on the same key, rather than a verdict on it.

    Timeouts, dropped connections and 5xx are the provider having a moment; a
    401 or a malformed rubric is not, and retrying those just wastes the
    student's time before the instructor queue gets it anyway."""
    if isinstance(exc, (httpx.TimeoutException, httpx.TransportError)):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code >= 500
    if isinstance(exc, HTTPException):
        return exc.status_code >= 500 and exc.status_code != 503
    return False


def _alert_if_key_auth_error(db: Session, config: dict, exc: Exception) -> None:
    """A 401/403 from the provider means the configured key itself is bad
    (revoked, expired, wrong project) rather than a transient or quota issue -
    tell the super admins so they can fix Platform Settings."""
    status_code = None
    if isinstance(exc, httpx.HTTPStatusError):
        status_code = exc.response.status_code
    elif isinstance(exc, HTTPException):
        status_code = exc.status_code
    if status_code not in (401, 403):
        return
    from app.services.notification_service import notify_api_key_down

    provider_label = _provider_label(config.get("provider") or "unknown")
    notify_api_key_down(db, f"AI evaluation ({provider_label})", _redact_secrets(exc)[:300])


def _readable_response(raw: object) -> str:
    """The provider's own reply, kept for the log. Truncated: a rationale-heavy
    response is a few KB, but a misbehaving endpoint can return anything."""
    try:
        return json.dumps(raw, indent=2, default=str)[:8000]
    except Exception:
        return str(raw)[:8000]


def _evaluation_in_flight(db: Session, attempt_id: int, part_id: int, *, is_final: bool = False) -> bool:
    """True while another request for this same part is still with a provider.

    The pre-emptive trigger fires whenever a student leaves a Writing or
    Speaking part, so tabbing between two parts used to queue a fresh provider
    call each time - the fastest way there is to hit a per-minute rate limit
    with duplicate work. The cutoff keeps a crashed worker's abandoned row from
    blocking the part for ever, and follows the window that kind of attempt is
    actually allowed to spend with the provider."""
    window = IN_FLIGHT_FINAL_WINDOW_SECONDS if is_final else IN_FLIGHT_WINDOW_SECONDS
    cutoff = _now() - timedelta(seconds=window)
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
    try:
        payload = _payload(attempt, part)
    except HTTPException as exc:
        # Building the request used to fail before any row existed, so a part
        # that could not be sent at all left no trace: the AI marking log had
        # nothing for it and the student just saw "awaiting examiner marking"
        # with no reason. Record the attempt, then re-raise as before.
        db.add(AiEvaluation(
            attempt_id=attempt.id,
            part_id=part.id,
            requested_by_id=actor.id,
            provider=configs_to_try[0].get("provider") or "unknown",
            model=configs_to_try[0].get("model"),
            # Distinct from "failed": nothing was sent, so no key was charged
            # and this must not appear as quota the platform spent.
            status="not_sent",
            key_label=(configs_to_try[0].get("key_label") or "")[:80] or None,
            error=_redact_secrets(exc.detail)[:4000],
            duration_ms=0,
        ))
        db.commit()
        raise
    last_error: Optional[Exception] = None
    failed_records: list[AiEvaluation] = []

    for index, config in enumerate(configs_to_try):
        if evaluator is None:
            _throttle_provider_quota(db, config)
        record = AiEvaluation(
            attempt_id=attempt.id,
            part_id=part.id,
            requested_by_id=actor.id,
            provider=config["provider"],
            model=config.get("model"),
            status="running",
            key_label=(config.get("key_label") or "")[:80] or None,
            request_summary=_request_summary(payload, config),
        )
        db.add(record)
        db.flush()
        started = time.monotonic()
        try:
            call = evaluator or _remote_evaluator
            try:
                raw = call(config, payload)
            except Exception as first_error:
                if not _is_transient(first_error):
                    raise
                logger.info(
                    "Transient AI evaluator error for attempt %s part %s, retrying once: %s",
                    attempt.id,
                    part.id,
                    _redact_secrets(first_error)[:200],
                )
                time.sleep(TRANSIENT_RETRY_SECONDS)
                raw = call(config, payload)
            record.duration_ms = int((time.monotonic() - started) * 1000)
            if isinstance(raw, dict):
                record.tokens_used = raw.pop("_usage_tokens", None)
                substitution = raw.pop("_model_substituted", None)
                if substitution:
                    _record_model_substitution(db, config, substitution, record)
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
            record.error = _redact_secrets(exc.detail)[:4000]
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
            record.error = _redact_secrets(exc)[:4000]
            db.add(record)
            failed_records.append(record)
            _alert_if_key_auth_error(db, config, exc)

    db.commit()
    detail = _redact_secrets(getattr(last_error, "detail", last_error)) if last_error else "All AI evaluators failed"
    raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"All configured AI evaluators failed: {detail[:500]}")


def request_speaking_suggestions(
    db: Session,
    actor: User,
    attempt: TestAttempt,
    parts: list[ExamModulePart],
    evaluator: Optional[Callable[[dict, dict], dict]] = None,
) -> dict[int, dict]:
    speaking_parts = [part for part in parts if part.section_type == "speaking"]
    if not speaking_parts:
        return {}
    configs_to_try = _candidate_configs(db) if evaluator is None else [{
        "provider": "test_evaluator",
        "model": "test-model",
        "monthly_limit": DEFAULT_MONTHLY_LIMIT,
        "api_key": "test",
        "key_label": "Primary API Key",
    }]
    if not configs_to_try:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI evaluation is not enabled or fully configured")

    primary_part = sorted(speaking_parts, key=lambda item: item.sort_order)[0]
    limits = _limit_rows(db, attempt, int(configs_to_try[0].get("monthly_limit") or DEFAULT_MONTHLY_LIMIT))
    try:
        payload = _batch_payload(attempt, speaking_parts)
    except HTTPException as exc:
        db.add(AiEvaluation(
            attempt_id=attempt.id,
            part_id=primary_part.id,
            requested_by_id=actor.id,
            provider=configs_to_try[0].get("provider") or "unknown",
            model=configs_to_try[0].get("model"),
            status="not_sent",
            key_label=(configs_to_try[0].get("key_label") or "")[:80] or None,
            error=_redact_secrets(exc.detail)[:4000],
            duration_ms=0,
        ))
        db.commit()
        raise

    last_error: Optional[Exception] = None
    failed_records: list[AiEvaluation] = []
    for index, config in enumerate(configs_to_try):
        if evaluator is None:
            _throttle_provider_quota(db, config)
        record = AiEvaluation(
            attempt_id=attempt.id,
            part_id=primary_part.id,
            requested_by_id=actor.id,
            provider=config["provider"],
            model=config.get("model"),
            status="running",
            key_label=(config.get("key_label") or "")[:80] or None,
            request_summary=_request_summary(payload, config),
        )
        db.add(record)
        db.flush()
        started = time.monotonic()
        try:
            call = evaluator or _remote_evaluator
            raw = call(config, payload)
            record.duration_ms = int((time.monotonic() - started) * 1000)
            if isinstance(raw, dict):
                record.tokens_used = raw.pop("_usage_tokens", None)
                substitution = raw.pop("_model_substituted", None)
                if substitution:
                    _record_model_substitution(db, config, substitution, record)
            record.response_raw = _readable_response(raw)
            suggestions = _normalize_batch(raw, speaking_parts)
            record.status = "completed"
            record.suggestions = {"parts": {str(part_id): suggestion for part_id, suggestion in suggestions.items()}}
            for limit in limits:
                limit.used_count += 1
            db.add_all([record, *limits, *failed_records])
            db.commit()
            return suggestions
        except HTTPException as exc:
            last_error = exc
            record.status = "failed"
            record.duration_ms = int((time.monotonic() - started) * 1000)
            record.error = _redact_secrets(exc.detail)[:4000]
            db.add(record)
            failed_records.append(record)
            if exc.status_code == 429 and index == len(configs_to_try) - 1:
                db.commit()
                raise
            if exc.status_code == 429 and index < len(configs_to_try) - 1:
                time.sleep(RATE_LIMIT_KEY_SWITCH_SECONDS)
        except Exception as exc:
            last_error = exc
            record.status = "failed"
            record.duration_ms = int((time.monotonic() - started) * 1000)
            record.error = _redact_secrets(exc)[:4000]
            db.add(record)
            failed_records.append(record)
            _alert_if_key_auth_error(db, config, exc)

    db.commit()
    detail = _redact_secrets(getattr(last_error, "detail", last_error)) if last_error else "All AI evaluators failed"
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


def settle_unanswered_parts(db: Session, attempt: TestAttempt) -> int:
    """Score every empty or silent part zero, straight away.

    Called from the submit request so a student who skipped a Speaking part
    sees the zero with the rest of their result, instead of that part sitting
    on "awaiting examiner marking" until a background job gets to it and finds
    nothing to send. Parts that hold a real answer are left alone for the AI.
    """
    settled = 0
    db.flush()  # so grade rows created earlier in this request are visible
    grades_by_part = {
        grade.part_id: grade
        for grade in db.query(AttemptPartGrade).filter(AttemptPartGrade.attempt_id == attempt.id).all()
    }
    for part in attempt.module.parts:
        if part.auto_marked:
            continue
        grade = grades_by_part.get(part.id)
        if grade is not None and grade.status != PART_GRADE_PENDING:
            continue
        reason = _unanswered_reason(attempt, part)
        if not reason:
            continue
        _apply_zero_grade(db, attempt, part, reason)
        db.add(AiEvaluation(
            attempt_id=attempt.id,
            part_id=part.id,
            requested_by_id=attempt.user_id,
            provider="system",
            model=None,
            status="auto_zero",
            error=reason,
            duration_ms=0,
            request_summary={"skill": part.section_type, "part_title": part.title, "criteria": part.rubric or []},
        ))
        settled += 1
    if settled:
        db.commit()
    return settled


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
    pending_parts: list[ExamModulePart] = []
    for part in sorted(attempt.module.parts, key=lambda item: item.sort_order):
        if part.auto_marked or not part.ai_evaluation_enabled:
            continue
        grade = next((g for g in attempt.part_grades if g.part_id == part.id), None)
        if grade is not None and grade.status != PART_GRADE_PENDING:
            continue  # already graded (human beat the job to it, or re-run)

        # An empty or near-silent answer is a zero, not something to send to a
        # provider and then queue for a human. Settle it here so the student's
        # result finishes instead of waiting on a part with nothing in it.
        unanswered = _unanswered_reason(attempt, part)
        if unanswered:
            _apply_zero_grade(db, attempt, part, unanswered)
            db.add(AiEvaluation(
                attempt_id=attempt.id,
                part_id=part.id,
                requested_by_id=attempt.user_id,
                provider="system",
                model=None,
                status="auto_zero",
                error=unanswered,
                duration_ms=0,
                request_summary={"skill": part.section_type, "part_title": part.title, "criteria": part.rubric or []},
            ))
            db.commit()
            continue

        pending_parts.append(part)

    speaking_parts = [part for part in pending_parts if part.section_type == "speaking"]
    if speaking_parts:
        try:
            suggestions = request_speaking_suggestions(db, attempt.user, attempt, speaking_parts)
            for part in speaking_parts:
                _apply_ai_grade(db, attempt, part, suggestions[part.id])
            db.commit()
        except HTTPException as exc:
            if exc.status_code == 429:
                quota_exhausted = True
                pending_parts = [part for part in pending_parts if part.section_type != "speaking"]
            else:
                logger.exception("Automatic batch Speaking AI evaluation failed for attempt %s", attempt.id)
        except Exception:
            logger.exception("Automatic batch Speaking AI evaluation failed for attempt %s", attempt.id)

    for part in pending_parts:
        if part.section_type == "speaking":
            continue
        try:
            suggestion = request_suggestion(db, attempt.user, attempt, part)
        except HTTPException as exc:
            if exc.status_code == 429:
                logger.info(
                    "AI evaluation rate-limited for attempt %s part %s; the scheduler will retry the rest",
                    attempt.id,
                    part.id,
                )
                quota_exhausted = True
                # The next part would land in the same closed window. Speaking
                # parts are large, so one rate-limited part used to take the
                # rest of the paper down with it.
                break
            # Swallowed silently until now: the failed row was written, but
            # nothing said which part had gone missing or why.
            logger.warning(
                "AI evaluation refused for attempt %s part %s (%s): %s",
                attempt.id,
                part.id,
                exc.status_code,
                _redact_secrets(exc.detail)[:200],
            )
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


def retry_attempt_evaluation(db: Session, attempt: TestAttempt) -> dict:
    """Let a student ask for another AI marking pass on their own attempt.

    Only for an attempt still waiting in the grading queue with AI-eligible
    parts unmarked: once an instructor or the AI has scored a part, nothing
    here touches it. The work is queued, not run inline - a provider call takes
    tens of seconds, which is far too long to hold a tap open for.
    """
    from app.services import job_service

    if not config_status(db)["configured"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI marking is switched off right now. Your answers stay with an instructor.",
        )
    if attempt.status != ATTEMPT_GRADING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This attempt is not waiting for marking.",
        )

    grades_by_part = {grade.part_id: grade for grade in attempt.part_grades}
    pending = [
        part
        for part in attempt.module.parts
        if not part.auto_marked
        and part.ai_evaluation_enabled
        and (grades_by_part.get(part.id) is None or grades_by_part[part.id].status == PART_GRADE_PENDING)
    ]
    if not pending:
        # Distinguish "already marked" from "AI is switched off for these
        # parts" - they look identical to a student, and only one of them is
        # something anybody can act on.
        ai_disabled = [
            part
            for part in attempt.module.parts
            if not part.auto_marked
            and not part.ai_evaluation_enabled
            and (grades_by_part.get(part.id) is None or grades_by_part[part.id].status == PART_GRADE_PENDING)
        ]
        if ai_disabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"AI marking is switched off for the {len(ai_disabled)} remaining "
                    f"part{'s' if len(ai_disabled) != 1 else ''} of this test, so an instructor will mark them."
                ),
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Every part of this attempt has already been marked.",
        )
    if all(_unanswered_reason(attempt, part) for part in pending):
        # Nothing to send, but they should not stay pending either - settle
        # them now so the retry actually finishes the attempt.
        for part in pending:
            _apply_zero_grade(db, attempt, part, _unanswered_reason(attempt, part) or "Nothing was submitted for this part.")
        db.commit()
        from app.services.attempt_service import _finalize_if_all_graded

        _finalize_if_all_graded(db, attempt)
        db.commit()
        return {
            "queued": False,
            "parts": len(pending),
            "message": (
                f"{len(pending)} part{'s' if len(pending) != 1 else ''} had no answer recorded, so they scored zero. "
                "Ask an instructor to review if you think a recording was lost."
            ),
        }

    if any(_evaluation_in_flight(db, attempt.id, part.id, is_final=attempt.is_final) for part in pending):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An AI marking attempt is already running for this test. Give it a moment.",
        )

    job = job_service.enqueue_ai_auto_grade(db, attempt.id)
    db.commit()
    return {
        "queued": job is not None,
        "parts": len(pending),
        "message": (
            f"Sent {len(pending)} part{'s' if len(pending) != 1 else ''} back to the AI. "
            "This page updates as soon as it answers."
            if job is not None
            else "The AI is already working on this test."
        ),
    }


def _direct_part_evaluation_allowed(part: ExamModulePart) -> bool:
    return bool(
        part is not None
        and not part.auto_marked
        and part.ai_evaluation_enabled
        and part.section_type != "speaking"
    )


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
        if not _direct_part_evaluation_allowed(part):
            # Speaking is marked as a whole section after submission so a
            # four-part interview is one provider request instead of one
            # request per part, even if the frontend asks during the test.
            return

        # Check if it was already graded
        grade = next((g for g in attempt.part_grades if g.part_id == part_id), None)
        if grade is not None and grade.status != "pending":
            return  # Already graded

        if _evaluation_in_flight(db, attempt_id, part_id, is_final=attempt.is_final):
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


# ---- How long this evaluation should take -------------------------------
#
# The student watches a countdown while the provider works, so the figure has
# to come from their own submission rather than a fixed guess: 60 words and a
# 4-minute recording are not the same wait. Size sets the shape of the
# estimate; the median of recent real evaluations keeps it anchored, so a
# provider that is generally slow today does not leave every student watching a
# timer that expired a minute ago.

# The recorder writes Opus at roughly 3 KB a second (the same figure
# MIN_AUDIO_BYTES is derived from), which turns a file size into a duration
# without opening the file.
AUDIO_BYTES_PER_SECOND = 3 * 1024
# Picking the job off the queue and loading the attempt.
ESTIMATE_QUEUE_SECONDS = 5
ESTIMATE_WRITING_CALL_SECONDS = 12.0
ESTIMATE_WRITING_SECONDS_PER_WORD = 0.05
ESTIMATE_SPEAKING_CALL_SECONDS = 18.0
ESTIMATE_SPEAKING_SECONDS_PER_AUDIO_SECOND = 0.3
ESTIMATE_MIN_SECONDS = 20
ESTIMATE_MAX_SECONDS = 300
# How far a size-derived estimate may sit from what recent evaluations of the
# same skill actually took.
ESTIMATE_HISTORY_FLOOR = 0.6
ESTIMATE_HISTORY_CEILING = 2.5
ESTIMATE_HISTORY_SAMPLE = 40
ESTIMATE_HISTORY_MIN_ROWS = 5
ESTIMATE_HISTORY_TTL_SECONDS = 300

# skill -> (median seconds, cached at). Recomputed on demand; a student polling
# every few seconds must not put a query behind every tick.
_history_cache: dict[str, tuple[float, float]] = {}


def _median(values: list[float]) -> float:
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2


def _median_duration_seconds(db: Session, skill: str) -> Optional[float]:
    """Median wall time of recent completed evaluations for this skill."""
    cached = _history_cache.get(skill)
    now = time.monotonic()
    if cached and now - cached[1] < ESTIMATE_HISTORY_TTL_SECONDS:
        return cached[0] or None

    rows = (
        db.query(AiEvaluation.duration_ms)
        .join(ExamModulePart, ExamModulePart.id == AiEvaluation.part_id)
        .filter(
            AiEvaluation.status == "completed",
            AiEvaluation.duration_ms.isnot(None),
            ExamModulePart.section_type == skill,
        )
        .order_by(AiEvaluation.id.desc())
        .limit(ESTIMATE_HISTORY_SAMPLE)
        .all()
    )
    durations = [row[0] / 1000 for row in rows if row[0] and row[0] > 0]
    median = _median(durations) if len(durations) >= ESTIMATE_HISTORY_MIN_ROWS else 0.0
    _history_cache[skill] = (median, now)
    return median or None


def _part_input_size(attempt: TestAttempt, part: ExamModulePart) -> tuple[int, int]:
    """(words written, seconds recorded) the AI has to read for this part."""
    answers = {answer.question_id: answer for answer in attempt.answers}
    words = 0
    audio_bytes = 0
    for question in part.questions:
        answer = answers.get(question.id)
        if answer is None:
            continue
        if part.section_type == "speaking" and answer.audio_path:
            full_path = settings.storage_path / answer.audio_path
            try:
                audio_bytes += full_path.stat().st_size
            except OSError:
                continue
        else:
            text = (answer.response or {}).get("text") if answer.response else None
            if text:
                words += len(str(text).split())
    return words, int(audio_bytes / AUDIO_BYTES_PER_SECOND)


def estimate_evaluation(db: Session, attempt: TestAttempt, part_ids: set[int]) -> dict:
    """How long the parts still waiting on the AI should take, and why."""
    total = float(ESTIMATE_QUEUE_SECONDS)
    words = 0
    audio_seconds = 0
    skills: list[str] = []

    for part in attempt.module.parts:
        if part.id not in part_ids:
            continue
        part_words, part_audio = _part_input_size(attempt, part)
        words += part_words
        audio_seconds += part_audio
        if part.section_type not in skills:
            skills.append(part.section_type)

        if part.section_type == "speaking":
            seconds = ESTIMATE_SPEAKING_CALL_SECONDS + part_audio * ESTIMATE_SPEAKING_SECONDS_PER_AUDIO_SECOND
        else:
            seconds = ESTIMATE_WRITING_CALL_SECONDS + part_words * ESTIMATE_WRITING_SECONDS_PER_WORD

        median = _median_duration_seconds(db, part.section_type)
        if median:
            seconds = min(max(seconds, median * ESTIMATE_HISTORY_FLOOR), median * ESTIMATE_HISTORY_CEILING)
        total += seconds

    bounded = min(max(total, ESTIMATE_MIN_SECONDS), ESTIMATE_MAX_SECONDS)
    return {
        # Rounded to five seconds: the input is an estimate, and a countdown
        # starting at 1:47 claims a precision it does not have.
        "estimated_seconds": int(round(bounded / 5) * 5),
        "words": words,
        "audio_seconds": audio_seconds,
        "skills": skills,
    }
