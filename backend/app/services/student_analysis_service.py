from collections.abc import Callable
from typing import Optional

from sqlalchemy.orm import Session

from app.core.cache import app_cache
from app.models.attempt import AttemptAnswer, TestAttempt
from app.services import ai_evaluation_service, cefr_service


SKILL_COACHING = {
    "listening": (
        "Practise identifying keywords before the audio starts, then listen for paraphrases rather than exact word matches.",
        "Replay short academic conversations and write a one-sentence summary after each listen.",
    ),
    "reading": (
        "Underline the claim in each question and scan for synonyms in the passage before choosing an answer.",
        "Review every missed item and note whether the difficulty was vocabulary, inference, detail, or time management.",
    ),
    "writing": (
        "Plan a clear position and paragraph purpose before writing, then reserve time to check grammar and cohesion.",
        "Rewrite one paragraph using more precise topic sentences, evidence, and linking language.",
    ),
    "speaking": (
        "Record timed responses and check that each answer develops one idea with a reason and an example.",
        "Practise speaking in connected phrases while monitoring pronunciation, pace, and repeated vocabulary.",
    ),
}


def _has_response(answer: Optional[AttemptAnswer]) -> bool:
    if answer is None:
        return False
    if answer.audio_path:
        return True
    response = answer.response or {}
    selected = response.get("selected")
    if isinstance(selected, list):
        return bool(selected)
    if isinstance(selected, str) and selected.strip():
        return True
    text = response.get("text")
    return bool(isinstance(text, str) and text.strip()) or bool(response.get("recorded"))


def _metrics(attempt: TestAttempt) -> tuple[dict, list[dict]]:
    answers = {answer.question_id: answer for answer in attempt.answers}
    profile_by_skill = {
        item["skill"]: item for item in ((attempt.cefr_profile or {}).get("skills") or [])
    }
    overall = {"total": 0, "attempted": 0, "correct": 0, "incorrect": 0, "pending": 0, "unanswered": 0}
    section_metrics: list[dict] = []

    for skill in ("listening", "reading", "writing", "speaking"):
        parts = [part for part in attempt.module.parts if part.section_type == skill]
        if not parts:
            continue
        metric = {
            "skill": skill,
            "label": cefr_service.SKILL_LABELS[skill],
            "total": 0,
            "attempted": 0,
            "correct": 0,
            "incorrect": 0,
            "pending": 0,
            "percentage": "0",
            "cefr_level": None,
        }
        for part in parts:
            for question in part.questions:
                metric["total"] += 1
                answer = answers.get(question.id)
                if not _has_response(answer):
                    continue
                metric["attempted"] += 1
                if answer.is_correct is True:
                    metric["correct"] += 1
                elif answer.is_correct is False:
                    metric["incorrect"] += 1
                else:
                    metric["pending"] += 1

        skill_profile = profile_by_skill.get(skill)
        if skill_profile:
            metric["percentage"] = str(skill_profile.get("percentage") or "0")
            metric["cefr_level"] = skill_profile.get("level_label")
        elif metric["attempted"]:
            metric["percentage"] = str(round(metric["correct"] * 100 / metric["attempted"], 1))

        for key in ("total", "attempted", "correct", "incorrect", "pending"):
            overall[key] += metric[key]
        section_metrics.append(metric)

    overall["unanswered"] = max(0, overall["total"] - overall["attempted"])
    return overall, section_metrics


def _fallback_analysis(attempt: TestAttempt) -> dict:
    metrics, section_metrics = _metrics(attempt)
    attempted = metrics["attempted"]
    accuracy = round(metrics["correct"] * 100 / attempted, 1) if attempted else 0
    overall_level = ((attempt.cefr_profile or {}).get("overall") or {}).get("label")

    if metrics["pending"]:
        summary = (
            f"You attempted {attempted} of {metrics['total']} questions. Objective items are currently {accuracy}% correct, "
            "and the final profile will update after the remaining examiner-marked responses are graded."
        )
    elif accuracy >= 80:
        summary = f"You attempted {attempted} of {metrics['total']} questions with {accuracy}% accuracy, showing strong control of the assessed material."
    elif accuracy >= 60:
        summary = f"You attempted {attempted} of {metrics['total']} questions with {accuracy}% accuracy. The foundation is sound, with a few recurring gaps to target."
    else:
        summary = f"You attempted {attempted} of {metrics['total']} questions with {accuracy}% accuracy. Focused practice on the weakest skill should produce the fastest improvement."
    if overall_level:
        summary += f" Your current CEFR-aligned profile is {overall_level}."

    ranked = sorted(section_metrics, key=lambda item: float(item["percentage"]), reverse=True)
    strengths: list[str] = []
    improvements: list[str] = []
    next_steps: list[str] = []

    if metrics["attempted"] == metrics["total"] and metrics["total"]:
        strengths.append("You completed every question, which gives a reliable picture of your current performance.")
    elif metrics["attempted"]:
        strengths.append(f"You engaged with {metrics['attempted']} questions and saved a response for each attempted item.")
    if ranked:
        strongest = ranked[0]
        strengths.append(
            f"{strongest['label']} is currently your strongest measured area at {strongest['percentage']}%."
        )

    if metrics["unanswered"]:
        improvements.append(
            f"{metrics['unanswered']} question{'s were' if metrics['unanswered'] != 1 else ' was'} left unanswered; use part navigation to check completion before submitting."
        )
    if ranked:
        weakest = ranked[-1]
        if len(ranked) > 1 or float(weakest["percentage"]) < 80:
            improvements.append(
                f"Prioritise {weakest['label']}, currently the lowest measured area at {weakest['percentage']}%."
            )
        next_steps.extend(SKILL_COACHING[weakest["skill"]])
    if metrics["incorrect"]:
        improvements.append(
            f"Review the reasoning behind {metrics['incorrect']} incorrect response{'s' if metrics['incorrect'] != 1 else ''}, not only the answer key."
        )
    if metrics["pending"]:
        improvements.append("Use the examiner feedback on Writing or Speaking before treating this analysis as final.")
    if not improvements:
        improvements.append("Maintain this level by repeating a timed set and checking that accuracy remains consistent.")

    return {
        "generated_by": "cefr_analysis_engine",
        "ai_enabled": False,
        "summary": summary,
        "strengths": strengths[:3],
        "improvements": improvements[:4],
        "next_steps": list(dict.fromkeys(next_steps))[:4],
        "metrics": metrics,
        "section_metrics": section_metrics,
        "framework_version": cefr_service.FRAMEWORK_VERSION,
    }


def _payload(attempt: TestAttempt, fallback: dict) -> dict:
    return {
        "task": "student_result_coaching",
        "framework": cefr_service.FRAMEWORK_VERSION,
        "policy_version": cefr_service.POLICY_VERSION,
        "assessment": {
            "module_type": attempt.module.module_type,
            "status": attempt.status,
            "cefr_profile": attempt.cefr_profile,
            "metrics": fallback["metrics"],
            "section_metrics": fallback["section_metrics"],
        },
        "instructions": (
            "Return JSON only. Give concise, encouraging, evidence-based coaching from the supplied aggregate results. "
            "Do not invent errors, abilities, personal facts, or CEFR levels. Provide a summary, strengths, improvements, "
            "and practical next_steps."
        ),
        "response_schema": {
            "summary": "string",
            "strengths": ["string"],
            "improvements": ["string"],
            "next_steps": ["string"],
        },
    }


def _clean_list(value: object, fallback: list[str]) -> list[str]:
    if not isinstance(value, list):
        return fallback
    cleaned = [str(item).strip()[:500] for item in value if str(item).strip()]
    return cleaned[:5] or fallback


def _normalize_ai_result(result: object, fallback: dict) -> dict:
    if not isinstance(result, dict):
        raise ValueError("AI result analysis must be a JSON object")
    summary = str(result.get("summary") or "").strip()
    if not summary:
        raise ValueError("AI result analysis must include a summary")
    return {
        **fallback,
        "generated_by": "configured_ai",
        "ai_enabled": True,
        "summary": summary[:1500],
        "strengths": _clean_list(result.get("strengths"), fallback["strengths"]),
        "improvements": _clean_list(result.get("improvements"), fallback["improvements"]),
        "next_steps": _clean_list(result.get("next_steps"), fallback["next_steps"]),
    }


def result_analysis(
    db: Session,
    attempt: TestAttempt,
    evaluator: Optional[Callable[[dict, dict], dict]] = None,
) -> dict:
    fallback = _fallback_analysis(attempt)
    if evaluator is None:
        status = ai_evaluation_service.config_status(db)
        if not status["configured"]:
            return fallback

    cache_key = (
        f"student-result-analysis:{attempt.id}:{attempt.status}:{attempt.raw_score}:"
        f"{attempt.graded_at.isoformat() if attempt.graded_at else 'pending'}"
    )
    cached = app_cache.get(cache_key)
    if cached is not None and evaluator is None:
        return cached

    try:
        config = ai_evaluation_service._config(db) if evaluator is None else {"provider": "test"}
        raw = (evaluator or ai_evaluation_service._remote_evaluator)(config, _payload(attempt, fallback))
        analysis = _normalize_ai_result(raw, fallback)
        if evaluator is None:
            app_cache.set(cache_key, analysis, ttl_seconds=3600)
        return analysis
    except Exception:
        return fallback
