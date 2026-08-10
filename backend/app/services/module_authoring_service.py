from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
import secrets
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.config import settings
from app.models.audit_log import AuditLog
from app.models.attempt import ATTEMPT_GRADED, ATTEMPT_GRADING, ATTEMPT_SUBMITTED, TestAttempt
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


def _require_draft(module: ExamModule) -> None:
    if module.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archived courses cannot be edited. Restore the course first.",
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
    _require_draft(module)
    return module, _part_or_404(module, part_id)


def _question_out(question: ExamModuleQuestion) -> dict:
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
        "interaction": dict(question.interaction or {}),
        "explanation": question.explanation,
        "points": str(question.points),
        "difficulty": question.difficulty,
        "source_type": question.source_type,
        "source_filename": question.source_filename,
        "sort_order": question.sort_order,
        "created_at": question.created_at,
        "updated_at": question.updated_at,
    }


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
        if count < part.minimum_questions:
            errors.append(
                f"{part.title} requires at least {part.minimum_questions} question"
                f"{'s' if part.minimum_questions != 1 else ''}; it currently has {count}."
            )
        if part.question_limit is not None and count < part.question_limit:
            errors.append(
                f"{part.title} draws {part.question_limit} questions per attempt; its pool currently has {count}."
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
        if constraints.get("layout") == "shared_cloze" and part.questions:
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
                            f"(total {part.max_marks:g} / {part.question_limit} questions drawn per attempt); "
                            f"question '{q.prompt[:30]}...' has {q.points:g} marks."
                        )
            else:
                total = sum((Decimal(question.points) for question in part.questions), Decimal("0"))
                if total != Decimal(part.max_marks):
                    errors.append(f"{part.title} must total {part.max_marks:g} marks; it currently totals {total:g}.")
        if (part.answer_constraints or {}).get("audio_required") and not part.assets:
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
    module_type = payload["module_type"]
    blueprint = get_blueprint(module_type)
    composite = module_type in {"full_mock", "final_test"}
    sources = _composite_sources(db, actor, source_module_ids) if composite else {}
    if not composite and source_module_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Source modules are only valid for composite tests")
    module = ExamModule(
        **payload,
        duration_minutes=blueprint["duration_minutes"],
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
                    db.add(
                        _new_question(
                            target_part,
                            actor,
                            {
                                "question_type": question.question_type,
                                "prompt": question.prompt,
                                "instructions": question.instructions,
                                "passage": question.passage,
                                "options": list(question.options or []),
                                "correct_answers": list(question.correct_answers or []),
                                "interaction": dict(question.interaction or {}),
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
    _require_draft(module)
    for field in ("title", "description", "instructions", "duration_minutes", "show_onboarding_instructions", "onboarding_instructions"):
        if field in fields_set:
            setattr(module, field, data.get(field))
    _audit(db, actor, "exam_module.update", module.id, ip, {"fields": sorted(fields_set)})
    db.commit()
    return serialize_module(get_module_or_404(db, module.id), detailed=True)


def update_speaking_part_timing(
    db: Session,
    actor: User,
    module_id: int,
    part_id: int,
    preparation_seconds: int,
    response_seconds: int,
    ip: Optional[str],
) -> dict:
    module, part = get_editable_part(db, actor, module_id, part_id)
    if part.section_type != "speaking":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Timing can only be configured for Speaking parts")

    constraints = dict(part.answer_constraints or {})
    constraints["preparation_seconds"] = preparation_seconds
    constraints["response_seconds"] = response_seconds
    part.answer_constraints = constraints
    _audit(
        db,
        actor,
        "exam_module.speaking_timing.update",
        module.id,
        ip,
        {
            "part_id": part.id,
            "preparation_seconds": preparation_seconds,
            "response_seconds": response_seconds,
        },
    )
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
    if part.part_code != "reading_1a":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A custom heading can only be set for Reading 1A",
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


def _validate_question_for_part(part: ExamModulePart, data: dict, current_count: int) -> None:
    allowed = set((part.answer_constraints or {}).get("allowed_question_types", []))
    if allowed and data["question_type"] not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{part.title} accepts only: {', '.join(sorted(allowed))}",
        )
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
    if data["question_type"] in {"matching_unique", "matching_reusable"} and len(data.get("correct_answers", [])) != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Matching questions require exactly one answer key",
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
    _require_draft(module)
    part = _part_or_404(module, part_id)
    _validate_question_for_part(part, data, len(part.questions))
    question = _new_question(part, actor, data, "manual", None, len(part.questions))
    db.add(question)
    db.flush()
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
    _require_draft(module)
    part = _part_or_404(module, part_id)
    # Pool size is unrestricted, so we allow importing more than question_limit questions
    pass
    for offset, question in enumerate(questions):
        _validate_question_for_part(part, question, len(part.questions) + offset)
    records = [
        _new_question(part, actor, question, source_type, source_filename, len(part.questions) + index)
        for index, question in enumerate(questions)
    ]
    db.add_all(records)
    db.flush()
    _audit(db, actor, "exam_module.question.import", module.id, ip, {"part_id": part.id, "count": len(records), "source_type": source_type, "source_filename": source_filename})
    db.commit()
    for record in records:
        db.refresh(record)
    return [_question_out(record) for record in records]


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
    _require_draft(module)
    part = _part_or_404(module, part_id)
    question = _question_or_404(part, question_id)
    _validate_question_for_part(part, data, max(0, len(part.questions) - 1))
    previous_image_path = question.image_path
    for field in ("question_type", "prompt", "instructions", "passage", "image_path", "correct_answers", "interaction", "explanation", "points", "difficulty"):
        setattr(question, field, data.get(field))
    question.options = [dict(option) for option in data.get("options", [])]
    _audit(db, actor, "exam_module.question.update", module.id, ip, {"part_id": part.id, "question_id": question.id})
    db.commit()
    db.refresh(question)
    if previous_image_path and previous_image_path != question.image_path:
        (settings.storage_path / previous_image_path).unlink(missing_ok=True)
    return _question_out(question)


def delete_question(
    db: Session, actor: User, module_id: int, part_id: int, question_id: int, ip: Optional[str]
) -> None:
    module = get_module_or_404(db, module_id)
    _require_owner(module, actor)
    _require_draft(module)
    part = _part_or_404(module, part_id)
    question = _question_or_404(part, question_id)
    image_path = question.image_path
    _audit(db, actor, "exam_module.question.delete", module.id, ip, {"part_id": part.id, "question_id": question.id})
    db.delete(question)
    db.commit()
    if image_path:
        (settings.storage_path / image_path).unlink(missing_ok=True)


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
    _require_draft(module)
    part = _part_or_404(module, part_id)

    relative = Path("exam-modules") / str(module.id) / "questions" / f"{uuid4().hex}.webp"
    destination = settings.storage_path / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(content)
    _audit(db, actor, "exam_module.question_image.upload", module.id, ip, {"part_id": part.id})
    db.commit()
    return {"image_path": relative.as_posix(), "image_url": f"/storage/{relative.as_posix()}"}


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
    _require_draft(module)
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
        title=title.strip()[:200],
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
    _require_draft(module)
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
        title=title.strip()[:200],
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
        title=title.strip()[:200],
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
    _require_draft(module)
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

    db.add(part)
    _audit(db, actor, "exam_module.part_update", module.id, ip, {"part_id": part.id})
    db.commit()
    db.refresh(part)
    return serialize_part(part)
