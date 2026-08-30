from datetime import datetime, timezone
from decimal import Decimal
from math import ceil
from pathlib import Path
import re
import secrets
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.config import settings
from app.core.media_signing import sign_path
from app.models.audit_log import AuditLog
from app.models.attempt import (
    ATTEMPT_GRADED,
    ATTEMPT_GRADING,
    ATTEMPT_IN_PROGRESS,
    ATTEMPT_READY,
    ATTEMPT_SUBMITTED,
    AttemptAnswer,
    TestAttempt,
)
from app.models.exam_module import ExamModule, ExamModuleAsset, ExamModulePart, ExamModuleQuestion, InstituteModule
from app.models.institute import Institute
from app.models.plan import Plan
from app.models.user import User
from app.services.module_blueprint_service import get_blueprint


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _audit(
    db: Session,
    actor: User,
    action: str,
    module_id: int,
    ip: Optional[str],
    details: Optional[dict] = None,
) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            action=action,
            entity_type="exam_module",
            entity_id=module_id,
            details=details,
            ip_address=ip,
        )
    )


def _module_query(db: Session):
    return db.query(ExamModule).options(
        joinedload(ExamModule.created_by),
        selectinload(ExamModule.parts).selectinload(ExamModulePart.questions),
        selectinload(ExamModule.parts).selectinload(ExamModulePart.assets),
        selectinload(ExamModule.assets),
        selectinload(ExamModule.institute_assignments).joinedload(InstituteModule.institute),
    )


def get_module_or_404(db: Session, module_id: int) -> ExamModule:
    module = _module_query(db).filter(ExamModule.id == module_id, ExamModule.deleted_at.is_(None)).first()
    if module is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment module not found")
    return module


def _require_owner(module: ExamModule, actor: User) -> None:
    if module.created_by_id != actor.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only this module's creator can change it")


def _require_draft(db: Session, module: ExamModule) -> None:
    if module.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archived courses cannot be edited. Restore the course first.",
        )
    if module.status == "published":
        # A published module is live for students. Editing its questions or
        # assets while someone is mid-attempt (or waiting to be graded off
        # what they saw) would silently corrupt their scoring - the frozen
        # content_snapshot they answered against would no longer match the
        # live question set this service edits.
        active_attempt = (
            db.query(TestAttempt.id)
            .filter(
                TestAttempt.module_id == module.id,
                TestAttempt.status.in_(
                    [ATTEMPT_READY, ATTEMPT_IN_PROGRESS, ATTEMPT_SUBMITTED, ATTEMPT_GRADING]
                ),
            )
            .first()
        )
        if active_attempt is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot edit a published module with active student attempts.",
            )


def _part_or_404(module: ExamModule, part_id: int) -> ExamModulePart:
    part = next((item for item in module.parts if item.id == part_id), None)
    if part is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment part was not found in this module")
    return part


def get_editable_part(
    db: Session, actor: User, module_id: int, part_id: int
) -> tuple[ExamModule, ExamModulePart]:
    module = get_module_or_404(db, module_id)
    _require_owner(module, actor)
    _require_draft(db, module)
    return module, _part_or_404(module, part_id)


def get_editable_module(db: Session, actor: User, module_id: int) -> ExamModule:
    module = get_module_or_404(db, module_id)
    _require_owner(module, actor)
    _require_draft(db, module)
    return module


def _question_out(question: ExamModuleQuestion) -> dict:
    interaction = dict(question.interaction or {})
    material_path = interaction.get("candidate_material_path")
    if material_path:
        interaction["candidate_material_url"] = sign_path(material_path)
    return {
        "id": question.id,
        "part_id": question.part_id,
        "question_type": question.question_type,
        "prompt": question.prompt,
        "instructions": question.instructions,
        "passage": question.passage,
        "image_path": question.image_path,
        "image_url": f"/storage/{question.image_path}" if question.image_path else None,
        "options": list(question.options or []),
        "correct_answers": list(question.correct_answers or []),
        "interaction": interaction,
        "explanation": question.explanation,
        "points": str(question.points),
        "difficulty": question.difficulty,
        "source_type": question.source_type,
        "source_filename": question.source_filename,
        "sort_order": question.sort_order,
        "created_at": question.created_at,
        "updated_at": question.updated_at,
    }


DERIVED_DURATION_MODULE_TYPES = {"speaking", "full_mock", "final_test"}


def _effective_speaking_question_seconds(part: ExamModulePart, question: ExamModuleQuestion) -> int:
    """Seconds this prompt costs the candidate: its own preparation plus its own
    response time.

    There is no part-level fallback and no invented default. Every Speaking
    prompt carries its own timing, set when it is authored, and a part's
    duration is the sum of its prompts. A prompt with no preparation is a real
    answer - the candidate starts speaking as the examiner finishes - not a
    missing value to be filled in with a guess.
    """
    interaction = dict(question.interaction or {})
    preparation = interaction.get("preparation_seconds") or 0
    response = interaction.get("response_seconds") or 0
    return max(0, int(preparation)) + max(0, int(response))


def _questions_used_for_duration(
    part: ExamModulePart,
    questions: list[ExamModuleQuestion],
) -> list[ExamModuleQuestion]:
    ordered = sorted(questions, key=lambda item: item.sort_order)
    limit = part.question_limit
    if limit is None or limit <= 0 or len(ordered) <= limit:
        return ordered
    if (part.answer_constraints or {}).get("preserve_question_order"):
        return ordered[:limit]
    # Random pools can produce different sittings. Use the longest possible
    # selection so the countdown never expires before a valid sitting.
    return sorted(
        ordered,
        key=lambda question: _effective_speaking_question_seconds(part, question),
        reverse=True,
    )[:limit]


def _resequence_questions(part: ExamModulePart) -> None:
    """Renumber a part's questions 0..n-1, keeping any headline speaking turn first.

    Two problems meet here. `add_question` numbered a new question
    `len(part.questions)`, which collides with an existing row as soon as an
    earlier question has been deleted - deleting never renumbered, so the gap
    persisted and two prompts ended up sharing a `sort_order`. Every part sets
    `preserve_question_order`, so the candidate's order then became whatever the
    database happened to return.

    On top of that, Speaking 3 and 4 open with a single read-aloud or
    presentation and follow it with questions about it. The editor has no
    reorder control, so a read-aloud deleted and written again would be appended
    after its own follow-ups and the candidate would be asked about a text they
    had not been given. The part's leading required turn is pulled back to the
    front when it is one the part may only hold once and the part also holds a
    bank of repeatable turns; everything else keeps its relative order.

    Only draft modules can be edited, and a sitting reads its frozen
    `content_snapshot`, so renumbering here cannot disturb an attempt in flight.
    """
    constraints = part.answer_constraints or {}
    required = constraints.get("required_turn_types") or []
    allowed = constraints.get("allowed_turn_types") or []
    singletons = set(constraints.get("singleton_turn_types") or [])
    # Only a part that pairs one headline turn with a bank has an order worth
    # enforcing - the text has to come before the questions about it. Speaking 2
    # is two role plays and nothing else, and the format does not say which
    # comes first, so its order stays the author's to choose.
    has_bank = any(turn not in singletons for turn in allowed)
    leading = required[0] if has_bank and required and required[0] in singletons else None

    def key(question: ExamModuleQuestion) -> tuple:
        is_leading = leading is not None and (question.interaction or {}).get("turn_type") == leading
        return (0 if is_leading else 1, question.sort_order, question.id or 0)

    for index, question in enumerate(sorted(part.questions, key=key)):
        if question.sort_order != index:
            question.sort_order = index


def _refresh_speaking_duration(db: Session, module: ExamModule) -> None:
    """Persist the maximum candidate time represented by speaking prompts."""
    total_seconds = 0
    has_questions = False
    for part in module.parts:
        if part.section_type != "speaking":
            continue
        questions = (
            db.query(ExamModuleQuestion)
            .filter(ExamModuleQuestion.part_id == part.id)
            .order_by(ExamModuleQuestion.sort_order)
            .all()
        )
        selected = _questions_used_for_duration(part, questions)
        part_seconds = sum(_effective_speaking_question_seconds(part, question) for question in selected)
        part.duration_minutes = max(1, ceil(part_seconds / 60)) if selected else None
        total_seconds += part_seconds
        has_questions = has_questions or bool(selected)

    if module.module_type == "speaking":
        module.duration_minutes = (
            max(1, ceil(total_seconds / 60))
            if has_questions
            else get_blueprint("speaking")["duration_minutes"]
        )


def _asset_out(asset: ExamModuleAsset) -> dict:
    return {
        "id": asset.id,
        "module_id": asset.module_id,
        "part_id": asset.part_id,
        "asset_type": asset.asset_type,
        "title": asset.title,
        "original_filename": asset.original_filename,
        "url": None if asset.asset_type == "tts_text" else f"/storage/{asset.file_path}",
        "mime_type": asset.mime_type,
        "file_size": asset.file_size,
        "transcript": asset.transcript,
        "tts_voice": asset.tts_voice,
        "tts_rate": asset.tts_rate,
        "created_at": asset.created_at,
    }


def validation_errors(module: ExamModule) -> list[str]:
    errors: list[str] = []
    for part in module.parts:
        count = len(part.questions)
        # A part with a fixed limit must hold exactly that many questions; only
        # the open-ended parts (Speaking 1, 3 and 4) fall back to a lower bound
        # plus the `maximum_questions` ceiling checked below.
        if part.question_limit is not None:
            if count != part.question_limit:
                errors.append(
                    f"{part.title} takes exactly {part.question_limit} question"
                    f"{'s' if part.question_limit != 1 else ''}; it currently has {count}."
                )
        elif count < part.minimum_questions:
            errors.append(
                f"{part.title} requires at least {part.minimum_questions} question"
                f"{'s' if part.minimum_questions != 1 else ''}; it currently has {count}."
            )
        elif (part.answer_constraints or {}).get("maximum_questions") and count > part.answer_constraints["maximum_questions"]:
            maximum = part.answer_constraints["maximum_questions"]
            errors.append(
                f"{part.title} takes at most {maximum} question"
                f"{'s' if maximum != 1 else ''}; it currently has {count}."
            )
        allowed = set((part.answer_constraints or {}).get("allowed_question_types", []))
        invalid = sorted({question.question_type for question in part.questions if allowed and question.question_type not in allowed})
        if invalid:
            errors.append(f"{part.title} contains unsupported question types: {', '.join(invalid)}.")
        constraints = dict(part.answer_constraints or {})
        for question in part.questions:
            if question.question_type in OPTION_BASED_QUESTION_TYPES and len(question.options or []) < 2:
                errors.append(
                    f"Every option-based question in {part.title} requires at least 2 options; "
                    f"'{question.prompt[:30]}...' has {len(question.options or [])}."
                )
            if constraints.get("passage_required") and not (question.passage or "").strip():
                errors.append(f"Every question in {part.title} must include the shared source text.")
        if part.questions and constraints.get("shared_passage"):
            passages = {(question.passage or "").strip() for question in part.questions}
            if len(passages) != 1:
                errors.append(f"Every question in {part.title} must use the same source text.")
        if part.questions and constraints.get("shared_options"):
            option_sets = {
                tuple((item.get("key"), item.get("text")) for item in (question.options or []))
                for question in part.questions
            }
            if len(option_sets) != 1:
                errors.append(f"Every question in {part.title} must use the same option bank.")
        if constraints.get("unique_answers"):
            answers = [answer for question in part.questions for answer in (question.correct_answers or [])]
            if len(answers) != len(set(answers)):
                errors.append(f"Each option in {part.title} may be the key for only one gap.")
        if constraints.get("inline_marker_required"):
            missing_markers = [question for question in part.questions if "{{blank}}" not in question.prompt]
            if missing_markers:
                errors.append(f"Every question in {part.title} must place a {{{{blank}}}} marker in its prompt.")
        if constraints.get("layout") in {"shared_cloze", "notepad_gaps"} and part.questions:
            ordered = sorted(part.questions, key=lambda question: question.sort_order)
            shared_passage = ordered[0].passage or ""
            missing_gaps = [
                str(gap_number)
                for gap_number in range(1, len(ordered) + 1)
                if f"{{{{blank:{gap_number}}}}}" not in shared_passage
            ]
            if missing_gaps:
                errors.append(
                    f"{part.title} source text must contain a {{{{blank:N}}}} marker for gap(s): {', '.join(missing_gaps)}."
                )
        if constraints.get("group_label_required"):
            groups: dict[str, int] = {}
            for question in part.questions:
                label = str((question.interaction or {}).get("group_label") or "").strip()
                if label:
                    groups[label] = groups.get(label, 0) + 1
            expected_groups = constraints.get("group_count")
            questions_per_group = constraints.get("questions_per_group")
            if len(groups) != expected_groups or any(size != questions_per_group for size in groups.values()):
                errors.append(
                    f"{part.title} requires {expected_groups} conversation groups with "
                    f"{questions_per_group} questions in each group."
                )
        required_turn_types = set(constraints.get("required_turn_types", []))
        if required_turn_types:
            authored_turn_types = {
                str((question.interaction or {}).get("turn_type") or "") for question in part.questions
            }
            missing_turn_types = sorted(required_turn_types - authored_turn_types)
            if missing_turn_types:
                errors.append(f"{part.title} is missing required speaking turns: {', '.join(missing_turn_types)}.")
        singleton_turn_types = constraints.get("singleton_turn_types", [])
        if singleton_turn_types:
            # Mirrors the authoring-time rule so a part that predates it, or was
            # filled by an import, cannot reach publish with two read-alouds.
            for singleton in singleton_turn_types:
                authored = sum(
                    1
                    for question in part.questions
                    if (question.interaction or {}).get("turn_type") == singleton
                )
                if authored > 1:
                    errors.append(
                        f"{part.title} takes one {singleton.replace('_', ' ')} turn; it currently has {authored}."
                    )
        minimum_inference = constraints.get("minimum_inference_questions", 0)
        if minimum_inference:
            inference_terms = (
                "infer",
                "imply",
                "implication",
                "suggest",
                "purpose",
                "writer doing",
                "writer is saying",
            )
            inference_count = sum(
                any(term in f"{question.prompt} {question.instructions or ''}".lower() for term in inference_terms)
                for question in part.questions
            )
            if inference_count < minimum_inference:
                errors.append(f"{part.title} requires at least {minimum_inference} inference or writer-purpose question.")
        if part.max_marks is not None:
            if part.question_limit is not None and part.question_limit > 0:
                expected_points = Decimal(part.max_marks) / Decimal(part.question_limit)
                for q in part.questions:
                    if Decimal(q.points) != expected_points:
                        errors.append(
                            f"Each question in {part.title} must carry exactly {expected_points:g} marks "
                            f"(total {part.max_marks:g} / {part.question_limit} questions); "
                            f"question '{q.prompt[:30]}...' has {q.points:g} marks."
                        )
            else:
                total = sum((Decimal(question.points) for question in part.questions), Decimal("0"))
                if total != Decimal(part.max_marks):
                    errors.append(f"{part.title} must total {part.max_marks:g} marks; it currently totals {total:g}.")
        if (part.answer_constraints or {}).get("audio_required"):
            audio_mode = (part.answer_constraints or {}).get("audio_mode", "single")
            if audio_mode == "per_question":
                missing_audio = [
                    q for q in part.questions
                    if not (q.interaction or {}).get("audio_path") and not (q.interaction or {}).get("audio_url")
                ]
                if not part.assets:
                    errors.append(
                        f"{part.title} is in per-question audio mode: please attach the heading/instructions audio clip."
                    )
                if missing_audio:
                    errors.append(
                        f"{part.title} is in per-question audio mode: all questions require an attached audio clip ({len(missing_audio)} missing)."
                    )
            else:
                if not part.assets:
                    errors.append(f"{part.title} requires an MP3 upload or browser-narrated transcript.")
    return errors


DEFAULT_INTEGRITY_GUIDELINES = [
    {
        "id": "timer_protocol",
        "title": "Strict Exam Timer",
        "description": "The countdown timer initiates immediately upon clicking 'Commence Assessment'. Responses will auto-submit when the duration expires.",
        "icon": "clock",
    },
    {
        "id": "sync_protocol",
        "title": "Real-Time Response Synchronization",
        "description": "Your responses are encrypted and automatically saved every 30 seconds to prevent data loss.",
        "icon": "cloud",
    },
    {
        "id": "continuity_protocol",
        "title": "Session Continuity Protocol",
        "description": "In the event of network disruption, you may resume your active session. Note that the official examination clock continues running.",
        "icon": "logout",
    },
    {
        "id": "matrix_protocol",
        "title": "Omni-Directional Question Matrix",
        "description": "Use section tabs or the question navigator panel to review, answer, or modify responses freely prior to submission.",
        "icon": "restore",
    },
]


OPTION_BASED_QUESTION_TYPES = {
    "mcq_single",
    "mcq_multiple",
    "true_false_not_given",
    "yes_no_not_given",
    "matching_unique",
    "matching_reusable",
}


def serialize_module(module: ExamModule, *, detailed: bool = False) -> dict:
    blueprint = get_blueprint(module.module_type)
    errors = validation_errors(module)
    result = {
        "id": module.id,
        "module_type": module.module_type,
        "module_label": blueprint["label"],
        "title": module.title,
        "description": module.description,
        "instructions": module.instructions,
        "show_onboarding_instructions": module.show_onboarding_instructions if module.show_onboarding_instructions is not None else True,
        "onboarding_instructions": module.onboarding_instructions if module.onboarding_instructions is not None else DEFAULT_INTEGRITY_GUIDELINES,
        "status": module.status,
        "is_visible": module.is_visible,
        "is_demo": module.is_demo,
        "duration_minutes": module.duration_minutes,
        "blueprint_version": module.blueprint_version,
        "source_module_ids": list(module.source_module_ids or []),
        "created_by_id": module.created_by_id,
        "created_by_name": f"{module.created_by.first_name} {module.created_by.last_name}".strip(),
        "part_count": len(module.parts),
        "question_count": sum(len(part.questions) for part in module.parts),
        "audio_count": len(module.assets),
        "ready_to_publish": not errors,
        "validation_errors": errors,
        "published_at": module.published_at,
        "created_at": module.created_at,
        "updated_at": module.updated_at,
        "deleted_at": module.deleted_at,
        "assignment_count": sum(1 for item in module.institute_assignments if item.is_active),
    }
    if detailed:
        result["assessment"] = blueprint["assessment"]
        result["parts"] = [
            {
                "id": part.id,
                "module_id": part.module_id,
                "section_type": part.section_type,
                "part_code": part.part_code,
                "title": part.title,
                "skill_focus": part.skill_focus,
                "instructions": part.instructions,
                "question_limit": part.question_limit,
                "minimum_questions": part.minimum_questions,
                "max_marks": str(part.max_marks) if part.max_marks is not None else None,
                "duration_minutes": part.duration_minutes,
                "auto_marked": part.auto_marked,
                "ai_evaluation_enabled": part.ai_evaluation_enabled,
                "answer_constraints": dict(part.answer_constraints or {}),
                "rubric": list(part.rubric or []),
                "sort_order": part.sort_order,
                "questions": [_question_out(question) for question in part.questions],
                "assets": [_asset_out(asset) for asset in part.assets],
            }
            for part in module.parts
        ]
    return result


def list_modules(
    db: Session,
    actor: User,
    search: Optional[str] = None,
    module_type: Optional[str] = None,
    status_filter: Optional[str] = None,
) -> list[dict]:
    query = _module_query(db).filter(ExamModule.created_by_id == actor.id, ExamModule.deleted_at.is_(None))
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(ExamModule.title.ilike(term), ExamModule.description.ilike(term)))
    if module_type:
        query = query.filter(ExamModule.module_type == module_type)
    if status_filter:
        query = query.filter(ExamModule.status == status_filter)
    rows = query.order_by(ExamModule.updated_at.desc(), ExamModule.created_at.desc()).all()
    return [serialize_module(module) for module in rows]


def _composite_sources(
    db: Session, actor: User, source_module_ids: list[int]
) -> dict[str, ExamModule]:
    if len(source_module_ids) != 4 or len(set(source_module_ids)) != 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Choose exactly one completed Listening, Reading, Writing, and Speaking module",
        )
    sources = (
        _module_query(db)
        .filter(
            ExamModule.id.in_(source_module_ids),
            ExamModule.created_by_id == actor.id,
        )
        .all()
    )
    if len(sources) != 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Every selected source must be a module created by you",
        )
    by_type = {source.module_type: source for source in sources}
    required = {"listening", "reading", "writing", "speaking"}
    if set(by_type) != required:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select one source from each skill: Listening, Reading, Writing, and Speaking",
        )
    for source in sources:
        errors = validation_errors(source)
        if source.status == "archived" or errors:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": f"{source.title} is not a completed source module",
                    "errors": errors or ["Archived modules cannot be used"],
                },
            )
    return by_type


def create_module(db: Session, actor: User, data: dict, ip: Optional[str]) -> dict:
    payload = dict(data)
    source_module_ids = list(payload.pop("source_module_ids", []))
    req_duration = payload.pop("duration_minutes", None)
    module_type = payload["module_type"]
    blueprint = get_blueprint(module_type)
    composite = module_type in {"full_mock", "final_test"}
    sources = _composite_sources(db, actor, source_module_ids) if composite else {}
    if not composite and source_module_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Source modules are only valid for composite tests")
    calculated_duration = (
        sum(source.duration_minutes for source in sources.values())
        if composite
        else (req_duration if req_duration is not None else blueprint["duration_minutes"])
    )
    module = ExamModule(
        **payload,
        duration_minutes=calculated_duration,
        source_module_ids=source_module_ids,
        created_by_id=actor.id,
    )
    created_paths: list[Path] = []
    try:
        db.add(module)
        db.flush()
        parts = [
            ExamModulePart(
                module_id=module.id,
                section_type=part["section_type"],
                part_code=part["part_code"],
                title=part["title"],
                skill_focus=part["skill_focus"],
                instructions=part["instructions"],
                question_limit=part["question_limit"],
                minimum_questions=part["minimum_questions"],
                max_marks=part["max_marks"],
                duration_minutes=part["duration_minutes"],
                auto_marked=part["auto_marked"],
                ai_evaluation_enabled=part["ai_evaluation_enabled"],
                answer_constraints=part["answer_constraints"],
                rubric=part["rubric"],
                sort_order=part["sort_order"],
            )
            for part in blueprint["parts"]
        ]
        db.add_all(parts)
        db.flush()

        if composite:
            randomizer = secrets.SystemRandom()
            for target_part in parts:
                source = sources[target_part.section_type]
                source_part = next(
                    (part for part in source.parts if part.part_code == target_part.part_code),
                    None,
                )
                if source_part is None:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"{source.title} does not contain {target_part.title}",
                    )

                target_part.ai_evaluation_enabled = source_part.ai_evaluation_enabled
                source_questions = sorted(source_part.questions, key=lambda item: item.sort_order)
                if not (target_part.answer_constraints or {}).get("preserve_question_order"):
                    randomizer.shuffle(source_questions)
                for order, question in enumerate(source_questions):
                    image_path = question.image_path
                    if image_path:
                        source_image = settings.storage_path / image_path
                        if not source_image.is_file():
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Question image for {source_part.title} is missing from storage",
                            )
                        relative_image = Path("exam-modules") / str(module.id) / "questions" / f"{uuid4().hex}{source_image.suffix or '.webp'}"
                        destination_image = settings.storage_path / relative_image
                        destination_image.parent.mkdir(parents=True, exist_ok=True)
                        destination_image.write_bytes(source_image.read_bytes())
                        created_paths.append(destination_image)
                        image_path = relative_image.as_posix()

                    interaction = dict(question.interaction or {})
                    material_path = interaction.get("candidate_material_path")
                    if material_path:
                        source_material = settings.storage_path / material_path
                        if not source_material.is_file():
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Candidate material for {source_part.title} is missing from storage",
                            )
                        relative_material = Path("exam-modules") / str(module.id) / "speaking-materials" / f"{uuid4().hex}.pdf"
                        destination_material = settings.storage_path / relative_material
                        destination_material.parent.mkdir(parents=True, exist_ok=True)
                        destination_material.write_bytes(source_material.read_bytes())
                        created_paths.append(destination_material)
                        interaction["candidate_material_path"] = relative_material.as_posix()

                    db.add(
                        _new_question(
                            target_part,
                            actor,
                            {
                                "question_type": question.question_type,
                                "prompt": question.prompt,
                                "instructions": question.instructions,
                                "passage": question.passage,
                                "image_path": image_path,
                                "options": list(question.options or []),
                                "correct_answers": list(question.correct_answers or []),
                                "interaction": interaction,
                                "explanation": question.explanation,
                                "points": question.points,
                                "difficulty": question.difficulty,
                            },
                            question.source_type,
                            question.source_filename,
                            order,
                        )
                    )

                for asset in source_part.assets:
                    if asset.asset_type == "tts_text":
                        relative = Path("tts-text") / str(module.id) / f"{uuid4().hex}.txt"
                        file_size = len((asset.transcript or "").encode("utf-8"))
                    else:
                        source_path = settings.storage_path / asset.file_path
                        if not source_path.is_file():
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Audio file for {source_part.title} is missing from storage",
                            )
                        suffix = Path(asset.file_path).suffix or ".bin"
                        relative = Path("exam-modules") / str(module.id) / f"{uuid4().hex}{suffix}"
                        destination = settings.storage_path / relative
                        destination.parent.mkdir(parents=True, exist_ok=True)
                        content = source_path.read_bytes()
                        destination.write_bytes(content)
                        created_paths.append(destination)
                        file_size = len(content)
                    db.add(
                        ExamModuleAsset(
                            module_id=module.id,
                            part_id=target_part.id,
                            asset_type=asset.asset_type,
                            title=asset.title,
                            original_filename=asset.original_filename,
                            file_path=relative.as_posix(),
                            mime_type=asset.mime_type,
                            file_size=file_size,
                            transcript=asset.transcript,
                            tts_voice=asset.tts_voice,
                            tts_rate=asset.tts_rate,
                            uploaded_by_id=actor.id,
                        )
                    )

        _audit(
            db,
            actor,
            "exam_module.create",
            module.id,
            ip,
            {"module_type": module.module_type, "source_module_ids": source_module_ids},
        )
        db.commit()
    except Exception:
        db.rollback()
        for path in created_paths:
            path.unlink(missing_ok=True)
        raise
    return serialize_module(get_module_or_404(db, module.id), detailed=True)


def update_module(
    db: Session,
    actor: User,
    module_id: int,
    data: dict,
    fields_set: set[str],
    ip: Optional[str],
) -> dict:
    module = get_module_or_404(db, module_id)
    _require_owner(module, actor)
    _require_draft(db, module)
    for field in ("title", "description", "instructions", "duration_minutes", "show_onboarding_instructions", "onboarding_instructions"):
        if field in fields_set:
            if field == "duration_minutes" and module.module_type in DERIVED_DURATION_MODULE_TYPES:
                continue
            setattr(module, field, data.get(field))
    _audit(db, actor, "exam_module.update", module.id, ip, {"fields": sorted(fields_set)})
    db.commit()
    return serialize_module(get_module_or_404(db, module.id), detailed=True)


def update_part_ai_evaluation(
    db: Session,
    actor: User,
    module_id: int,
    part_id: int,
    ai_evaluation_enabled: bool,
    ip: Optional[str],
) -> dict:
    module, part = get_editable_part(db, actor, module_id, part_id)
    if part.auto_marked:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Answer-key marked parts cannot use AI evaluation")
    if part.section_type not in {"writing", "speaking"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="AI evaluation can only be enabled for Writing or Speaking parts")

    part.ai_evaluation_enabled = ai_evaluation_enabled
    _audit(
        db,
        actor,
        "exam_module.part_ai_evaluation.update",
        module.id,
        ip,
        {"part_id": part.id, "ai_evaluation_enabled": ai_evaluation_enabled},
    )
    db.commit()
    return serialize_module(get_module_or_404(db, module.id), detailed=True)


def update_part_instructions(
    db: Session,
    actor: User,
    module_id: int,
    part_id: int,
    instructions: Optional[str],
    ip: Optional[str],
) -> dict:
    module, part = get_editable_part(db, actor, module_id, part_id)
    if part.part_code not in ("reading_1a", "listening_3", "listening_4"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A custom heading can only be set for Reading 1A, Listening 3, or Listening 4",
        )
    part.instructions = instructions
    _audit(
        db,
        actor,
        "exam_module.part_instructions.update",
        module.id,
        ip,
        {"part_id": part.id},
    )
    db.commit()
    return serialize_module(get_module_or_404(db, module.id), detailed=True)


def _validate_question_for_part(
    part: ExamModulePart,
    data: dict,
    current_count: int,
    editing_question_id: Optional[int] = None,
    pending_turn_types: tuple[str, ...] = (),
) -> None:
    # Parts with no fixed question_limit (Speaking 1, 3 and 4) are open-ended,
    # but not unbounded: every extra prompt adds its own preparation and
    # response time to the module's derived duration, so an unchecked part can
    # silently turn a 14-minute test into a 40-minute one.
    if part.section_type == "speaking":
        interaction_data = data.get("interaction") or {}
        response_seconds = interaction_data.get("response_seconds")
        if response_seconds is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Set a recording time for this {part.title} prompt - it is what the candidate's clock is built from",
            )
        if int(response_seconds) < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A prompt needs at least 1 second of recording time",
            )
        preparation_seconds = interaction_data.get("preparation_seconds")
        if preparation_seconds is not None and int(preparation_seconds) < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Preparation time cannot be negative",
            )

    maximum_questions = (part.answer_constraints or {}).get("maximum_questions")
    if part.question_limit is None and maximum_questions and current_count >= maximum_questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"{part.title} takes at most {maximum_questions} "
                f"question{'s' if maximum_questions != 1 else ''} and already has {current_count}."
            ),
        )
    # A part holds exactly the questions the student sits - there is no pool to
    # draw from, so the limit is a hard cap at authoring time rather than a
    # sampling size at attempt time.
    if part.question_limit is not None and current_count >= part.question_limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"{part.title} takes exactly {part.question_limit} "
                f"question{'s' if part.question_limit != 1 else ''} and already has {current_count}. "
                "Delete one before adding another."
            ),
        )
    allowed = set((part.answer_constraints or {}).get("allowed_question_types", []))
    if allowed and data["question_type"] not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{part.title} accepts only: {', '.join(sorted(allowed))}",
        )
    is_l1 = part.part_code == "listening_1" or part.part_code.endswith("listening_1")
    if is_l1 and not str(data.get("prompt") or "").strip():
        data["prompt"] = f"Question {current_count + 1}"
    constraints = dict(part.answer_constraints or {})
    if data["question_type"] in OPTION_BASED_QUESTION_TYPES and len(data.get("options", [])) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{part.title} requires at least 2 options per option-based question",
        )
    if constraints.get("passage_required") and not (data.get("passage") or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{part.title} requires the source text on every question",
        )
    interaction = dict(data.get("interaction") or {})
    if constraints.get("group_label_required") and not str(interaction.get("group_label") or "").strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{part.title} requires a conversation group label")
    if constraints.get("inline_marker_required") and "{{blank}}" not in data.get("prompt", ""):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{part.title} prompts must include a {{{{blank}}}} marker")
    allowed_turn_types = set(constraints.get("allowed_turn_types", []))
    if allowed_turn_types and interaction.get("turn_type") not in allowed_turn_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{part.title} requires one of these speaking turns: {', '.join(sorted(allowed_turn_types))}",
        )
    # A spoken heading is the examiner announcing the situation before she asks
    # about it, which is a Speaking 2 device. Elsewhere it would be a second,
    # invisible prompt that nothing in the part's flow accounts for, so it is
    # refused rather than silently dropped on save.
    if str(interaction.get("heading") or "").strip() and not constraints.get("spoken_heading"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{part.title} prompts have no spoken heading - put the wording in the question itself",
        )
    # Some turns are the part's single headline task - one read-aloud text, one
    # presentation stimulus, one identity exchange - while the rest are banks
    # the examiner draws from. A ceiling alone cannot tell them apart: it would
    # happily accept four read-alouds in Speaking 3. Editing the existing turn
    # is not a duplicate, so the question under edit is excluded from the count.
    singleton_turn_types = set(constraints.get("singleton_turn_types", []))
    turn_type = interaction.get("turn_type")
    if turn_type in singleton_turn_types:
        already = sum(
            1
            for existing in part.questions
            if existing.id != editing_question_id
            and (existing.interaction or {}).get("turn_type") == turn_type
        ) + sum(1 for pending in pending_turn_types if pending == turn_type)
        if already:
            label = turn_type.replace("_", " ")
            detail = f"{part.title} takes one {label} turn and already has one."
            bank_turns = [
                candidate
                for candidate in constraints.get("allowed_turn_types", [])
                if candidate not in singleton_turn_types
            ]
            if bank_turns:
                detail += f" Add further prompts as {bank_turns[0].replace('_', ' ')} turns."
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
    if part.part_code == "speaking_3" and interaction.get("turn_type") == "read_aloud" and not (data.get("passage") or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Speaking 3 read-aloud prompts require the candidate-visible text to read",
        )
    if data["question_type"] in {"matching_unique", "matching_reusable"} and len(data.get("correct_answers", [])) != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Matching questions require exactly one answer key",
        )
    if part.part_code == "reading_1a" and not re.search(r"\*\*(.+?)\*\*", data.get("prompt", "")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reading 1A questions require at least 1 bold word in the question prompt (e.g. **word**)",
        )
    max_words = (part.answer_constraints or {}).get("max_answer_words")
    if max_words and any(len(answer.split()) > max_words for answer in data.get("correct_answers", [])):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Answers in {part.title} may contain no more than {max_words} words")


def _new_question(
    part: ExamModulePart,
    actor: User,
    data: dict,
    source_type: str,
    source_filename: Optional[str],
    sort_order: int,
) -> ExamModuleQuestion:
    return ExamModuleQuestion(
        part_id=part.id,
        question_type=data["question_type"],
        prompt=data["prompt"],
        instructions=data.get("instructions"),
        passage=data.get("passage"),
        image_path=data.get("image_path"),
        options=[dict(option) for option in data.get("options", [])],
        correct_answers=list(data.get("correct_answers", [])),
        interaction=dict(data.get("interaction") or {}),
        explanation=data.get("explanation"),
        points=data.get("points", 1),
        difficulty=data.get("difficulty", "medium"),
        source_type=source_type,
        source_filename=source_filename,
        sort_order=sort_order,
        created_by_id=actor.id,
    )


def add_question(
    db: Session, actor: User, module_id: int, part_id: int, data: dict, ip: Optional[str]
) -> dict:
    module = get_module_or_404(db, module_id)
    _require_owner(module, actor)
    _require_draft(db, module)
    part = _part_or_404(module, part_id)
    _validate_question_for_part(part, data, len(part.questions))
    question = _new_question(part, actor, data, "manual", None, len(part.questions))
    db.add(question)
    db.flush()
    db.refresh(part)
    _resequence_questions(part)
    db.flush()
    _refresh_speaking_duration(db, module)
    _audit(db, actor, "exam_module.question.create", module.id, ip, {"part_id": part.id, "question_id": question.id})
    db.commit()
    db.refresh(question)
    return _question_out(question)


def import_questions(
    db: Session,
    actor: User,
    module_id: int,
    part_id: int,
    questions: list[dict],
    source_type: str,
    source_filename: Optional[str],
    ip: Optional[str],
) -> list[dict]:
    module = get_module_or_404(db, module_id)
    _require_owner(module, actor)
    _require_draft(db, module)
    part = _part_or_404(module, part_id)
    # Reject the whole batch up front so a part-full import fails with one clear
    # message instead of committing the rows that happened to fit.
    ceiling = part.question_limit or (part.answer_constraints or {}).get("maximum_questions")
    if ceiling is not None and len(part.questions) + len(questions) > ceiling:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"{part.title} takes at most {ceiling} "
                f"question{'s' if ceiling != 1 else ''} and already has {len(part.questions)}. "
                f"Importing {len(questions)} more would exceed it - import at most "
                f"{ceiling - len(part.questions)}."
            ),
        )
    for offset, question in enumerate(questions):
        _validate_question_for_part(
            part,
            question,
            len(part.questions) + offset,
            pending_turn_types=tuple(
                str((earlier.get('interaction') or {}).get('turn_type') or '')
                for earlier in questions[:offset]
            ),
        )
    records = [
        _new_question(part, actor, question, source_type, source_filename, len(part.questions) + index)
        for index, question in enumerate(questions)
    ]
    db.add_all(records)
    db.flush()
    db.refresh(part)
    _resequence_questions(part)
    db.flush()
    _refresh_speaking_duration(db, module)
    _audit(db, actor, "exam_module.question.import", module.id, ip, {"part_id": part.id, "count": len(records), "source_type": source_type, "source_filename": source_filename})
    db.commit()
    for record in records:
        db.refresh(record)
    return [_question_out(record) for record in records]


def _part_key(value: object) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").strip().lower())


def _part_hint(question: dict) -> str:
    return str(
        question.get("target_part")
        or (question.get("interaction") or {}).get("target_part")
        or ""
    ).strip()


def _default_turn_type(part: ExamModulePart, index: int) -> Optional[str]:
    constraints = part.answer_constraints or {}
    required = constraints.get("required_turn_types") or []
    allowed = constraints.get("allowed_turn_types") or []
    part_code = part.part_code
    if part_code == "speaking_1":
        return "identity" if index == 0 else "topic_question"
    if part_code == "speaking_2":
        return required[index % len(required)] if required else (allowed[0] if allowed else None)
    if part_code == "speaking_3":
        return "read_aloud" if index == 0 else "follow_up"
    if part_code == "speaking_4":
        return "presentation" if index == 0 else "follow_up"
    return required[0] if required else (allowed[0] if allowed else None)


def _turn_timing(part: ExamModulePart, turn_type: Optional[str]) -> tuple[int, int]:
    constraints = part.answer_constraints or {}
    timing = (constraints.get("turn_timings") or {}).get(turn_type or "") or {}
    return (
        int(timing.get("preparation_seconds", constraints.get("suggested_preparation_seconds", 0)) or 0),
        int(timing.get("response_seconds", constraints.get("suggested_response_seconds", 30)) or 30),
    )


def _normalize_import_question_for_part(part: ExamModulePart, question: dict, index: int) -> dict:
    data = dict(question)
    data.pop("target_part", None)
    constraints = part.answer_constraints or {}
    allowed = constraints.get("allowed_question_types") or []
    if allowed and data.get("question_type") not in allowed:
        data["question_type"] = allowed[0]

    question_type = data.get("question_type")
    if question_type not in OPTION_BASED_QUESTION_TYPES:
        data["options"] = []
    if question_type in {"essay", "speaking_prompt"}:
        data["correct_answers"] = []

    if constraints.get("inline_marker_required") and "{{blank}}" not in data.get("prompt", ""):
        data["prompt"] = f"{data.get('prompt', '').strip()} {{{{blank}}}}".strip()

    if part.part_code == "reading_1a" and not re.search(r"\*\*(.+?)\*\*", data.get("prompt", "")):
        prompt = data.get("prompt", "")
        data["prompt"] = re.sub(r"\b([A-Za-z][A-Za-z'-]*)\b", r"**\1**", prompt, count=1)

    if part.max_marks is not None and part.question_limit:
        data["points"] = Decimal(part.max_marks) / Decimal(part.question_limit)

    is_l1 = part.part_code == "listening_1" or part.part_code.endswith("listening_1")
    if is_l1 and not str(data.get("prompt") or "").strip():
        data["prompt"] = f"Question {index + 1}"

    interaction = dict(data.get("interaction") or {})
    if constraints.get("group_label_required") and not str(interaction.get("group_label") or "").strip():
        group_size = int(constraints.get("questions_per_group") or 1)
        interaction["group_label"] = f"Conversation {(index // group_size) + 1}"

    if part.section_type == "speaking":
        turn_type = interaction.get("turn_type")
        allowed_turns = constraints.get("allowed_turn_types") or []
        if turn_type not in allowed_turns:
            turn_type = _default_turn_type(part, index)
        interaction["turn_type"] = turn_type
        preparation, response = _turn_timing(part, turn_type)
        interaction["preparation_seconds"] = interaction.get("preparation_seconds") if interaction.get("preparation_seconds") is not None else preparation
        interaction["response_seconds"] = interaction.get("response_seconds") if interaction.get("response_seconds") is not None else response
        interaction["adaptive_follow_up"] = bool(interaction.get("adaptive_follow_up", turn_type == "follow_up"))
        if part.part_code == "speaking_3" and turn_type == "read_aloud" and not (data.get("passage") or "").strip():
            data["passage"] = data.get("prompt")

    data["interaction"] = interaction
    return data


def _module_import_capacity(part: ExamModulePart) -> Optional[int]:
    return part.question_limit or (part.answer_constraints or {}).get("maximum_questions")


_NOTEPAD_MARKER_RE = re.compile(r"\{\{blank:\d+\}\}")


def _synthesize_notepad_passage(rows: list[dict]) -> None:
    """Give a notepad_gaps part one shared passage across all its rows.

    Imported rows normally arrive as independent sentences (one bare
    {{blank}} each, empty passage) because the source CSV/PDF was authored
    per-question, like every other listening part. The authoring composer
    and the student runtime both expect a single passage - heading line
    optional, then the body with sequential {{blank:N}} markers - shared by
    every row (see NotepadGapsComposer/NotepadGapsGroup). Without this, the
    "Edit Notepad" panel shows an empty box after import even though rows
    were created. This mirrors the frontend's own buildFallbackNotepad, but
    also keeps a heading when the source supplied a shared passage.
    """
    if not rows:
        return
    total = len(rows)
    candidate_lines = [line for line in str(rows[0].get("passage") or "").strip().splitlines() if line.strip()]
    body_markers = sum(len(_NOTEPAD_MARKER_RE.findall(line)) for line in candidate_lines)
    if candidate_lines and body_markers >= total:
        passage = "\n".join(candidate_lines)
    else:
        # A PDF's text before its numbered list (e.g. a "Part: Listening 3"
        # header followed by a title and some intro sentences) has no
        # {{blank:N}} markers at all - it never reaches the per-question
        # prompt loop below. Keep it as heading + plain context lines rather
        # than discarding everything but the first line.
        gapless_lines = [line for line in candidate_lines if not _NOTEPAD_MARKER_RE.search(line)]
        heading = gapless_lines[0] if gapless_lines else ""
        context_lines = gapless_lines[1:]
        body_lines = []
        for index, row in enumerate(rows):
            prompt = str(row.get("prompt") or "").strip()
            marker = f"{{{{blank:{index + 1}}}}}"
            line = prompt.replace("{{blank}}", marker, 1) if "{{blank}}" in prompt else f"{prompt} {marker}".strip()
            body_lines.append(line)
        passage = "\n".join(([heading] if heading else []) + context_lines + body_lines)
    for row in rows:
        row["passage"] = passage


def _assign_module_import_questions(module: ExamModule, questions: list[dict]) -> tuple[list[dict], list[str]]:
    parts = sorted(module.parts, key=lambda item: item.sort_order)
    by_hint = {}
    for part in parts:
        by_hint[_part_key(part.part_code)] = part
        by_hint[_part_key(part.title)] = part
        by_hint[_part_key(part.title.replace(" ", "_"))] = part

    grouped: dict[int, list[dict]] = {part.id: [] for part in parts}
    warnings: list[str] = []
    cursor = 0

    def next_part_for(question: dict) -> Optional[ExamModulePart]:
        nonlocal cursor
        hint = _part_hint(question)
        if hint:
            part = by_hint.get(_part_key(hint))
            if part:
                return part
            warnings.append(f"Could not match part '{hint}' for: {str(question.get('prompt') or '')[:60]}")

        q_type = question.get("question_type")
        turn_type = (question.get("interaction") or {}).get("turn_type")
        if turn_type == "follow_up":
            for part in reversed(parts):
                allowed_turns = (part.answer_constraints or {}).get("allowed_turn_types") or []
                if "follow_up" in allowed_turns and grouped[part.id]:
                    return part

        if turn_type and turn_type != "follow_up":
            exact = [
                part for part in parts
                if turn_type in ((part.answer_constraints or {}).get("allowed_turn_types") or [])
            ]
            if turn_type in {"identity", "topic_question"}:
                exact = [part for part in exact if part.part_code == "speaking_1"]
            elif turn_type in {"roleplay_response", "roleplay_initiate"}:
                exact = [part for part in exact if part.part_code == "speaking_2"]
            elif turn_type == "read_aloud":
                exact = [part for part in exact if part.part_code == "speaking_3"]
            elif turn_type == "presentation":
                exact = [part for part in exact if part.part_code == "speaking_4"]
            if exact:
                return exact[0]

        while cursor < len(parts):
            part = parts[cursor]
            ceiling = _module_import_capacity(part)
            if ceiling is None and cursor < len(parts) - 1:
                ceiling = part.minimum_questions
            current = len(part.questions) + len(grouped[part.id])
            allowed = (part.answer_constraints or {}).get("allowed_question_types") or []
            if (ceiling is None or current < ceiling) and (not allowed or q_type in allowed or part.section_type in {"writing", "speaking"}):
                return part
            cursor += 1
        return None

    for question in questions:
        part = next_part_for(question)
        if part is None:
            warnings.append(f"No available part could accept: {str(question.get('prompt') or '')[:60]}")
            continue
        local_index = len(part.questions) + len(grouped[part.id])
        grouped[part.id].append(_normalize_import_question_for_part(part, question, local_index))

    result = []
    for part in parts:
        assigned = grouped[part.id]
        if not assigned:
            continue
        if (part.answer_constraints or {}).get("layout") == "notepad_gaps":
            _synthesize_notepad_passage(assigned)
        ceiling = _module_import_capacity(part)
        remaining = None if ceiling is None else max(0, ceiling - len(part.questions))
        result.append(
            {
                "part_id": part.id,
                "part_code": part.part_code,
                "part_title": part.title,
                "section_type": part.section_type,
                "layout": (part.answer_constraints or {}).get("layout"),
                "allowed_question_types": list((part.answer_constraints or {}).get("allowed_question_types") or []),
                "existing_count": len(part.questions),
                "remaining_slots": remaining,
                "questions": assigned,
                "question_count": len(assigned),
            }
        )
    return result, warnings


def preview_module_import(db: Session, actor: User, module_id: int, preview: dict) -> dict:
    module = get_editable_module(db, actor, module_id)
    parts, warnings = _assign_module_import_questions(module, preview.get("questions", []))
    return {
        "source_type": preview["source_type"],
        "source_filename": preview["source_filename"],
        "source_text": preview["source_text"],
        "parts": parts,
        "question_count": sum(part["question_count"] for part in parts),
        "warning_count": len(preview.get("warnings", [])) + len(warnings),
        "warnings": list(preview.get("warnings", [])) + warnings,
    }


def import_module_questions(
    db: Session,
    actor: User,
    module_id: int,
    part_batches: list[dict],
    source_type: str,
    source_filename: Optional[str],
    ip: Optional[str],
) -> dict:
    module = get_module_or_404(db, module_id)
    _require_owner(module, actor)
    _require_draft(db, module)
    parts_by_id = {part.id: part for part in module.parts}
    records: list[ExamModuleQuestion] = []
    for batch in part_batches:
        part = parts_by_id.get(batch["part_id"])
        if part is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import target part was not found in this module")
        questions = batch.get("questions") or []
        ceiling = _module_import_capacity(part)
        if ceiling is not None and len(part.questions) + len(questions) > ceiling:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"{part.title} takes at most {ceiling} "
                    f"question{'s' if ceiling != 1 else ''} and already has {len(part.questions)}. "
                    f"Importing {len(questions)} more would exceed it."
                ),
            )
        for offset, question in enumerate(questions):
            normalized = _normalize_import_question_for_part(part, question, len(part.questions) + offset)
            _validate_question_for_part(
                part,
                normalized,
                len(part.questions) + offset,
                pending_turn_types=tuple(
                    str((earlier.get("interaction") or {}).get("turn_type") or "")
                    for earlier in questions[:offset]
                ),
            )
            records.append(
                _new_question(part, actor, normalized, source_type, source_filename, len(part.questions) + offset)
            )

    db.add_all(records)
    db.flush()
    for part in parts_by_id.values():
        _resequence_questions(part)
    db.flush()
    _refresh_speaking_duration(db, module)
    _audit(
        db,
        actor,
        "exam_module.question.import_all",
        module.id,
        ip,
        {"count": len(records), "source_type": source_type, "source_filename": source_filename},
    )
    db.commit()
    return serialize_module(get_module_or_404(db, module.id), detailed=True)


def _question_or_404(part: ExamModulePart, question_id: int) -> ExamModuleQuestion:
    question = next((item for item in part.questions if item.id == question_id), None)
    if question is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question was not found in this module part")
    return question


def update_question(
    db: Session,
    actor: User,
    module_id: int,
    part_id: int,
    question_id: int,
    data: dict,
    ip: Optional[str],
) -> dict:
    module = get_module_or_404(db, module_id)
    _require_owner(module, actor)
    _require_draft(db, module)
    part = _part_or_404(module, part_id)
    question = _question_or_404(part, question_id)
    _validate_question_for_part(part, data, max(0, len(part.questions) - 1), editing_question_id=question_id)
    previous_image_path = question.image_path
    previous_material_path = (question.interaction or {}).get("candidate_material_path")
    for field in ("question_type", "prompt", "instructions", "passage", "image_path", "correct_answers", "interaction", "explanation", "points", "difficulty"):
        setattr(question, field, data.get(field))
    question.options = [dict(option) for option in data.get("options", [])]
    db.flush()
    _refresh_speaking_duration(db, module)
    _audit(db, actor, "exam_module.question.update", module.id, ip, {"part_id": part.id, "question_id": question.id})
    db.commit()
    db.refresh(question)
    if previous_image_path and previous_image_path != question.image_path:
        (settings.storage_path / previous_image_path).unlink(missing_ok=True)
    current_material_path = (question.interaction or {}).get("candidate_material_path")
    if previous_material_path and previous_material_path != current_material_path:
        (settings.storage_path / previous_material_path).unlink(missing_ok=True)
    return _question_out(question)


def delete_question(
    db: Session, actor: User, module_id: int, part_id: int, question_id: int, ip: Optional[str]
) -> None:
    module = get_module_or_404(db, module_id)
    _require_owner(module, actor)
    _require_draft(db, module)
    part = _part_or_404(module, part_id)
    question = _question_or_404(part, question_id)
    image_path = question.image_path
    material_path = (question.interaction or {}).get("candidate_material_path")
    _audit(db, actor, "exam_module.question.delete", module.id, ip, {"part_id": part.id, "question_id": question.id})
    db.query(AttemptAnswer).filter(AttemptAnswer.question_id == question.id).delete(synchronize_session=False)
    db.delete(question)
    db.flush()
    db.refresh(part)
    _resequence_questions(part)
    db.flush()
    _refresh_speaking_duration(db, module)
    db.commit()
    if image_path:
        (settings.storage_path / image_path).unlink(missing_ok=True)
    if material_path:
        (settings.storage_path / material_path).unlink(missing_ok=True)


def save_question_image(
    db: Session,
    actor: User,
    module_id: int,
    part_id: int,
    *,
    content: bytes,
    ip: Optional[str],
) -> dict:
    module = get_module_or_404(db, module_id)
    _require_owner(module, actor)
    _require_draft(db, module)
    part = _part_or_404(module, part_id)

    relative = Path("exam-modules") / str(module.id) / "questions" / f"{uuid4().hex}.webp"
    destination = settings.storage_path / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(content)
    _audit(db, actor, "exam_module.question_image.upload", module.id, ip, {"part_id": part.id})
    db.commit()
    return {"image_path": relative.as_posix(), "image_url": f"/storage/{relative.as_posix()}"}


def save_speaking_material_pdf(
    db: Session,
    actor: User,
    module_id: int,
    part_id: int,
    *,
    content: bytes,
    original_filename: str,
    ip: Optional[str],
) -> dict:
    module = get_module_or_404(db, module_id)
    _require_owner(module, actor)
    _require_draft(db, module)
    part = _part_or_404(module, part_id)
    if part.section_type != "speaking":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PDF material is available only for Speaking parts")

    relative = Path("exam-modules") / str(module.id) / "speaking-materials" / f"{uuid4().hex}.pdf"
    destination = settings.storage_path / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(content)
    _audit(db, actor, "exam_module.speaking_material.upload", module.id, ip, {"part_id": part.id})
    db.commit()
    return {
        "candidate_material_path": relative.as_posix(),
        "candidate_material_url": sign_path(relative.as_posix()),
        "candidate_material_name": Path(original_filename).name[:255],
    }


def save_question_audio(
    db: Session,
    actor: User,
    module_id: int,
    part_id: int,
    *,
    content: bytes,
    ip: Optional[str],
) -> dict:
    module = get_module_or_404(db, module_id)
    _require_owner(module, actor)
    _require_draft(db, module)
    part = _part_or_404(module, part_id)

    relative = Path("exam-modules") / str(module.id) / "questions" / f"{uuid4().hex}.mp3"
    destination = settings.storage_path / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(content)
    _audit(db, actor, "exam_module.question_audio.upload", module.id, ip, {"part_id": part.id})
    db.commit()
    return {"audio_path": relative.as_posix(), "audio_url": f"/storage/{relative.as_posix()}"}


def add_audio_asset(
    db: Session,
    actor: User,
    module_id: int,
    part_id: int,
    *,
    content: bytes,
    title: str,
    original_filename: str,
    asset_type: str,
    transcript: Optional[str],
    voice: Optional[str],
    ip: Optional[str],
) -> dict:
    module = get_module_or_404(db, module_id)
    _require_owner(module, actor)
    _require_draft(db, module)
    part = _part_or_404(module, part_id)
    if part.section_type != "listening":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Audio can only be attached to a Listening part")

    relative = Path("exam-modules") / str(module.id) / f"{uuid4().hex}.mp3"
    destination = settings.storage_path / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(content)
    asset = ExamModuleAsset(
        module_id=module.id,
        part_id=part.id,
        asset_type=asset_type,
        title=title.strip()[:2000],
        original_filename=original_filename[:255],
        file_path=relative.as_posix(),
        mime_type="audio/mpeg",
        file_size=len(content),
        transcript=transcript,
        tts_voice=voice,
        tts_rate=None,
        uploaded_by_id=actor.id,
    )
    try:
        db.add(asset)
        db.flush()
        _audit(db, actor, "exam_module.audio.create", module.id, ip, {"part_id": part.id, "asset_type": asset_type})
        db.commit()
    except Exception:
        db.rollback()
        destination.unlink(missing_ok=True)
        raise
    db.refresh(asset)
    return _asset_out(asset)


def add_tts_text_asset(
    db: Session,
    actor: User,
    module_id: int,
    part_id: int,
    *,
    title: str,
    transcript: str,
    voice: str,
    rate: str,
    ip: Optional[str],
) -> dict:
    module = get_module_or_404(db, module_id)
    _require_owner(module, actor)
    _require_draft(db, module)
    part = _part_or_404(module, part_id)
    if part.section_type != "listening":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Browser narration can only be attached to a Listening part")

    clean_transcript = "\n".join(line.strip() for line in transcript.splitlines() if line.strip())
    if not clean_transcript:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A listening transcript is required")

    virtual_path = Path("tts-text") / str(module.id) / f"{uuid4().hex}.txt"
    asset = ExamModuleAsset(
        module_id=module.id,
        part_id=part.id,
        asset_type="tts_text",
        title=title.strip()[:2000],
        original_filename="browser-narration.txt",
        file_path=virtual_path.as_posix(),
        mime_type="text/plain",
        file_size=len(clean_transcript.encode("utf-8")),
        transcript=clean_transcript,
        tts_voice=voice,
        tts_rate=rate,
        uploaded_by_id=actor.id,
    )
    db.add(asset)
    db.flush()
    _audit(
        db,
        actor,
        "exam_module.browser_tts.create",
        module.id,
        ip,
        {"part_id": part.id, "voice": voice, "rate": rate},
    )
    db.commit()
    db.refresh(asset)
    return _asset_out(asset)


def speaking_script(part: ExamModulePart) -> str:
    """Concatenates a Speaking part's prompt questions into one script for
    TTS/avatar narration, in question order."""
    prompts = [
        question.prompt
        for question in sorted(part.questions, key=lambda q: q.sort_order)
        if question.question_type == "speaking_prompt" and question.prompt.strip()
    ]
    return "  ...  ".join(prompts)


def get_speaking_part_for_preview(
    db: Session, actor: User, module_id: int, part_id: int
) -> ExamModulePart:
    """Resolve a Speaking part for an authoring-time examiner preview.

    Previewing only reads the prompt back in the examiner voice, so unlike
    `get_editable_part` it stays available once the module is published or
    archived - the author still needs to hear what candidates will hear.
    """
    module = get_module_or_404(db, module_id)
    _require_owner(module, actor)
    part = _part_or_404(module, part_id)
    if part.section_type != "speaking":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Examiner preview is available only for Speaking parts",
        )
    return part


def add_avatar_asset(
    db: Session,
    actor: User,
    module_id: int,
    part_id: int,
    *,
    content: bytes,
    title: str,
    script_text: str,
    ip: Optional[str],
) -> dict:
    module = get_module_or_404(db, module_id)
    _require_owner(module, actor)
    part = _part_or_404(module, part_id)
    if part.section_type != "speaking":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Avatar video can only be attached to a Speaking part")

    relative = Path("exam-modules") / str(module.id) / f"{uuid4().hex}.mp4"
    destination = settings.storage_path / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(content)
    # Replace any previous avatar clip for this part - only one is meaningful at a time.
    for existing in list(part.assets):
        if existing.asset_type == "avatar_mp4":
            old_path = settings.storage_path / existing.file_path
            db.delete(existing)
            old_path.unlink(missing_ok=True)
    asset = ExamModuleAsset(
        module_id=module.id,
        part_id=part.id,
        asset_type="avatar_mp4",
        title=title.strip()[:2000],
        original_filename="avatar-presenter.mp4",
        file_path=relative.as_posix(),
        mime_type="video/mp4",
        file_size=len(content),
        transcript=script_text,
        tts_voice=None,
        tts_rate=None,
        uploaded_by_id=actor.id,
    )
    try:
        db.add(asset)
        db.flush()
        _audit(db, actor, "exam_module.avatar.create", module.id, ip, {"part_id": part.id})
        db.commit()
    except Exception:
        db.rollback()
        destination.unlink(missing_ok=True)
        raise
    db.refresh(asset)
    return _asset_out(asset)


def delete_asset(db: Session, actor: User, module_id: int, asset_id: int, ip: Optional[str]) -> None:
    module = get_module_or_404(db, module_id)
    _require_owner(module, actor)
    _require_draft(db, module)
    asset = next((item for item in module.assets if item.id == asset_id), None)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio asset not found in this module")
    path = settings.storage_path / asset.file_path
    _audit(db, actor, "exam_module.audio.delete", module.id, ip, {"asset_id": asset.id})
    db.delete(asset)
    db.commit()
    path.unlink(missing_ok=True)


def set_status(
    db: Session, actor: User, module_id: int, new_status: str, ip: Optional[str]
) -> dict:
    module = get_module_or_404(db, module_id)
    _require_owner(module, actor)
    if new_status == "published":
        errors = validation_errors(module)
        if errors:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": "Module is not ready to publish", "errors": errors})
        _refresh_speaking_duration(db, module)
        module.published_at = _now()
    elif new_status == "draft":
        module.published_at = None
    module.status = new_status
    _audit(db, actor, "exam_module.status", module.id, ip, {"status": new_status})
    db.commit()
    return serialize_module(get_module_or_404(db, module.id), detailed=True)


def delete_module(db: Session, actor: User, module_id: int, ip: Optional[str]) -> None:
    module = get_module_or_404(db, module_id)
    _require_owner(module, actor)
    if module.status != "draft":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only draft modules can be deleted")
    paths = [settings.storage_path / asset.file_path for asset in module.assets]
    _audit(
        db,
        actor,
        "exam_module.delete",
        module.id,
        ip,
        {"title": module.title, "status": module.status},
    )
    db.delete(module)
    db.commit()
    for path in paths:
        path.unlink(missing_ok=True)


def _assignment_out(assignment: InstituteModule) -> dict:
    return {
        "id": assignment.id,
        "institute_id": assignment.institute_id,
        "institute_name": assignment.institute.name,
        "is_active": assignment.is_active,
        "assigned_at": assignment.assigned_at,
    }


def serialize_for_super_admin(module: ExamModule) -> dict:
    result = serialize_module(module, detailed=True)
    result["assignments"] = [
        _assignment_out(item)
        for item in sorted(module.institute_assignments, key=lambda row: row.institute.name.lower())
    ]
    return result


def analytics_for_super_admin(db: Session, module_id: int) -> dict:
    get_module_or_404(db, module_id)
    attempts = (
        db.query(TestAttempt)
        .options(joinedload(TestAttempt.user).joinedload(User.institute))
        .filter(TestAttempt.module_id == module_id)
        .all()
    )

    scored_percentages: list[float] = []
    cefr_distribution: dict[str, int] = {}
    score_distribution = {
        "Under 50%": 0,
        "50% - 70%": 0,
        "70% - 85%": 0,
        "85% or Above": 0,
    }
    institute_performance: dict[int | None, dict] = {}
    completed_statuses = {ATTEMPT_SUBMITTED, ATTEMPT_GRADING, ATTEMPT_GRADED}
    completed_attempts = 0

    for attempt in attempts:
        institute = attempt.user.institute if attempt.user else None
        institute_id = institute.id if institute else None
        institute_name = institute.name if institute else "Independent / Direct"
        institute_row = institute_performance.setdefault(
            institute_id,
            {
                "institute_id": institute_id,
                "institute_name": institute_name,
                "total_attempts": 0,
                "completed_attempts": 0,
                "scores": [],
                "cefr_distribution": {},
                "score_distribution": {
                    "Under 50%": 0,
                    "50% - 70%": 0,
                    "70% - 85%": 0,
                    "85% or Above": 0,
                },
            },
        )
        institute_row["total_attempts"] += 1

        is_completed = attempt.status in completed_statuses or (
            attempt.raw_score is not None and attempt.max_score is not None
        )
        if not is_completed:
            continue

        completed_attempts += 1
        institute_row["completed_attempts"] += 1

        if attempt.raw_score is not None and attempt.max_score is not None and attempt.max_score > 0:
            pct = (float(attempt.raw_score) / float(attempt.max_score)) * 100
            scored_percentages.append(pct)
            institute_row["scores"].append(pct)
            if pct < 50:
                score_distribution["Under 50%"] += 1
                institute_row["score_distribution"]["Under 50%"] += 1
            elif pct < 70:
                score_distribution["50% - 70%"] += 1
                institute_row["score_distribution"]["50% - 70%"] += 1
            elif pct < 85:
                score_distribution["70% - 85%"] += 1
                institute_row["score_distribution"]["70% - 85%"] += 1
            else:
                score_distribution["85% or Above"] += 1
                institute_row["score_distribution"]["85% or Above"] += 1

        if attempt.cefr_level:
            cefr = attempt.cefr_level.upper()
            cefr_distribution[cefr] = cefr_distribution.get(cefr, 0) + 1
            institute_row["cefr_distribution"][cefr] = institute_row["cefr_distribution"].get(cefr, 0) + 1

    leaderboard = []
    for row in institute_performance.values():
        scores = row.pop("scores")
        average = sum(scores) / len(scores) if scores else 0.0
        leaderboard.append({**row, "average_score_pct": round(average, 1)})
    leaderboard.sort(key=lambda item: (item["average_score_pct"], item["completed_attempts"], item["total_attempts"]), reverse=True)

    average_score = sum(scored_percentages) / len(scored_percentages) if scored_percentages else 0.0
    return {
        "total_attempts": len(attempts),
        "completed_attempts": completed_attempts,
        "average_score_pct": round(average_score, 1),
        "cefr_distribution": cefr_distribution,
        "score_distribution": score_distribution,
        "institute_performance": leaderboard,
    }


def list_all_modules(
    db: Session,
    search: Optional[str] = None,
    module_type: Optional[str] = None,
    status_filter: Optional[str] = None,
) -> list[dict]:
    query = _module_query(db).filter(ExamModule.deleted_at.is_(None))
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(ExamModule.title.ilike(term), ExamModule.description.ilike(term)))
    if module_type:
        query = query.filter(ExamModule.module_type == module_type)
    if status_filter:
        query = query.filter(ExamModule.status == status_filter)
    return [serialize_module(module) for module in query.order_by(ExamModule.created_by_id, ExamModule.created_at.desc()).all()]


def set_visibility(db: Session, actor: User, module_id: int, visible: bool, ip: Optional[str]) -> dict:
    module = get_module_or_404(db, module_id)
    module.is_visible = visible
    _audit(db, actor, "exam_module.show" if visible else "exam_module.hide", module.id, ip)
    db.add(module)
    db.commit()
    return serialize_for_super_admin(get_module_or_404(db, module.id))


def set_demo(db: Session, actor: User, module_id: int, is_demo: bool, ip: Optional[str]) -> dict:
    """Demo modules are free sample tests: students without a subscription may
    sit them to preview the platform. Only published, visible modules qualify -
    a draft or hidden module would 404 for the student anyway."""
    module = get_module_or_404(db, module_id)
    if is_demo and (module.status != "published" or not module.is_visible):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only a published, visible module can be offered as a free demo",
        )
    module.is_demo = is_demo
    _audit(db, actor, "exam_module.demo_on" if is_demo else "exam_module.demo_off", module.id, ip)
    db.add(module)
    db.commit()
    return serialize_for_super_admin(get_module_or_404(db, module.id))


def remove_by_super_admin(db: Session, actor: User, module_id: int, ip: Optional[str]) -> None:
    module = get_module_or_404(db, module_id)
    module.status = "archived"
    module.is_visible = False
    module.deleted_at = _now()
    db.query(InstituteModule).filter(
        InstituteModule.module_id == module.id, InstituteModule.is_active.is_(True)
    ).update({"is_active": False}, synchronize_session=False)
    for plan in db.query(Plan).filter(Plan.modules.any(ExamModule.id == module.id)).all():
        plan.modules.remove(module)
        db.add(plan)
    _audit(db, actor, "exam_module.remove", module.id, ip, {"title": module.title})
    db.add(module)
    db.commit()


def assign_to_institute(
    db: Session, actor: User, module_id: int, institute_id: int, ip: Optional[str], allow_inactive: bool = False
) -> dict:
    module = get_module_or_404(db, module_id)
    if module.status != "published":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only published courses can be assigned")
    institute = db.get(Institute, institute_id)
    if institute is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institute not found")
    if not institute.is_active and not allow_inactive:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Draft or suspended institutes cannot receive live access")
    assignment = db.query(InstituteModule).filter(
        InstituteModule.institute_id == institute_id, InstituteModule.module_id == module_id
    ).first()
    if assignment is None:
        assignment = InstituteModule(institute_id=institute_id, module_id=module_id, assigned_by_id=actor.id, is_active=True)
        db.add(assignment)
    elif assignment.is_active:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Course is already assigned to this institute")
    else:
        assignment.is_active = True
        assignment.assigned_by_id = actor.id
        assignment.assigned_at = _now()
        db.add(assignment)
    db.flush()
    _audit(db, actor, "exam_module.assign", module.id, ip, {"institute_id": institute_id})
    db.commit()
    assignment = db.query(InstituteModule).options(joinedload(InstituteModule.institute)).filter(InstituteModule.id == assignment.id).one()
    return _assignment_out(assignment)


def unassign_from_institute(db: Session, actor: User, module_id: int, institute_id: int, ip: Optional[str]) -> None:
    assignment = db.query(InstituteModule).filter(
        InstituteModule.institute_id == institute_id,
        InstituteModule.module_id == module_id,
        InstituteModule.is_active.is_(True),
    ).first()
    if assignment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active course assignment not found")
    assignment.is_active = False
    db.add(assignment)
    _audit(db, actor, "exam_module.unassign", module_id, ip, {"institute_id": institute_id})
    db.commit()


def serialize_part(part: ExamModulePart) -> dict:
    return {
        "id": part.id,
        "module_id": part.module_id,
        "section_type": part.section_type,
        "part_code": part.part_code,
        "title": part.title,
        "skill_focus": part.skill_focus,
        "instructions": part.instructions,
        "question_limit": part.question_limit,
        "minimum_questions": part.minimum_questions,
        "max_marks": str(part.max_marks) if part.max_marks is not None else None,
        "duration_minutes": part.duration_minutes,
        "auto_marked": part.auto_marked,
        "ai_evaluation_enabled": part.ai_evaluation_enabled,
        "answer_constraints": dict(part.answer_constraints or {}),
        "rubric": list(part.rubric or []),
        "sort_order": part.sort_order,
        "questions": [_question_out(question) for question in part.questions],
        "assets": [_asset_out(asset) for asset in part.assets],
    }


def update_part(
    db: Session,
    actor: User,
    module_id: int,
    part_id: int,
    data: dict,
    fields_set: set[str],
    ip: Optional[str],
) -> dict:
    module, part = get_editable_part(db, actor, module_id, part_id)

    if "title" in fields_set:
        # The section heading is what the candidate sees above the part and what
        # the publishing checklist names its errors after, so it must not be
        # blanked. Rejected here rather than only in the UI, since the endpoint
        # is reachable directly.
        title = (data.get("title") or "").strip()
        if not title:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Section heading is required.",
            )
        part.title = title
    if "instructions" in fields_set:
        part.instructions = data["instructions"]
    if "audio_mode" in fields_set and data.get("audio_mode") is not None:
        merged = dict(part.answer_constraints or {})
        merged["audio_mode"] = data["audio_mode"]
        part.answer_constraints = merged
    elif "answer_constraints" in fields_set and data.get("answer_constraints") is not None:
        merged = dict(part.answer_constraints or {})
        merged.update(data["answer_constraints"])
        part.answer_constraints = merged

    db.add(part)
    _audit(db, actor, "exam_module.part_update", module.id, ip, {"part_id": part.id})
    db.commit()
    db.refresh(part)
    return serialize_part(part)
