"""Versioned CEFR-aligned diagnostic evaluation for assessment attempts.

CEFR provides proficiency descriptors, not universal percentage cut scores.
The policy below therefore keeps calibrated module cut scores where they exist
and declares the local fallback conversion used for the other skills.
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from app.models.attempt import PART_GRADE_GRADED, TestAttempt
from app.services.module_blueprint_service import SECTION_BLUEPRINTS


POLICY_VERSION = "cefr-companion-2020-diagnostic-v1"
FRAMEWORK_VERSION = "CEFR Companion Volume 2020"
FRAMEWORK_SOURCE_URL = (
    "https://www.coe.int/en/web/common-european-framework-reference-languages/"
    "cefr-companion-volume-and-its-language-versions"
)

SKILL_LABELS = {
    "listening": "Listening",
    "reading": "Reading",
    "writing": "Writing",
    "speaking": "Speaking",
}

LEVEL_ORDER = {"Below B1": 0, "B1": 1, "B2": 2, "C1": 3, "C2": 4}

# Local diagnostic conversion for sections without validated raw-score cut
# scores. A future standard-setting study can replace this policy version
# without rewriting historical results.
PERCENTAGE_BANDS = (
    (Decimal("90"), "C2"),
    (Decimal("75"), "C1"),
    (Decimal("60"), "B2"),
    (Decimal("40"), "B1"),
)

GLOBAL_DESCRIPTORS = {
    "Below B1": "The assessed performance did not yet demonstrate the B1 target consistently.",
    "B1": "Can handle the main points of clear standard language and produce connected responses on familiar matters.",
    "B2": "Can understand complex main ideas and communicate clearly, in detail, and with effective independence.",
    "C1": "Can use language fluently, flexibly, and effectively for demanding academic and professional purposes.",
    "C2": "Can understand and express complex meaning with a high degree of precision, control, and fluency.",
}

SKILL_DESCRIPTORS = {
    "listening": {
        "Below B1": "Needs more support to follow the main message in clear, standard spoken English.",
        "B1": "Can follow the main points of clear standard speech on familiar and study-related topics.",
        "B2": "Can follow extended speech and complex lines of argument when the topic is reasonably familiar.",
        "C1": "Can understand extended speech, including implied relationships, even when it is not clearly structured.",
        "C2": "Can understand virtually any spoken language, including fast delivery and subtle distinctions.",
    },
    "reading": {
        "Below B1": "Needs more support to identify main points and relevant detail in straightforward texts.",
        "B1": "Can understand texts consisting mainly of common or study-related language and clear factual information.",
        "B2": "Can read articles and reports that develop viewpoints and arguments on contemporary or academic topics.",
        "C1": "Can understand long, complex factual and literary texts and recognise differences in style and implicit meaning.",
        "C2": "Can read virtually all forms of complex text with ease, including abstract and structurally intricate material.",
    },
    "writing": {
        "Below B1": "The response needs more control and development before it consistently meets the B1 writing target.",
        "B1": "Can write straightforward connected text on familiar subjects and give brief reasons or explanations.",
        "B2": "Can write clear, detailed text and develop a viewpoint with reasons, advantages, and disadvantages.",
        "C1": "Can write clear, well-structured text on complex subjects, highlighting significant points with controlled style.",
        "C2": "Can write smoothly flowing, complex text with precise expression, effective structure, and an appropriate style.",
    },
    "speaking": {
        "Below B1": "Speech needs more consistency in connected delivery, intelligibility, and independent interaction.",
        "B1": "Can connect phrases to describe experiences and give brief reasons while handling many familiar interactions.",
        "B2": "Can interact with useful fluency and give clear, detailed speech while explaining a viewpoint.",
        "C1": "Can speak fluently and flexibly, formulate ideas precisely, and produce clear, well-structured contributions.",
        "C2": "Can participate effortlessly and express fine shades of meaning precisely with consistently controlled speech.",
    },
}


def _decimal(value: object) -> Decimal:
    return Decimal(str(value or 0))


def _percentage(score: Decimal, maximum: Decimal) -> Decimal:
    if maximum <= 0:
        return Decimal("0")
    return (score * Decimal("100") / maximum).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)


def level_for_percentage(percentage: Decimal) -> str:
    for minimum, level in PERCENTAGE_BANDS:
        if percentage >= minimum:
            return level
    return "Below B1"


def criterion_level(marks_awarded: object, max_marks: object) -> str:
    maximum = _decimal(max_marks)
    return level_for_percentage(_percentage(_decimal(marks_awarded), maximum))


def _level_for_section(skill: str, score: Decimal, maximum: Decimal) -> tuple[str, str]:
    configured = SECTION_BLUEPRINTS.get(skill, {}).get("assessment", {}).get("score_bands", [])
    if configured and maximum == _decimal(SECTION_BLUEPRINTS[skill]["assessment"].get("raw_marks")):
        for band in sorted(configured, key=lambda item: _decimal(item["minimum"]), reverse=True):
            if score >= _decimal(band["minimum"]):
                return band["level"], "configured_raw_score"
        return "Below B1", "configured_raw_score"
    return level_for_percentage(_percentage(score, maximum)), "local_percentage"


def _section_profile(attempt: TestAttempt, skill: str) -> dict:
    answers_by_part: dict[int, list] = {}
    for answer in attempt.answers:
        answers_by_part.setdefault(answer.part_id, []).append(answer)
    grades_by_part = {grade.part_id: grade for grade in attempt.part_grades}

    score = Decimal("0")
    maximum = Decimal("0")
    pending = False
    part_count = 0
    for part in attempt.module.parts:
        if part.section_type != skill:
            continue
        part_count += 1
        if part.auto_marked:
            part_max = _decimal(part.max_marks)
            if part_max <= 0:
                part_max = sum((_decimal(question.points) for question in part.questions), Decimal("0"))
            maximum += part_max
            score += sum(
                (_decimal(answer.points_awarded) for answer in answers_by_part.get(part.id, [])),
                Decimal("0"),
            )
            continue

        rubric_max = sum((_decimal(item.get("max_marks")) for item in (part.rubric or [])), Decimal("0"))
        maximum += rubric_max
        grade = grades_by_part.get(part.id)
        if grade is None or grade.status != PART_GRADE_GRADED or grade.total_marks is None:
            pending = True
        else:
            score += _decimal(grade.total_marks)

    percentage = _percentage(score, maximum)
    level: Optional[str] = None
    method: Optional[str] = None
    if not pending and maximum > 0:
        level, method = _level_for_section(skill, score, maximum)

    return {
        "skill": skill,
        "label": SKILL_LABELS[skill],
        "status": "pending" if pending else "complete",
        "part_count": part_count,
        "raw_score": str(score),
        "max_score": str(maximum),
        "percentage": str(percentage),
        "level": level,
        "level_label": level if level else "Pending",
        "descriptor": SKILL_DESCRIPTORS[skill].get(level) if level else "Complete instructor grading to receive this skill level.",
        "mapping_method": method,
    }


def evaluate_attempt(attempt: TestAttempt) -> dict:
    present_skills = [
        skill
        for skill in ("listening", "reading", "writing", "speaking")
        if any(part.section_type == skill for part in attempt.module.parts)
    ]
    skills = [_section_profile(attempt, skill) for skill in present_skills]
    complete = bool(skills) and all(skill["status"] == "complete" for skill in skills)

    overall = None
    if complete:
        # CEFR encourages a skill profile. Where one summary is required, this
        # conservative policy reports the lowest demonstrated skill level.
        level = min((skill["level"] for skill in skills), key=lambda item: LEVEL_ORDER[item])
        overall = {
            "level": level,
            "label": level,
            "descriptor": GLOBAL_DESCRIPTORS[level],
            "aggregation": "lowest_completed_skill",
        }

    return {
        "framework": "CEFR",
        "framework_version": FRAMEWORK_VERSION,
        "policy_version": POLICY_VERSION,
        "status": "complete" if complete else "provisional",
        "overall": overall,
        "skills": skills,
        "source_url": FRAMEWORK_SOURCE_URL,
        "calibration_note": (
            "Diagnostic CEFR-aligned estimate. CEFR does not prescribe universal test cut scores; "
            "this LMS uses declared module cut scores where available and a versioned local mapping otherwise."
        ),
    }


def apply_evaluation(attempt: TestAttempt) -> dict:
    profile = evaluate_attempt(attempt)
    attempt.cefr_profile = profile
    attempt.cefr_policy_version = POLICY_VERSION
    attempt.cefr_level = profile["overall"]["level"] if profile["overall"] else None
    attempt.band_label = attempt.cefr_level
    return profile


def assessment_scale(skill: str) -> list[dict]:
    descriptors = SKILL_DESCRIPTORS.get(skill, GLOBAL_DESCRIPTORS)
    return [
        {"level": "Below B1", "marks": "0-3.5 / 8", "descriptor": descriptors["Below B1"]},
        {"level": "B1", "marks": "4-4.5 / 8", "descriptor": descriptors["B1"]},
        {"level": "B2", "marks": "5-5.5 / 8", "descriptor": descriptors["B2"]},
        {"level": "C1", "marks": "6-7.5 / 8", "descriptor": descriptors["C1"]},
        {"level": "C2", "marks": "8 / 8", "descriptor": descriptors["C2"]},
    ]
