import json
from collections.abc import Callable
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.core.cache import app_cache
from app.models.attempt import PART_GRADE_AI_GRADED, PART_GRADE_GRADED, AttemptAnswer, TestAttempt
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

# What each question format actually tests, and the drill that moves it. Keyed
# by the authoring vocabulary in module_blueprint_service, so a part built from
# any blueprint resolves without a lookup table per module.
QUESTION_TYPE_PROFILES = {
    "mcq_single": (
        "Multiple choice",
        "choosing one option against close distractors",
        "Before looking at the options, answer the question in your own words - then pick the option that matches your answer instead of the one that merely repeats words from the text.",
    ),
    "mcq_multiple": (
        "Multiple answer",
        "finding every correct option, not just the first",
        "These score only on an exact set. Check each option separately and count how many the instruction asks for before you move on.",
    ),
    "true_false_not_given": (
        "True / False / Not Given",
        "separating what a text contradicts from what it never mentions",
        "Not Given means the text is silent, False means the text says the opposite. Point to the exact line that decides it - if you cannot, the answer is Not Given.",
    ),
    "yes_no_not_given": (
        "Yes / No / Not Given",
        "tracking the writer's opinion rather than the facts",
        "Underline the opinion words in the claim and match them to the writer's stance, not to the topic.",
    ),
    "matching_unique": (
        "Gap matching",
        "using cohesion and text organisation to place a sentence",
        "Read the sentences either side of the gap first. Pronouns, linkers and repeated nouns decide the fit far more often than topic does.",
    ),
    "matching_reusable": (
        "Matching",
        "assigning each item to the right source or speaker",
        "Work through the options once, marking the ones you can rule out, so the remaining decisions get easier rather than harder.",
    ),
    "short_answer": (
        "Short answer",
        "producing the exact wording the answer key accepts",
        "Answer with words taken from the text and respect the word limit - a correct idea in too many words still scores zero.",
    ),
    "fill_blank": (
        "Gap fill",
        "hearing or reading the precise word that fits the gap",
        "Predict the part of speech the gap needs before you read or listen, then check the completed sentence still makes grammatical sense.",
    ),
    "essay": ("Extended writing", "sustained written argument", ""),
    "speaking_prompt": ("Spoken response", "sustained spoken response", ""),
}

DIFFICULTY_LABELS = {"easy": "Easier items", "medium": "Standard items", "hard": "Harder items"}
DIFFICULTY_ORDER = {"easy": 0, "medium": 1, "hard": 2}

# Rubric criteria are authored per part, so match on the words examiners
# actually use rather than on a fixed criterion id.
# Structured by (criterion_keywords) -> performance band -> skill -> dynamic action.
DYNAMIC_CRITERION_COACHING = {
    ("grammar", "accuracy", "range"): {
        "zero": {
            "writing": "No grammatical structures were evidenced. Focus on writing complete, grammatically sound simple sentences (subject + verb + object) to establish baseline marks.",
            "speaking": "Speak in complete grammatical units rather than single words to allow the examiner to assess sentence structure.",
            "default": "Ensure you submit a complete response with full sentences to establish grammatical range.",
        },
        "emerging": {  # < 50%
            "writing": "Draft your response, then reread it once specifically for verb tense consistency and once for subject-verb agreement - separating the passes catches far more errors.",
            "speaking": "Focus on clean sentence endings without trailing off; use simple past and present tenses accurately when describing events.",
            "default": "Work on fundamental grammatical accuracy in simple and compound sentences before attempting multi-clause complexity.",
        },
        "developing": {  # 50% - 74%
            "writing": "Incorporate compound and complex sentence structures using subordinate clauses ('although', 'whereas', 'which') while maintaining accurate comma punctuation.",
            "speaking": "Vary your grammatical structures with conditionals and passive forms rather than relying solely on simple coordinate linkers.",
            "default": "Expand your grammatical range with a mix of complex structures and varied clause types.",
        },
        "mastery": {  # >= 75%
            "writing": "Maintain advanced grammatical precision with inversion, cleft sentences, and complex participial phrases while keeping error frequency near zero.",
            "speaking": "Demonstrate effortless grammatical flexibility with nuanced modal verbs and natural sentence flow.",
            "default": "Demonstrate sophisticated grammatical control across varied sentence structures.",
        },
    },
    ("vocab", "lexis", "lexical"): {
        "zero": {
            "writing": "No lexical range demonstrated. Respond using key topic words from the prompt to demonstrate basic comprehension and vocabulary usage.",
            "speaking": "Use topic-related vocabulary directly related to the question prompt to establish a lexical baseline.",
            "default": "Provide a complete response to demonstrate lexical control.",
        },
        "emerging": {
            "writing": "Keep a list of common words repeated across your text (e.g., 'good', 'bad', 'big', 'things') and substitute them with precise, context-specific nouns and adjectives.",
            "speaking": "Expand your descriptive vocabulary to describe feelings, places, and reasons beyond basic high-frequency adjectives.",
            "default": "Build your active vocabulary with precise topic-specific words rather than repeating general terms.",
        },
        "developing": {
            "writing": "Use natural topic collocations and academic phrasing ('substantial increase', 'readily apparent') instead of uncommon words used out of context.",
            "speaking": "Incorporate natural phrasal verbs, idioms, and collocations suited to authentic conversational register.",
            "default": "Aim for natural collocations and accurate word combinations suitable to the context.",
        },
        "mastery": {
            "writing": "Showcase sophisticated register control, precise connotations, and rare lexical items deployed with natural academic flair.",
            "speaking": "Use nuanced idiom and subtle expressions that convey exact shades of meaning effortlessly.",
            "default": "Demonstrate wide lexical resource with sophisticated precision and natural register control.",
        },
    },
    ("cohesion", "coherence", "organisation", "structure", "discourse"): {
        "zero": {
            "writing": "Structure your writing into at least two distinct paragraphs (an introductory statement and a supporting body paragraph) to establish organization.",
            "speaking": "Organise your response with a clear beginning, middle, and brief concluding thought.",
            "default": "Divide your response into clear, structured sections.",
        },
        "emerging": {
            "writing": "Give every paragraph one job, state it in the first sentence, and link paragraphs with reference words ('this', 'such') rather than mechanical lists.",
            "speaking": "Connect your points using simple, clear transitions ('for example', 'in addition') rather than jumping between unrelated thoughts.",
            "default": "Organize your response with clear paragraphing and logical transitions.",
        },
        "developing": {
            "writing": "Vary your cohesive devices beyond mechanical linkers ('firstly / secondly') using parallel structures, lexical cohesion, and logical paragraph progression.",
            "speaking": "Ensure smooth topic progression across ideas with natural discourse markers and clear signposting.",
            "default": "Ensure logical progression and varied cohesive devices throughout your response.",
        },
        "mastery": {
            "writing": "Achieve seamless thematic cohesion where paragraph transitions feel effortless and the logical hierarchy is immediately transparent.",
            "speaking": "Structure extended turns logically with smooth thematic bridges and balanced perspective shifts.",
            "default": "Demonstrate effortless logical cohesion and sophisticated structural balance.",
        },
    },
    ("task", "content", "relevance", "response"): {
        "zero": {
            "writing": "Read the prompt carefully and answer every single bullet point or instruction to meet the minimum task requirements.",
            "speaking": "Ensure you directly answer the examiner's prompt before elaborating with background details.",
            "default": "Address all required aspects of the prompt directly.",
        },
        "emerging": {
            "writing": "Re-read the prompt after writing and check that each required bullet is fully answered with an explanation and an example, not just mentioned.",
            "speaking": "Expand your answers using the 'Point + Reason + Example' structure instead of brief one-sentence replies.",
            "default": "Ensure every part of the question is clearly answered with supporting details.",
        },
        "developing": {
            "writing": "Fully develop each main point with relevant evidence and explore counter-arguments or implications to add depth to your argument.",
            "speaking": "Provide rich, detailed elaboration on all parts of the question, sustaining your reasoning throughout the turn.",
            "default": "Develop your arguments in depth with relevant, realistic examples.",
        },
        "mastery": {
            "writing": "Deliver a thoroughly developed response that addresses all nuances of the prompt with depth, insight, and persuasive clarity.",
            "speaking": "Speak comprehensively on all aspects of the topic with compelling depth and mature critical perspective.",
            "default": "Deliver a complete, nuanced response that addresses all dimensions of the task.",
        },
    },
    ("fluency",): {
        "zero": {
            "speaking": "Practise speaking continuously for 30 to 45 seconds without long pauses to establish fluency.",
            "default": "Focus on speaking continuously with minimal pauses.",
        },
        "emerging": {
            "speaking": "Record a two-minute answer and count your pauses - aim to replace hesitation with a filler phrase you have rehearsed.",
            "default": "Aim to reduce hesitations and maintain a steady rhythm.",
        },
        "developing": {
            "speaking": "Minimise mid-sentence pauses by using natural discourse markers ('well', 'in my view') to maintain momentum across extended turns.",
            "default": "Maintain consistent tempo and smooth speech flow across turns.",
        },
        "mastery": {
            "speaking": "Maintain an easy, natural speaking tempo with smooth rhythm and minimal hesitation even during complex explanation.",
            "default": "Demonstrate effortless fluency and natural speech rhythm.",
        },
    },
    ("pronunciation", "intelligib"): {
        "zero": {
            "speaking": "Practise clear articulation of basic words and record yourself reading aloud for 5 minutes daily.",
            "default": "Focus on clear enunciation of basic sounds and word endings.",
        },
        "emerging": {
            "speaking": "Read aloud for five minutes daily and record it; play it back listening only for word stress and clear consonant clusters.",
            "default": "Work on word stress and clear articulation of syllable endings.",
        },
        "developing": {
            "speaking": "Focus on sentence-level intonation, pausing at natural thought groups, and correct stress on multi-syllable academic words.",
            "default": "Focus on natural sentence stress and clear intonation contours.",
        },
        "mastery": {
            "speaking": "Employ a full range of phonological features including connected speech, weak forms, and expressive intonation without strain.",
            "default": "Demonstrate precise, natural pronunciation and flexible intonation.",
        },
    },
    ("interaction", "communication"): {
        "zero": {
            "speaking": "Practise responding directly to questions with at least two complete sentences.",
            "default": "Respond clearly and directly to each prompt.",
        },
        "emerging": {
            "speaking": "Practise answering, then extending: give the answer, one reason, and one example before you stop.",
            "default": "Extend your answers with relevant reasons and examples.",
        },
        "developing": {
            "speaking": "Engage naturally with conversational cues, actively developing the topic and asking clarifying questions where appropriate.",
            "default": "Maintain active, responsive communication throughout the interaction.",
        },
        "mastery": {
            "speaking": "Navigate complex interaction effortlessly, initiating discussion points and negotiating nuances with persuasive ease.",
            "default": "Demonstrate sophisticated communicative resource and natural interactive poise.",
        },
    },
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


def _round1(value: float) -> str:
    return str(round(value, 1))


def _num(value: object) -> str:
    """`100.0` reads as 100 in a sentence; the raw string stays on the data
    fields so the UI can format them its own way."""
    text = str(value)
    return text[:-2] if text.endswith(".0") else text


def _pct(correct: int, total: int) -> str:
    return _round1(correct * 100 / total) if total else "0"


def _trim(value: object) -> str:
    """Marks read as 4 or 4.5, never 4.00."""
    number = Decimal(str(value or 0))
    normalized = number.normalize()
    return f"{normalized:f}" if normalized == normalized.to_integral_value() else f"{number:.1f}"


def _band_status(percentage: float, pending: bool = False) -> str:
    if pending:
        return "pending"
    if percentage >= 75:
        return "strong"
    if percentage >= 50:
        return "steady"
    return "priority"


def _part_label(part) -> str:
    """`reading_1a` -> `Reading 1A`. Part titles are candidate-facing
    instruction paragraphs for Listening and Reading, so the code is the only
    thing short enough to head a row."""
    code = (part.part_code or "").strip()
    if not code:
        return (part.title or cefr_service.SKILL_LABELS.get(part.section_type, "Part")).strip()[:60]
    words = []
    for chunk in code.split("_"):
        words.append(chunk.upper() if any(character.isdigit() for character in chunk) else chunk.capitalize())
    return " ".join(words)


def _criterion_action(
    criterion: str,
    percentage: float = 0.0,
    skill: str = "writing",
    part_label: str = "",
) -> str:
    lowered = (criterion or "").lower()
    skill_key = (skill or "writing").lower()

    if percentage < 10:
        band = "zero"
    elif percentage < 50:
        band = "emerging"
    elif percentage < 75:
        band = "developing"
    else:
        band = "mastery"

    for keywords, bands in DYNAMIC_CRITERION_COACHING.items():
        if any(keyword in lowered for keyword in keywords):
            band_dict = bands.get(band) or bands.get("emerging", {})
            return (
                band_dict.get(skill_key)
                or band_dict.get("default")
                or next(iter(band_dict.values()))
            )

    # Dynamic contextual fallback based on performance band
    if band == "zero":
        return f"Submit a complete response addressing {criterion} to establish an initial score for this section."
    elif band == "emerging":
        return f"Review foundational requirements for {criterion} and ask your instructor which single change would move the mark."
    elif band == "developing":
        return f"Refine your control of {criterion} by applying model high-band techniques in your next practice attempt."
    else:
        return f"Maintain your high-band mastery of {criterion} across timed test conditions."


def _evidence(attempt: TestAttempt) -> dict:
    """Everything the coaching is allowed to claim, measured from the attempt.

    Per part, per question format, per difficulty and per rubric criterion -
    the four cuts that let the summary say *where* marks went instead of only
    how many. Nothing here is inferred: each row is a count of the student's
    own answers.
    """
    answers = {answer.question_id: answer for answer in attempt.answers}
    grades = {grade.part_id: grade for grade in attempt.part_grades}

    parts: list[dict] = []
    by_type: dict[str, dict] = {}
    by_difficulty: dict[str, dict] = {}
    criteria: list[dict] = []

    for part in sorted(attempt.module.parts, key=lambda item: ((item.sort_order or 0), item.id)):
        row = {
            "part_code": part.part_code,
            "label": _part_label(part),
            "skill": part.section_type,
            "skill_label": cefr_service.SKILL_LABELS.get(part.section_type, part.section_type.title()),
            "focus": (part.skill_focus or "").strip(),
            "auto_marked": bool(part.auto_marked),
            "total": 0,
            "attempted": 0,
            "correct": 0,
            "incorrect": 0,
            "unanswered": 0,
            "marks": None,
            "percentage": "0",
            "status": "pending",
        }

        if part.auto_marked:
            for question in part.questions:
                answer = answers.get(question.id)
                row["total"] += 1
                answered = _has_response(answer)
                if answered:
                    row["attempted"] += 1
                else:
                    row["unanswered"] += 1

                if answer is not None and answer.is_correct is True:
                    row["correct"] += 1
                elif answered:
                    row["incorrect"] += 1

                q_type = (question.question_type or "multiple_choice").lower()
                profile = by_type.setdefault(
                    q_type,
                    {"type": q_type, "correct": 0, "total": 0, "unanswered": 0},
                )
                profile["total"] += 1
                if answered:
                    profile["correct"] += 1 if answer.is_correct else 0
                else:
                    profile["unanswered"] += 1

                difficulty = (question.difficulty or "medium").lower()
                band = by_difficulty.setdefault(difficulty, {"difficulty": difficulty, "correct": 0, "total": 0})
                band["total"] += 1
                band["correct"] += 1 if answer.is_correct else 0

            if row["total"]:
                row["percentage"] = _pct(row["correct"], row["total"])
                row["marks"] = f"{row['correct']} / {row['total']}"
                row["status"] = _band_status(float(row["percentage"]))
        else:
            row["total"] = len(part.questions)
            row["attempted"] = sum(1 for question in part.questions if _has_response(answers.get(question.id)))
            row["unanswered"] = max(0, row["total"] - row["attempted"])
            grade = grades.get(part.id)
            graded = (
                grade is not None
                and grade.status in (PART_GRADE_GRADED, PART_GRADE_AI_GRADED)
                and grade.criteria
            )
            if graded:
                awarded = Decimal("0")
                maximum = Decimal("0")
                max_by_criterion = {
                    str(item.get("criterion")): Decimal(str(item.get("max_marks") or 0))
                    for item in (part.rubric or [])
                }
                for item in grade.criteria:
                    name = str(item.get("criterion") or "").strip()
                    if not name:
                        continue
                    marks = Decimal(str(item.get("marks_awarded") or 0))
                    ceiling = max_by_criterion.get(name) or Decimal(str(item.get("max_marks") or 0))
                    awarded += marks
                    maximum += ceiling
                    if ceiling > 0:
                        percentage = float(marks * 100 / ceiling)
                        dynamic_rationale = str(item.get("rationale") or item.get("feedback") or item.get("comment") or "").strip()
                        dynamic_action = _criterion_action(name, percentage, part.section_type, row["label"])
                        criteria.append(
                            {
                                "part_label": row["label"],
                                "skill": part.section_type,
                                "criterion": name,
                                "marks": f"{_trim(marks)} / {_trim(ceiling)}",
                                "percentage": _round1(percentage),
                                "status": _band_status(percentage),
                                "rationale": dynamic_rationale or None,
                                "action": dynamic_rationale or dynamic_action,
                                "recommendation": dynamic_action,
                            }
                        )
                if maximum > 0:
                    row["percentage"] = _round1(float(awarded * 100 / maximum))
                    row["marks"] = f"{_trim(awarded)} / {_trim(maximum)}"
                    row["status"] = _band_status(float(row["percentage"]))
            else:
                row["status"] = "pending"

        parts.append(row)

    question_types = [
        {
            "type": item["type"],
            "label": QUESTION_TYPE_PROFILES.get(item["type"], (item["type"].replace("_", " ").capitalize(), "", ""))[0],
            "tests": QUESTION_TYPE_PROFILES.get(item["type"], ("", "", ""))[1],
            "correct": item["correct"],
            "total": item["total"],
            "unanswered": item["unanswered"],
            "percentage": _pct(item["correct"], item["total"]),
            "status": _band_status(item["correct"] * 100 / item["total"] if item["total"] else 0),
        }
        for item in by_type.values()
        if item["total"]
    ]
    question_types.sort(key=lambda item: (float(item["percentage"]), -item["total"]))

    difficulties = [
        {
            "difficulty": item["difficulty"],
            "label": DIFFICULTY_LABELS.get(item["difficulty"], item["difficulty"].capitalize()),
            "correct": item["correct"],
            "total": item["total"],
            "percentage": _pct(item["correct"], item["total"]),
            "status": _band_status(item["correct"] * 100 / item["total"] if item["total"] else 0),
        }
        for item in by_difficulty.values()
        if item["total"]
    ]
    difficulties.sort(key=lambda item: DIFFICULTY_ORDER.get(item["difficulty"], 1))

    criteria.sort(key=lambda item: float(item["percentage"]))
    return {"parts": parts, "question_types": question_types, "difficulties": difficulties, "criteria": criteria}


def _pacing(attempt: TestAttempt, metrics: dict) -> Optional[dict]:
    """Time is only reported when it is worth acting on: finishing a timed
    paper in a third of the window, or running out with items still blank."""
    started = attempt.started_at
    submitted = attempt.submitted_at
    allowed = attempt.module.duration_minutes or 0
    if not started or not submitted or allowed <= 0:
        return None
    used = (submitted - started).total_seconds() / 60
    if used < 1:
        # Seeded or resumed attempts can land here; a stopwatch reading of
        # zero minutes is not something to coach against.
        return None
    share = min(100.0, used * 100 / allowed)

    note = None
    if metrics["unanswered"] and share >= 90:
        note = (
            f"You used {round(used)} of the {allowed} minutes and still left "
            f"{metrics['unanswered']} item{'s' if metrics['unanswered'] != 1 else ''} blank. Practise against a clock and "
            "bank a quick answer on every item before going back to the hard ones."
        )
    elif share <= 55 and used >= 2:
        note = (
            f"You finished in {round(used)} of the {allowed} available minutes. "
            "The unused time is the cheapest mark on this paper - spend it re-checking the items you were unsure about."
        )
    return {
        "minutes_used": round(used),
        "minutes_allowed": allowed,
        "share": _round1(share),
        "note": note,
    }


def _progression(attempt: TestAttempt, section_metrics: list[dict]) -> Optional[dict]:
    """How far the current profile sits from the next CEFR band, in the same
    practice percentage the bands are cut on."""
    profile = (attempt.cefr_profile or {}).get("overall") or {}
    scaled = profile.get("scaled_score")
    completed = [item for item in section_metrics if item["percentage"] not in (None, "")]
    if scaled is None and completed:
        scaled = sum(float(item["percentage"]) for item in completed) / len(completed)
    if scaled is None:
        return None

    current_score = float(scaled)
    current_level = profile.get("label") or cefr_service.level_for_percentage(Decimal(str(current_score)))
    higher = [
        (float(threshold), level)
        for threshold, level in cefr_service.PERCENTAGE_BANDS
        if float(threshold) > current_score
    ]
    if not higher:
        return {
            "current_level": current_level,
            "current_score": _round1(current_score),
            "next_level": None,
            "target_score": None,
            "points_to_next": None,
        }
    threshold, next_level = min(higher, key=lambda item: item[0])
    return {
        "current_level": current_level,
        "current_score": _round1(current_score),
        "next_level": next_level,
        "target_score": _round1(threshold),
        "points_to_next": _round1(threshold - current_score),
    }


def _focus_areas(evidence: dict, metrics: dict, section_metrics: list[dict]) -> list[dict]:
    """The two or three things worth working on, each with the measurement it
    came from and one concrete action - so the student reads *why* it is here."""
    areas: list[dict] = []
    scored_parts = [part for part in evidence["parts"] if part["status"] != "pending" and part["total"]]

    weakest_part = min(scored_parts, key=lambda part: float(part["percentage"]), default=None)
    if weakest_part and float(weakest_part["percentage"]) < 75:
        detail = f"You scored {weakest_part['marks']} ({_num(weakest_part['percentage'])}%) here"
        if weakest_part["focus"]:
            detail += f", the part that tests: {weakest_part['focus'][0].lower()}{weakest_part['focus'][1:]}"
        else:
            detail += "."
        areas.append(
            {
                "title": f"{weakest_part['label']} is where most marks were lost",
                "detail": detail,
                "action": SKILL_COACHING.get(weakest_part["skill"], ("",))[0],
                "metric": weakest_part["percentage"],
            }
        )

    weakest_type = next(
        (row for row in evidence["question_types"] if row["total"] >= 3 and float(row["percentage"]) < 60),
        None,
    )
    if weakest_type:
        profile = QUESTION_TYPE_PROFILES.get(weakest_type["type"], ("", "", ""))
        areas.append(
            {
                "title": f"{weakest_type['label']} questions are costing you marks",
                "detail": (
                    f"{weakest_type['correct']} of {weakest_type['total']} correct ({_num(weakest_type['percentage'])}%)"
                    + (f" - this format tests {profile[1]}." if profile[1] else ".")
                ),
                "action": profile[2],
                "metric": weakest_type["percentage"],
            }
        )

    by_difficulty = {row["difficulty"]: row for row in evidence["difficulties"]}
    easier = by_difficulty.get("easy")
    harder = by_difficulty.get("hard")
    if easier and harder and easier["total"] >= 2 and harder["total"] >= 2:
        gap = float(easier["percentage"]) - float(harder["percentage"])
        if gap >= 25:
            areas.append(
                {
                    "title": "The harder items are where the paper separates you",
                    "detail": (
                        f"{_num(easier['percentage'])}% on easier items against {_num(harder['percentage'])}% on harder ones. "
                        "The basics are in place; the marks are sitting in the items that need inference rather than matching."
                    ),
                    "action": "Work through the harder items untimed first and write one sentence on why the right answer is right - speed comes after the reasoning is reliable.",
                    "metric": harder["percentage"],
                }
            )

    weakest_criterion = evidence["criteria"][0] if evidence["criteria"] else None
    if weakest_criterion and float(weakest_criterion["percentage"]) < 75:
        areas.append(
            {
                "title": f"{weakest_criterion['criterion']} is your lowest examiner criterion",
                "detail": f"{weakest_criterion['marks']} in {weakest_criterion['part_label']} ({_num(weakest_criterion['percentage'])}%).",
                "action": weakest_criterion["action"],
                "metric": weakest_criterion["percentage"],
            }
        )

    if metrics["unanswered"]:
        # First: it is the only item on this list that costs nothing to fix.
        areas.insert(
            0,
            {
                "title": f"{metrics['unanswered']} item{'s' if metrics['unanswered'] != 1 else ''} never received an answer",
                "detail": "A blank scores exactly what a wrong answer scores, so a considered guess is always worth more than an empty box.",
                "action": "Answer every item on the first pass, flag the doubtful ones, and return to them with whatever time is left.",
                "metric": "0",
            },
        )

    seen: set[str] = set()
    unique: list[dict] = []
    for area in areas:
        if area["title"] in seen:
            continue
        seen.add(area["title"])
        unique.append(area)
    return unique[:4]


def _fallback_analysis(attempt: TestAttempt) -> dict:
    metrics, section_metrics = _metrics(attempt)
    evidence = _evidence(attempt)
    attempted = metrics["attempted"]
    accuracy = round(metrics["correct"] * 100 / attempted, 1) if attempted else 0
    overall_level = ((attempt.cefr_profile or {}).get("overall") or {}).get("label")
    pacing = _pacing(attempt, metrics)
    progression = _progression(attempt, section_metrics)
    focus_areas = _focus_areas(evidence, metrics, section_metrics)

    scored_parts = [part for part in evidence["parts"] if part["status"] != "pending" and part["total"]]
    ranked_parts = sorted(scored_parts, key=lambda part: float(part["percentage"]), reverse=True)
    ranked_skills = sorted(section_metrics, key=lambda item: float(item["percentage"]), reverse=True)

    # `metrics["pending"]` counts answers with no auto-mark, which is every
    # essay and recording *for ever* - so it cannot stand in for "the examiner
    # has not finished". The part grades can.
    objective_parts = [part for part in evidence["parts"] if part["auto_marked"]]
    examiner_parts = [part for part in evidence["parts"] if not part["auto_marked"]]
    objective_total = sum(part["total"] for part in objective_parts)
    objective_correct = sum(part["correct"] for part in objective_parts)
    objective_accuracy = round(objective_correct * 100 / objective_total, 1) if objective_total else 0
    examiner_pending = any(part["status"] == "pending" for part in examiner_parts)
    if objective_total:
        accuracy = objective_accuracy

    if examiner_pending and objective_total:
        summary = (
            f"You attempted {attempted} of {metrics['total']} questions. Objective items are currently {_num(objective_accuracy)}% correct, "
            "and the final profile will update after the remaining examiner-marked responses are graded."
        )
    elif examiner_pending:
        summary = (
            f"You submitted {attempted} of {metrics['total']} responses. They are with the examiner now - "
            "the coaching below will fill in as each part is marked."
        )
    elif not objective_total and progression:
        summary = (
            f"Your examiner-marked responses came out at {_num(progression['current_score'])}% on this practice scale "
            f"across {len(examiner_parts)} part{'s' if len(examiner_parts) != 1 else ''}."
        )
    elif accuracy >= 80:
        summary = (
            f"You answered {objective_correct} of {objective_total} questions correctly ({_num(accuracy)}%), "
            "showing strong control of the assessed material."
        )
    elif accuracy >= 60:
        summary = (
            f"You answered {objective_correct} of {objective_total} questions correctly ({_num(accuracy)}%). "
            "The foundation is sound, with a few recurring gaps to target."
        )
    else:
        summary = (
            f"You answered {objective_correct} of {objective_total} questions correctly ({_num(accuracy)}%). "
            "Working on one part at a time will move that further than general revision."
        )
    if overall_level:
        summary += f" Your current CEFR-aligned profile is {overall_level}."
    # Name the split rather than the average: two parts of the same paper can
    # sit a band apart, and that is the sentence a student can act on.
    if len(ranked_parts) > 1:
        best, worst = ranked_parts[0], ranked_parts[-1]
        if float(best["percentage"]) - float(worst["percentage"]) >= 20:
            summary += (
                f" The score is uneven across the paper: {best['label']} came in at {_num(best['percentage'])}% "
                f"while {worst['label']} sat at {_num(worst['percentage'])}%, so {worst['label']} is where the next hour of practice belongs."
            )
    if progression and progression["next_level"]:
        summary += (
            f" You are {_num(progression['points_to_next'])} practice points below {progression['next_level']} "
            f"({_num(progression['current_score'])}% against the {_num(progression['target_score'])}% threshold)."
        )

    strengths: list[str] = []
    improvements: list[str] = []
    next_steps: list[str] = []

    if metrics["attempted"] == metrics["total"] and metrics["total"]:
        strengths.append("You completed every question, which gives a reliable picture of your current performance.")
    elif metrics["attempted"]:
        strengths.append(f"You engaged with {metrics['attempted']} questions and saved a response for each attempted item.")
    if ranked_parts:
        best = ranked_parts[0]
        line = f"{best['label']} is your strongest part at {best['marks']} ({_num(best['percentage'])}%)"
        line += f" - {best['focus'][0].lower()}{best['focus'][1:]}" if best["focus"] else "."
        strengths.append(line)
    elif ranked_skills:
        strongest = ranked_skills[0]
        strengths.append(f"{strongest['label']} is currently your strongest measured area at {_num(strongest['percentage'])}%.")
    strong_types = [row for row in evidence["question_types"] if row["total"] >= 3 and float(row["percentage"]) >= 75]
    if strong_types:
        best_type = max(strong_types, key=lambda row: float(row["percentage"]))
        strengths.append(
            f"{best_type['label']} questions are working for you - {best_type['correct']} of {best_type['total']} correct ({_num(best_type['percentage'])}%)."
        )
    easier = next((row for row in evidence["difficulties"] if row["difficulty"] == "easy"), None)
    if easier and easier["total"] >= 3 and float(easier["percentage"]) >= 70 and len(strengths) < 4:
        strengths.append(
            f"You are reliable on the easier items ({easier['correct']} of {easier['total']}), so the foundation is not the problem."
        )

    for area in focus_areas[:3]:
        improvements.append(area["title"] if area["title"].endswith(".") else f"{area['title']}.")
    if metrics["incorrect"] and len(improvements) < 5:
        improvements.append(
            f"Review the reasoning behind {metrics['incorrect']} incorrect response{'s' if metrics['incorrect'] != 1 else ''}, not only the answer key."
        )
    if examiner_pending:
        improvements.append("Use the examiner feedback on Writing or Speaking before treating this analysis as final.")
    if not improvements:
        improvements.append("Maintain this level by repeating a timed set and checking that accuracy remains consistent.")

    if pacing and pacing["note"]:
        next_steps.append(pacing["note"])
    weakest_type = next((row for row in evidence["question_types"] if row["total"] >= 3), None)
    if weakest_type and float(weakest_type["percentage"]) < 75:
        action = QUESTION_TYPE_PROFILES.get(weakest_type["type"], ("", "", ""))[2]
        if action:
            next_steps.append(action)
    if ranked_parts:
        weakest_skill = ranked_parts[-1]["skill"]
        next_steps.extend(SKILL_COACHING.get(weakest_skill, ()))
    elif ranked_skills:
        next_steps.extend(SKILL_COACHING.get(ranked_skills[-1]["skill"], ()))
    if progression and progression["next_level"]:
        next_steps.append(
            f"Set the next target at {_num(progression['target_score'])}% across the paper - that is the {progression['next_level']} threshold "
            f"on this practice scale, {_num(progression['points_to_next'])} points above where this attempt landed."
        )

    return {
        "generated_by": "cefr_analysis_engine",
        "ai_enabled": False,
        "summary": summary,
        "strengths": strengths[:4],
        "improvements": improvements[:5],
        "next_steps": list(dict.fromkeys(step for step in next_steps if step))[:5],
        "metrics": metrics,
        "section_metrics": section_metrics,
        "part_breakdown": evidence["parts"],
        "question_type_breakdown": evidence["question_types"],
        "difficulty_breakdown": evidence["difficulties"],
        "criteria_breakdown": evidence["criteria"],
        "focus_areas": focus_areas,
        "pacing": pacing,
        "progression": progression,
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
            # The same four cuts the deterministic engine reasons over, so the
            # model can cite a part, a format or a criterion by name instead of
            # restating the overall percentage.
            "part_breakdown": fallback["part_breakdown"],
            "question_type_breakdown": fallback["question_type_breakdown"],
            "difficulty_breakdown": fallback["difficulty_breakdown"],
            "criteria_breakdown": fallback["criteria_breakdown"],
            "focus_areas": fallback["focus_areas"],
            "pacing": fallback["pacing"],
            "progression": fallback["progression"],
        },
        "instructions": (
            "Return JSON only. Give concise, encouraging, evidence-based coaching from the supplied aggregate results. "
            "Cite the specific part, question format, difficulty band, or rubric criterion the point comes from, and quote "
            "the counts (for example '2 of 6 in Reading 2'). Do not invent errors, abilities, personal facts, or CEFR "
            "levels, and do not refer to any question the data does not contain. Provide a summary, strengths, "
            "improvements, and practical next_steps that name an action the student can take this week."
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


def _analysis_cache_revision(attempt: TestAttempt) -> str:
    """Part grades can land while the attempt stays `grading`.

    The result page asks for analysis during that window, so the cache has to
    vary with the rubric rows rather than only with the attempt's final score.
    """
    grade_rows = sorted(
        attempt.part_grades,
        key=lambda grade: (
            grade.part_id,
            grade.status,
            grade.graded_at or attempt.started_at,
        ),
    )
    if not grade_rows:
        return "no-part-grades"
    return "|".join(
        ":".join((
            str(grade.part_id),
            str(grade.status),
            (grade.graded_at or attempt.started_at).isoformat(),
            str(grade.total_marks),
            json.dumps(grade.criteria or [], sort_keys=True, default=str),
        ))
        for grade in grade_rows
    )


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
        f"student-result-analysis-v2:{attempt.id}:{attempt.status}:{attempt.raw_score}:"
        f"{attempt.graded_at.isoformat() if attempt.graded_at else 'pending'}:"
        f"{_analysis_cache_revision(attempt)}"
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
