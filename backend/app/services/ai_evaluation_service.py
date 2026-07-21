from datetime import datetime, timezone
from decimal import Decimal
from typing import Callable, Optional
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.attempt import AiEvaluation, AiEvaluationLimit, TestAttempt
from app.models.exam_module import ExamModulePart
from app.models.user import User
from app.services import cefr_service
from app.services.settings_service import get_setting

DEFAULT_MONTHLY_LIMIT = 100


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def config_status(db: Session) -> dict:
    enabled = (get_setting(db, "ai.enabled") or "false").lower() == "true"
    endpoint = get_setting(db, "ai.endpoint_url")
    api_key = get_setting(db, "ai.api_key")
    return {
        "enabled": enabled,
        "provider": get_setting(db, "ai.provider") or "custom_json",
        "endpoint_url": endpoint,
        "model": get_setting(db, "ai.model"),
        "monthly_limit": int(get_setting(db, "ai.monthly_limit") or DEFAULT_MONTHLY_LIMIT),
        "configured": bool(enabled and endpoint and api_key),
        "api_key": "********" if api_key else None,
    }


def _config(db: Session) -> dict:
    status = config_status(db)
    if not status["configured"]:
        raise HTTPException(status_code=503, detail="AI evaluation is not enabled or fully configured")
    parsed = urlparse(status["endpoint_url"])
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise HTTPException(status_code=503, detail="AI evaluator endpoint must be an HTTP or HTTPS URL")
    status["api_key"] = get_setting(db, "ai.api_key")
    return status


def _limit_row(db: Session, attempt: TestAttempt, monthly_limit: int) -> AiEvaluationLimit:
    period = _now().strftime("%Y-%m")
    institute_id = attempt.user.institute_id
    scope = f"institute:{institute_id}:{period}" if institute_id else f"direct:{period}"
    row = db.query(AiEvaluationLimit).filter(AiEvaluationLimit.scope_key == scope).with_for_update().first()
    if row is None:
        row = AiEvaluationLimit(
            scope_key=scope,
            institute_id=institute_id,
            period_key=period,
            monthly_limit=monthly_limit,
            used_count=0,
        )
        db.add(row)
        db.flush()
    else:
        row.monthly_limit = monthly_limit
    if row.used_count >= row.monthly_limit:
        raise HTTPException(status_code=429, detail="The monthly AI evaluation limit has been reached")
    return row


def _payload(attempt: TestAttempt, part: ExamModulePart) -> dict:
    answers = {answer.question_id: answer for answer in attempt.answers}
    responses = []
    for question in sorted(part.questions, key=lambda item: item.sort_order):
        answer = answers.get(question.id)
        text = (answer.response or {}).get("text") if answer and answer.response else None
        if text:
            responses.append({"prompt": question.prompt, "response": str(text)[:12000]})
    if not responses:
        raise HTTPException(
            status_code=400,
            detail="AI assistance currently requires a textual Writing response; Speaking audio remains human-evaluated",
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
            "Return JSON only. Score every rubric criterion from 0 to its max_marks, "
            "include a brief evidence-based rationale per criterion, an examiner comment, "
            "and confidence from 0 to 1. This is an advisory draft requiring human approval."
        ),
        "response_schema": {
            "criteria": [{"criterion": "string", "marks_awarded": "number", "rationale": "string"}],
            "comment": "string",
            "confidence": "number",
        },
    }


def _remote_evaluator(config: dict, payload: dict) -> dict:
    response = httpx.post(
        config["endpoint_url"],
        headers={"Authorization": f"Bearer {config['api_key']}", "Content-Type": "application/json"},
        json={"model": config.get("model"), **payload},
        timeout=30.0,
    )
    response.raise_for_status()
    data = response.json()
    return data.get("result", data)


def _normalize(result: dict, part: ExamModulePart) -> dict:
    if not isinstance(result, dict) or not isinstance(result.get("criteria"), list):
        raise ValueError("Evaluator response must contain a criteria list")
    rubric = {item["criterion"]: Decimal(str(item["max_marks"])) for item in (part.rubric or [])}
    normalized = []
    seen = set()
    for item in result["criteria"]:
        name = item.get("criterion")
        if name not in rubric or name in seen:
            raise ValueError(f"Unexpected or duplicate criterion: {name}")
        awarded = Decimal(str(item.get("marks_awarded")))
        if awarded < 0 or awarded > rubric[name]:
            raise ValueError(f"Marks for {name} are outside the rubric range")
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
        raise ValueError("Evaluator confidence must be between 0 and 1")
    return {
        "criteria": normalized,
        "comment": str(result.get("comment") or "")[:4000],
        "confidence": str(confidence),
        "human_review_required": True,
        "framework_version": cefr_service.FRAMEWORK_VERSION,
        "policy_version": cefr_service.POLICY_VERSION,
    }


def request_suggestion(
    db: Session,
    actor: User,
    attempt: TestAttempt,
    part: ExamModulePart,
    evaluator: Optional[Callable[[dict, dict], dict]] = None,
) -> dict:
    config = _config(db) if evaluator is None else {
        "provider": "test_evaluator",
        "model": "test-model",
        "monthly_limit": DEFAULT_MONTHLY_LIMIT,
    }
    limit = _limit_row(db, attempt, int(config["monthly_limit"]))
    record = AiEvaluation(
        attempt_id=attempt.id,
        part_id=part.id,
        requested_by_id=actor.id,
        provider=config["provider"],
        model=config.get("model"),
        status="running",
    )
    db.add(record)
    db.flush()
    try:
        raw = (evaluator or _remote_evaluator)(config, _payload(attempt, part))
        suggestion = _normalize(raw, part)
        record.status = "completed"
        record.suggestions = suggestion
        limit.used_count += 1
        db.add_all([record, limit])
        db.commit()
        return {"id": record.id, **suggestion}
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        record.status = "failed"
        record.error = str(exc)[:4000]
        db.add(record)
        db.commit()
        raise HTTPException(status_code=502, detail=f"AI evaluator returned an invalid response: {exc}")
