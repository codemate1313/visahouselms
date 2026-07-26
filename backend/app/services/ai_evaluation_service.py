import base64
import json
import logging
import mimetypes
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.models.attempt import AiEvaluation, AiEvaluationLimit, TestAttempt
from app.models.exam_module import ExamModulePart
from app.models.user import User
from app.services import cefr_service
from app.services.settings_service import get_setting

from app.models.institute import Institute

logger = logging.getLogger(__name__)

DEFAULT_MONTHLY_LIMIT = 100
DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"

POOL_EXHAUSTED = "The monthly AI evaluation limit has been reached"
STUDENT_EXHAUSTED = (
    "You have used all {limit} of your monthly AI evaluations. "
    "Ask your institute admin to raise your quota or try again next month."
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

    if provider == "gemini":
        configured = bool(enabled and api_key)
    elif provider == "custom_json":
        configured = bool(enabled and endpoint and api_key)
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
    }


def _config(db: Session) -> dict:
    status = config_status(db)
    if not status["configured"]:
        raise HTTPException(status_code=503, detail="AI evaluation is not enabled or fully configured")
    if status["provider"] == "custom_json":
        parsed = urlparse(status["endpoint_url"] or "")
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise HTTPException(status_code=503, detail="AI evaluator endpoint must be an HTTP or HTTPS URL")
    status["api_key"] = get_setting(db, "ai.api_key") or settings.ai_api_key
    return status


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


def _limit_rows(db: Session, attempt: TestAttempt, monthly_limit: int) -> list[AiEvaluationLimit]:
    """Institute students are metered individually - each gets their own monthly
    bucket, so no student can eat into anyone else's allowance. Direct (B2C)
    students have no institute to divide, so they share the platform pool."""
    period = _now().strftime("%Y-%m")
    institute_id = attempt.user.institute_id

    if not institute_id:
        pool = _bucket(db, f"direct:{period}", period, monthly_limit, None, None)
        if pool.used_count >= pool.monthly_limit:
            raise HTTPException(status_code=429, detail=POOL_EXHAUSTED)
        return [pool]

    inst = db.query(Institute).filter(Institute.id == institute_id).first()
    student_limit = monthly_limit
    if inst and inst.ai_student_monthly_limit is not None and inst.ai_student_monthly_limit > 0:
        student_limit = inst.ai_student_monthly_limit

    student = _bucket(
        db, f"student:{attempt.user_id}:{period}", period, student_limit, institute_id, attempt.user_id
    )
    if student.used_count >= student.monthly_limit:
        raise HTTPException(
            status_code=429,
            detail=STUDENT_EXHAUSTED.format(limit=student.monthly_limit),
        )
    return [student]


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
                status_code=400,
                detail="No audio recording found for this Speaking part to evaluate",
            )
        else:
            raise HTTPException(
                status_code=400,
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
            "You are an expert IELTS and CEFR language examiner. "
            "Analyze the student's submission carefully against the provided rubric criteria. "
            "Return JSON ONLY matching the required schema. "
            "Score EVERY rubric criterion strictly between 0 and its max_marks. "
            "Provide a brief, evidence-based rationale for each criterion, an overall examiner summary comment, "
            "and a confidence rating between 0 and 1. "
            "This is an advisory draft requiring human instructor review."
        ),
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

    gemini_payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2,
        },
    }

    headers = {"Content-Type": "application/json"}
    
    with httpx.Client(timeout=45.0) as client:
        res = client.post(url, headers=headers, json=gemini_payload)
        
        if res.status_code == 429:
            raise HTTPException(
                status_code=429,
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


def _remote_evaluator(config: dict, payload: dict) -> dict:
    provider = config.get("provider") or "gemini"
    
    if provider == "gemini":
        return _gemini_evaluator(config, payload)
    
    # Custom JSON HTTP endpoint
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
    limits = _limit_rows(db, attempt, int(config["monthly_limit"]))
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
        for limit in limits:
            limit.used_count += 1
        db.add_all([record, *limits])
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
