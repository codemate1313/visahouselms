"""Reads the AI evaluation trail back out in plain language.

Every row in `ai_evaluations` is one conversation with a provider: what the
platform asked it to mark, what it said, how long it took, and - when it went
wrong - why. This module is the reading side of that. It deliberately does no
grading work; it translates stored records for the System Logs screen, in the
words a super admin would use rather than the provider's.
"""
from typing import Optional, Tuple

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.attempt import AiEvaluation, TestAttempt
from app.models.user import User

MAX_PAGE_SIZE = 200

STATUS_LABELS = {
    "completed": "Marked successfully",
    "failed": "Could not mark",
    "running": "Still waiting on the AI",
    "auto_zero": "Scored zero - nothing submitted",
    "not_sent": "Never reached the AI",
}

# Ordered: the first pattern that matches an error decides the explanation, so
# the specific readings sit above the general ones.
FAILURE_EXPLANATIONS = (
    (
        ("rate limit", "429", "too many requests", "quota exceeded"),
        "The AI provider refused the request because too many were sent in a short time.",
        "This clears on its own. Spread submissions out, or raise the plan limit with the provider.",
    ),
    (
        ("timed out", "timeout", "readtimeout", "connecttimeout"),
        "The AI took longer to answer than the platform waits, so the request was abandoned.",
        "Usually a long Speaking recording or a slow provider. The answer is safe - an instructor can still mark it.",
    ),
    (
        ("unexpected or duplicate criterion", "did not score every rubric criterion"),
        "The AI answered, but scored criteria that do not match this part's rubric.",
        "Check the rubric criterion names on the module part; the AI is asked to use them exactly.",
    ),
    (
        ("unparseable", "json", "must contain a criteria list", "not a number"),
        "The AI replied in a shape the platform could not read.",
        "Usually a one-off. If it repeats on the same part, the prompt or the model needs a look.",
    ),
    (
        ("api key", "unauthorized", "401", "403", "permission", "invalid key"),
        "The AI provider rejected the API key.",
        "Check the key in Developer Settings - it may be expired, revoked, or missing billing.",
    ),
    (
        ("too large to send",),
        "The recordings for this part were too big to send to the AI.",
        "Long audio answers are the usual cause. An instructor can still mark it; shorter recordings will go through next time.",
    ),
    (
        ("no audio recording", "no textual response"),
        "There was nothing to mark - the student's answer was empty when the AI was asked.",
        "Nothing to fix here; the part goes to an instructor as normal.",
    ),
    (
        ("not enabled", "not fully configured", "503"),
        "AI marking is not switched on, or no provider is configured.",
        "Set a provider and key in Developer Settings, then AI marking resumes on the next submission.",
    ),
    (
        ("connect", "network", "dns", "ssl", "connection"),
        "The platform could not reach the AI provider.",
        "A network or provider outage. Attempts already submitted stay in the instructor queue.",
    ),
)


def _display_name(user: Optional[User]) -> str:
    if user is None:
        return "Unknown user"
    name = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return name or user.email


def explain_failure(error: Optional[str]) -> Optional[dict]:
    """Turn a provider or validation error into something a non-engineer can act on."""
    if not error:
        return None
    lowered = error.lower()
    for needles, what_happened, what_to_do in FAILURE_EXPLANATIONS:
        if any(needle in lowered for needle in needles):
            return {"what_happened": what_happened, "what_to_do": what_to_do, "technical_detail": error}
    return {
        "what_happened": "The AI could not complete this evaluation.",
        "what_to_do": "The technical detail below is the provider's own message. The attempt was sent to an instructor instead.",
        "technical_detail": error,
    }


def _row(record: AiEvaluation) -> dict:
    attempt = record.attempt
    part = record.part
    module = getattr(attempt, "module", None)
    return {
        "id": record.id,
        "status": record.status,
        "status_label": STATUS_LABELS.get(record.status, record.status),
        "student_name": _display_name(getattr(attempt, "user", None)),
        "student_email": getattr(getattr(attempt, "user", None), "email", None),
        "attempt_id": record.attempt_id,
        "module_title": getattr(module, "title", None) or "Unknown test",
        "part_title": getattr(part, "title", None) or f"Part #{record.part_id}",
        "skill": getattr(part, "section_type", None),
        "provider": record.provider,
        "model": record.model,
        "duration_ms": record.duration_ms,
        "created_at": record.created_at,
        "summary": _one_line_outcome(record),
    }


def _one_line_outcome(record: AiEvaluation) -> str:
    """The sentence that sits in the table row."""
    if record.status == "running":
        return "Sent to the AI - no answer back yet."
    if record.status == "not_sent":
        # Failed while the request was being built, so no key was charged.
        return record.error or "The request could not be built, so nothing was sent."
    if record.status == "auto_zero":
        # Never sent to a provider: there was nothing in the part to send.
        return record.error or "Scored zero because nothing was submitted for this part."
    if record.status == "failed":
        explanation = explain_failure(record.error)
        return explanation["what_happened"] if explanation else "The AI could not complete this evaluation."
    criteria = (record.suggestions or {}).get("criteria") or []
    if not criteria:
        return "The AI returned a result."
    awarded = sum(float(item.get("marks_awarded") or 0) for item in criteria)
    maximum = sum(float(item.get("max_marks") or 0) for item in criteria)
    return f"Marked {len(criteria)} criteria - {_trim(awarded)} out of {_trim(maximum)} marks."


def _trim(value: float) -> str:
    return str(int(value)) if float(value).is_integer() else f"{value:.1f}"


def query_evaluations(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 50,
    status: Optional[str] = None,
    search: Optional[str] = None,
) -> Tuple[list, int]:
    query = (
        db.query(AiEvaluation)
        .options(
            joinedload(AiEvaluation.attempt).joinedload(TestAttempt.user),
            joinedload(AiEvaluation.attempt).joinedload(TestAttempt.module),
            joinedload(AiEvaluation.part),
        )
    )
    if status:
        query = query.filter(AiEvaluation.status == status)
    if search:
        term = f"%{search.strip()}%"
        query = query.join(TestAttempt, TestAttempt.id == AiEvaluation.attempt_id).join(
            User, User.id == TestAttempt.user_id
        ).filter(
            or_(
                User.email.ilike(term),
                User.first_name.ilike(term),
                User.last_name.ilike(term),
                AiEvaluation.provider.ilike(term),
                AiEvaluation.model.ilike(term),
                AiEvaluation.error.ilike(term),
            )
        )

    total = query.count()
    page_size = min(max(page_size, 1), MAX_PAGE_SIZE)
    rows = (
        query.order_by(AiEvaluation.id.desc())
        .offset(max(page - 1, 0) * page_size)
        .limit(page_size)
        .all()
    )
    return [_row(record) for record in rows], total


def evaluation_detail(db: Session, evaluation_id: int) -> Optional[dict]:
    """Both halves of one exchange: what was asked, and what came back."""
    record = (
        db.query(AiEvaluation)
        .options(
            joinedload(AiEvaluation.attempt).joinedload(TestAttempt.user),
            joinedload(AiEvaluation.attempt).joinedload(TestAttempt.module),
            joinedload(AiEvaluation.part),
        )
        .filter(AiEvaluation.id == evaluation_id)
        .first()
    )
    if record is None:
        return None

    asked = record.request_summary or {}
    submissions = [
        {
            "prompt": item.get("prompt"),
            "description": (
                f"A {item['audio_kb']} KB recording ({item.get('format') or 'audio'})"
                if item.get("kind") == "audio"
                else f"{item.get('words', 0)} words of writing"
            ),
        }
        for item in asked.get("submissions", [])
    ]

    suggestion = record.suggestions or {}
    scores = [
        {
            "criterion": item.get("criterion"),
            "marks": f"{item.get('marks_awarded')} out of {item.get('max_marks')}",
            "level": item.get("cefr_level"),
            "reason": item.get("rationale"),
        }
        for item in (suggestion.get("criteria") or [])
    ]

    return {
        **_row(record),
        "asked": {
            "criteria": asked.get("criteria") or [],
            "submissions": submissions,
            "skill_focus": asked.get("skill_focus"),
            "key_label": asked.get("key_label"),
            # Written before the provider was called, so an old row that predates
            # this log simply has nothing to show rather than a wrong guess.
            "recorded": bool(record.request_summary),
        },
        "answered": {
            "scores": scores,
            "comment": suggestion.get("comment"),
            "confidence": suggestion.get("confidence"),
            "raw": record.response_raw,
        },
        "failure": explain_failure(record.error) if record.status == "failed" else None,
    }
