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
from app.models.job import JOB_FAILED, JOB_PENDING, JOB_RUNNING, Job
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
    """Start of the current Gemini quota day, expressed in UTC.

    Pacific is UTC-8 in winter and UTC-7 in summer, so the fixed offset this
    used put every reset an hour out for two thirds of the year. The zone
    database knows which is in force; the fixed offset stays as a fallback for
    a host without one installed.
    """
    now = _now()
    try:
        from zoneinfo import ZoneInfo

        pacific = ZoneInfo("America/Los_Angeles")
        local = now.replace(tzinfo=timezone.utc).astimezone(pacific)
        midnight = local.replace(hour=0, minute=0, second=0, microsecond=0)
        return midnight.astimezone(timezone.utc).replace(tzinfo=None)
    except Exception:
        pacific_now = now + timedelta(hours=PACIFIC_OFFSET_HOURS)
        midnight = pacific_now.replace(hour=0, minute=0, second=0, microsecond=0)
        return midnight - timedelta(hours=PACIFIC_OFFSET_HOURS)


def _percent(used: int, limit: Optional[int]) -> Optional[float]:
    if not limit or limit <= 0:
        return None
    return round(min(999.0, used * 100 / limit), 1)


def _quota_limit_key(label: object, model: object) -> str:
    key = str(label or UNASSIGNED_KEY).strip() or UNASSIGNED_KEY
    model_name = str(model or "").strip()
    return f"{key} · {model_name}" if model_name else key


def _record_key_label(record: AiEvaluation) -> str:
    if record.key_label:
        return record.key_label
    summary = record.request_summary or {}
    return summary.get("key_label") or UNASSIGNED_KEY


def _record_model(record: AiEvaluation) -> Optional[str]:
    if record.model:
        return record.model
    summary = record.request_summary or {}
    model = summary.get("model")
    return str(model) if model else None


def _is_timeout_error(error: Optional[str]) -> bool:
    text = (error or "").lower()
    return "timeout" in text or "timed out" in text or "read timed out" in text


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

    def bucket(label: str, model: Optional[str] = None) -> dict:
        bucket_key = _quota_limit_key(label, model)
        return buckets.setdefault(bucket_key, {
            "key": bucket_key,
            "key_label": label,
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
        entry = bucket(key.get("label") or UNASSIGNED_KEY, key.get("model"))
        entry["enabled"] = bool(key.get("enabled", True))
        entry["model"] = key.get("model")
        entry["provider"] = key.get("provider")

    hourly: dict[str, dict] = defaultdict(lambda: {"requests": 0, "tokens": 0, "failed": 0})

    for record in rows:
        created = record.created_at
        if created is None:
            continue
        entry = bucket(_record_key_label(record), _record_model(record))
        tokens = record.tokens_used or 0
        if _record_model(record):
            entry["model"] = _record_model(record)
        if record.provider:
            entry["provider"] = record.provider

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
        declared = limits.get(label, {}) or limits.get(entry.get("key_label"), {})
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

    def quota_plan_for(skill: str) -> dict:
        plan_entries = []
        model_groups: dict[str, dict] = {}
        # The one implementation of the order lives in the evaluator. This used
        # to build its own copy, and the moment the real rule changed - pinned
        # model first, otherwise newest first - the card carried on describing
        # the old one, telling super admins a model was "in use" that nothing
        # would reach for.
        raw_entries = ai_evaluation_service.evaluation_plan(db, skill)

        for index, config in enumerate(raw_entries, start=1):
            label = config.get("key_label") or "Primary API Key"
            model = config.get("model")
            key = _quota_limit_key(label, model)
            declared = limits.get(key, {}) or limits.get(label, {})
            usage = buckets.get(key, {})
            try:
                rpd_limit = int(declared.get("rpd") or 0)
            except (TypeError, ValueError):
                rpd_limit = 0
            used_today = int(usage.get("requests_today") or 0)
            remaining_today = max(0, rpd_limit - used_today) if rpd_limit > 0 else None
            entry = {
                "rank": index,
                "key": key,
                "key_label": label,
                "key_id": config.get("key_id"),
                "provider": config.get("provider"),
                "model": model,
                "enabled": bool(config.get("enabled", True)),
                "requests_today": used_today,
                "rpd_limit": rpd_limit or None,
                "remaining_today": remaining_today,
                "exhausted": ai_evaluation_service.is_rpd_exhausted(db, config, model) if model else False,
            }
            plan_entries.append(entry)
            group = model_groups.setdefault(model or "Unselected model", {
                "model": model,
                "provider": config.get("provider"),
                "first_rank": index,
                "keys": 0,
                "requests_today": 0,
                "rpd_limit": 0,
                "remaining_today": 0,
                "unknown_limits": 0,
            })
            group["keys"] += 1
            group["requests_today"] += used_today
            if rpd_limit > 0:
                group["rpd_limit"] += rpd_limit
                group["remaining_today"] += remaining_today or 0
            else:
                group["unknown_limits"] += 1

        groups = sorted(model_groups.values(), key=lambda item: item["first_rank"])
        for position, group in enumerate(groups, start=1):
            # Where this model sits in the hierarchy - 1st, 2nd, 3rd choice.
            # `first_rank` counts key/model routes, so with two keys it reads
            # 1, 3, 5, 7 and looks like a bug.
            group["position"] = position
        for group in groups:
            if group["unknown_limits"] == group["keys"]:
                group["rpd_limit"] = None
                group["remaining_today"] = None
        return {
            "active": plan_entries[0] if plan_entries else None,
            "next": plan_entries[1] if len(plan_entries) > 1 else None,
            "entries": plan_entries,
            "model_groups": groups,
        }

    series = [
        {"hour": slot, **values}
        for slot, values in sorted(hourly.items())
    ]

    provider_rows_today = [
        row
        for row in rows
        if row.created_at
        and row.created_at >= day_start
        and row.status not in NON_PROVIDER_STATUSES
    ]
    completed_durations = [
        row.duration_ms
        for row in provider_rows_today
        if row.status == "completed" and row.duration_ms is not None
    ]
    failed_rows_today = [row for row in provider_rows_today if row.status == "failed"]
    last_error = next(
        (
            {
                "message": row.error,
                "provider": row.provider,
                "model": row.model,
                "created_at": row.created_at,
                "duration_ms": row.duration_ms,
                "key": _quota_limit_key(_record_key_label(row), _record_model(row)),
            }
            for row in sorted(failed_rows_today, key=lambda item: item.created_at or datetime.min, reverse=True)
            if row.error
        ),
        None,
    )
    last_success = next(
        (
            {
                "provider": row.provider,
                "model": row.model,
                "created_at": row.created_at,
                "duration_ms": row.duration_ms,
                "key": _quota_limit_key(_record_key_label(row), _record_model(row)),
            }
            for row in sorted(provider_rows_today, key=lambda item: item.created_at or datetime.min, reverse=True)
            if row.status == "completed"
        ),
        None,
    )
    ai_jobs = db.query(Job).filter(Job.type == "ai_auto_grade").all()
    queue = {
        "pending": sum(1 for job in ai_jobs if job.status == JOB_PENDING),
        "running": sum(1 for job in ai_jobs if job.status == JOB_RUNNING),
        "failed_today": sum(1 for job in ai_jobs if job.status == JOB_FAILED and job.created_at and job.created_at >= day_start),
    }
    performance = {
        "average_duration_ms": round(sum(completed_durations) / len(completed_durations)) if completed_durations else None,
        "slowest_duration_ms": max(completed_durations) if completed_durations else None,
        "timeout_failures_today": sum(1 for row in failed_rows_today if _is_timeout_error(row.error)),
        "last_success": last_success,
        "last_error": last_error,
    }

    status = ai_evaluation_service.config_status(db)
    totals = {
        "requests_last_minute": sum(item["requests_last_minute"] for item in keys),
        "requests_today": sum(item["requests_today"] for item in keys),
        "tokens_today": sum(item["tokens_today"] for item in keys),
        "failed_today": sum(item["failed_today"] for item in keys),
        "rate_limited_today": sum(item["rate_limited_today"] for item in keys),
        "not_sent_today": sum(item["not_sent_today"] for item in keys),
    }

    reading_writing_plan = quota_plan_for(ai_evaluation_service.SKILL_WRITING)
    speaking_plan = quota_plan_for(ai_evaluation_service.SKILL_SPEAKING)

    return {
        "enabled": bool(status.get("enabled")),
        "configured": bool(status.get("configured")),
        "keys": keys,
        "totals": totals,
        "queue": queue,
        "performance": performance,
        "plan": {
            "reading_writing": reading_writing_plan,
            "writing": reading_writing_plan,
            "speaking": speaking_plan,
        },
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
