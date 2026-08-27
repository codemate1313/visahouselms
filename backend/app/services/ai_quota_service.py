"""What the AI marking quota is doing, per key.

Google does not publish your limits over the API - the numbers live in AI
Studio and change by model and tier - so this module never pretends to read
them. It measures what *we* spent from our own evaluation records, and compares
that against limits a super admin enters for each key. Usage is real; the
ceilings are declared.

Three things are counted, because Gemini enforces three separate limits:
requests per minute, tokens per minute, and requests per day (which resets at
midnight Pacific, not local midnight).
"""
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.attempt import AiEvaluation
from app.services import ai_evaluation_service
from app.services.settings_service import get_setting, set_setting

# Gemini's daily counter rolls over at midnight Pacific. Using local midnight
# would report a full allowance while Google still counted yesterday's calls.
PACIFIC_OFFSET_HOURS = -8

# Rows that never reached a provider: an empty part scored zero locally, or a
# request that failed while it was still being built. Real outcomes worth
# seeing, but they cost no quota, so they are counted apart from usage.
NON_PROVIDER_STATUSES = {"auto_zero", "not_sent"}

# Evaluations recorded before per-key attribution existed. Nothing new lands
# here - every dispatched call now carries the label of the key that paid.
UNASSIGNED_KEY = "Before per-key tracking"


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _pacific_day_start() -> datetime:
    """Start of the current Gemini quota day, expressed in UTC."""
    pacific_now = _now() + timedelta(hours=PACIFIC_OFFSET_HOURS)
    midnight = pacific_now.replace(hour=0, minute=0, second=0, microsecond=0)
    return midnight - timedelta(hours=PACIFIC_OFFSET_HOURS)


def _percent(used: int, limit: Optional[int]) -> Optional[float]:
    if not limit or limit <= 0:
        return None
    return round(min(999.0, used * 100 / limit), 1)


def _bucket_label(record: AiEvaluation) -> str:
    if record.key_label:
        return record.key_label
    summary = record.request_summary or {}
    return summary.get("key_label") or UNASSIGNED_KEY


def get_declared_limits(db: Session) -> dict:
    """Per-key limits as entered by an admin: {key label: {rpm, tpm, rpd}}."""
    raw = get_setting(db, "ai.quota_limits")
    if not raw:
        return {}
    import json

    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except (TypeError, ValueError):
        return {}


def save_declared_limits(db: Session, limits: dict) -> dict:
    import json

    cleaned: dict = {}
    for label, values in (limits or {}).items():
        if not isinstance(values, dict):
            continue
        entry = {}
        for field in ("rpm", "tpm", "rpd"):
            value = values.get(field)
            if value in (None, "", 0):
                continue
            try:
                entry[field] = max(0, int(value))
            except (TypeError, ValueError):
                continue
        if entry:
            cleaned[str(label)[:80]] = entry
    set_setting(db, "ai.quota_limits", json.dumps(cleaned) if cleaned else None)
    return cleaned


def usage_summary(db: Session) -> dict:
    now = _now()
    minute_start = now - timedelta(minutes=1)
    hour_start = now - timedelta(hours=1)
    day_start = _pacific_day_start()
    window_start = min(day_start, now - timedelta(hours=24))

    rows = (
        db.query(AiEvaluation)
        .filter(AiEvaluation.created_at >= window_start)
        .all()
    )

    limits = get_declared_limits(db)
    configured_keys = ai_evaluation_service._configured_keys(db, mask=True)
    buckets: dict[str, dict] = {}

    def bucket(label: str) -> dict:
        return buckets.setdefault(label, {
            "key": label,
            "requests_last_minute": 0,
            "requests_last_hour": 0,
            "requests_today": 0,
            "tokens_last_minute": 0,
            "tokens_today": 0,
            "failed_today": 0,
            "rate_limited_today": 0,
            "not_sent_today": 0,
            "enabled": True,
        })

    for key in configured_keys:
        entry = bucket(key.get("label") or UNASSIGNED_KEY)
        entry["enabled"] = bool(key.get("enabled", True))
        entry["model"] = key.get("model")
        entry["provider"] = key.get("provider")

    hourly: dict[str, dict] = defaultdict(lambda: {"requests": 0, "tokens": 0, "failed": 0})

    for record in rows:
        created = record.created_at
        if created is None:
            continue
        entry = bucket(_bucket_label(record))
        tokens = record.tokens_used or 0

        if record.status in NON_PROVIDER_STATUSES:
            # Counted, but never as quota - Google was not called.
            if created >= day_start:
                entry["not_sent_today"] += 1
            continue

        if created >= day_start:
            entry["requests_today"] += 1
            entry["tokens_today"] += tokens
            if record.status == "failed":
                entry["failed_today"] += 1
                if "rate limit" in (record.error or "").lower() or "429" in (record.error or ""):
                    entry["rate_limited_today"] += 1
        if created >= hour_start:
            entry["requests_last_hour"] += 1
        if created >= minute_start:
            entry["requests_last_minute"] += 1
            entry["tokens_last_minute"] += tokens

        slot = created.replace(minute=0, second=0, microsecond=0).isoformat()
        hourly[slot]["requests"] += 1
        hourly[slot]["tokens"] += tokens
        if record.status == "failed":
            hourly[slot]["failed"] += 1

    keys = []
    for label, entry in buckets.items():
        declared = limits.get(label, {})
        keys.append({
            **entry,
            "limits": {
                "rpm": declared.get("rpm"),
                "tpm": declared.get("tpm"),
                "rpd": declared.get("rpd"),
            },
            "usage_percent": {
                "rpm": _percent(entry["requests_last_minute"], declared.get("rpm")),
                "tpm": _percent(entry["tokens_last_minute"], declared.get("tpm")),
                "rpd": _percent(entry["requests_today"], declared.get("rpd")),
            },
        })
    keys.sort(key=lambda item: (-item["requests_today"], item["key"]))

    series = [
        {"hour": slot, **values}
        for slot, values in sorted(hourly.items())
    ]

    status = ai_evaluation_service.config_status(db)
    totals = {
        "requests_last_minute": sum(item["requests_last_minute"] for item in keys),
        "requests_today": sum(item["requests_today"] for item in keys),
        "tokens_today": sum(item["tokens_today"] for item in keys),
        "failed_today": sum(item["failed_today"] for item in keys),
        "rate_limited_today": sum(item["rate_limited_today"] for item in keys),
        "not_sent_today": sum(item["not_sent_today"] for item in keys),
    }

    return {
        "enabled": bool(status.get("enabled")),
        "configured": bool(status.get("configured")),
        "keys": keys,
        "totals": totals,
        "series": series,
        "day_started_at": day_start,
        # So the screen can say when the daily allowance comes back rather than
        # only when it started counting.
        "day_resets_at": day_start + timedelta(days=1),
        "limits_declared": bool(limits),
        # Said plainly on the screen: these ceilings are typed in, not read from
        # Google, because there is no API that reports them.
        "limits_note": "Limits are the values entered for each key - Google does not expose them over the API. Check them in AI Studio.",
    }


def set_ai_marking_enabled(db: Session, enabled: bool) -> dict:
    """Master switch. Off means every Writing/Speaking part goes straight to the
    instructor queue it was already routed to, and nothing further is sent to a
    provider."""
    from app.models.job import JOB_PENDING, Job

    set_setting(db, "ai.enabled", "true" if enabled else "false")

    cancelled = 0
    if not enabled:
        # Queued work would otherwise keep calling the provider after the
        # switch was thrown.
        for job in db.query(Job).filter(Job.type == "ai_auto_grade", Job.status == JOB_PENDING).all():
            job.status = "done"
            job.result = "Cancelled: AI marking was switched off."
            job.finished_at = datetime.now(timezone.utc)
            cancelled += 1
        db.commit()

    return {
        "enabled": enabled,
        "cancelled_jobs": cancelled,
        "message": (
            "AI marking is on. New Writing and Speaking answers are sent for AI marking first."
            if enabled
            else f"AI marking is off. Writing and Speaking answers go straight to their instructor queue"
            + (f"; {cancelled} queued job(s) stopped." if cancelled else ".")
        ),
    }
