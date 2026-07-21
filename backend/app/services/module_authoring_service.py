from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
import secrets
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.config import settings
from app.models.audit_log import AuditLog
from app.models.exam_module import ExamModule, ExamModuleAsset, ExamModulePart, ExamModuleQuestion
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
    )


def get_module_or_404(db: Session, module_id: int) -> ExamModule:
    module = _module_query(db).filter(ExamModule.id == module_id).first()
    if module is None:
        raise HTTPException(status_code=404, detail="Assessment module not found")
    return module


def _require_owner(module: ExamModule, actor: User) -> None:
    if module.created_by_id != actor.id:
        raise HTTPException(status_code=403, detail="Only this module's creator can change it")


def _require_draft(module: ExamModule) -> None:
    if module.status != "draft":
        raise HTTPException(
            status_code=400,
            detail="Only draft modules can be edited. Move this module back to draft first.",
        )


def _part_or_404(module: ExamModule, part_id: int) -> ExamModulePart:
    part = next((item for item in module.parts if item.id == part_id), None)
    if part is None:
        raise HTTPException(status_code=404, detail="Assessment part was not found in this module")
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
        "options": list(question.options or []),
        "correct_answers": list(question.correct_answers or []),
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
        "url": f"/storage/{asset.file_path}",
        "mime_type": asset.mime_type,
        "file_size": asset.file_size,
        "transcript": asset.transcript,
        "tts_voice": asset.tts_voice,
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
        if part.question_limit is not None and count != part.question_limit:
            errors.append(
                f"{part.title} must contain exactly {part.question_limit} questions; it currently has {count}."
            )
        allowed = set((part.answer_constraints or {}).get("allowed_question_types", []))
        invalid = sorted({question.question_type for question in part.questions if allowed and question.question_type not in allowed})
        if invalid:
            errors.append(f"{part.title} contains unsupported question types: {', '.join(invalid)}.")
        if part.max_marks is not None:
            total = sum((Decimal(question.points) for question in part.questions), Decimal("0"))
            if total != Decimal(part.max_marks):
                errors.append(f"{part.title} must total {part.max_marks:g} marks; it currently totals {total:g}.")
        if (part.answer_constraints or {}).get("audio_required") and not part.assets:
            errors.append(f"{part.title} requires an MP3 upload or generated conversation audio.")
    return errors


def serialize_module(module: ExamModule, detailed: bool = False) -> dict:
    blueprint = get_blueprint(module.module_type)
    errors = validation_errors(module)
    result = {
        "id": module.id,
        "module_type": module.module_type,
        "module_label": blueprint["label"],
        "title": module.title,
        "description": module.description,
        "instructions": module.instructions,
        "status": module.status,
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
    query = _module_query(db).filter(ExamModule.created_by_id == actor.id)
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
            status_code=400,
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
            status_code=400,
            detail="Every selected source must be a module created by you",
        )
    by_type = {source.module_type: source for source in sources}
    required = {"listening", "reading", "writing", "speaking"}
    if set(by_type) != required:
        raise HTTPException(
            status_code=400,
            detail="Select one source from each skill: Listening, Reading, Writing, and Speaking",
        )
    for source in sources:
        errors = validation_errors(source)
        if source.status == "archived" or errors:
            raise HTTPException(
                status_code=400,
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
        raise HTTPException(status_code=400, detail="Source modules are only valid for composite tests")
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
                        status_code=400,
                        detail=f"{source.title} does not contain {target_part.title}",
                    )

                randomized_questions = list(source_part.questions)
                randomizer.shuffle(randomized_questions)
                for order, question in enumerate(randomized_questions):
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
                    source_path = settings.storage_path / asset.file_path
                    if not source_path.is_file():
                        raise HTTPException(
                            status_code=400,
                            detail=f"Audio file for {source_part.title} is missing from storage",
                        )
                    relative = Path("exam-modules") / str(module.id) / f"{uuid4().hex}.mp3"
                    destination = settings.storage_path / relative
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    content = source_path.read_bytes()
                    destination.write_bytes(content)
                    created_paths.append(destination)
                    db.add(
                        ExamModuleAsset(
                            module_id=module.id,
                            part_id=target_part.id,
                            asset_type=asset.asset_type,
                            title=asset.title,
                            original_filename=asset.original_filename,
                            file_path=relative.as_posix(),
                            mime_type=asset.mime_type,
                            file_size=len(content),
                            transcript=asset.transcript,
                            tts_voice=asset.tts_voice,
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
    for field in ("title", "description", "instructions"):
        if field in fields_set:
            setattr(module, field, data.get(field))
    _audit(db, actor, "exam_module.update", module.id, ip, {"fields": sorted(fields_set)})
    db.commit()
    return serialize_module(get_module_or_404(db, module.id), detailed=True)


def _validate_question_for_part(part: ExamModulePart, data: dict, current_count: int) -> None:
    allowed = set((part.answer_constraints or {}).get("allowed_question_types", []))
    if allowed and data["question_type"] not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"{part.title} accepts only: {', '.join(sorted(allowed))}",
        )
    if part.question_limit is not None and current_count >= part.question_limit:
        raise HTTPException(status_code=400, detail=f"{part.title} is limited to {part.question_limit} questions")
    max_words = (part.answer_constraints or {}).get("max_answer_words")
    if max_words and any(len(answer.split()) > max_words for answer in data.get("correct_answers", [])):
        raise HTTPException(status_code=400, detail=f"Answers in {part.title} may contain no more than {max_words} words")


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
        options=[dict(option) for option in data.get("options", [])],
        correct_answers=list(data.get("correct_answers", [])),
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
    if part.question_limit is not None and len(part.questions) + len(questions) > part.question_limit:
        remaining = part.question_limit - len(part.questions)
        raise HTTPException(status_code=400, detail=f"{part.title} has room for only {remaining} more questions")
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
        raise HTTPException(status_code=404, detail="Question was not found in this module part")
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
    for field in ("question_type", "prompt", "instructions", "passage", "correct_answers", "explanation", "points", "difficulty"):
        setattr(question, field, data.get(field))
    question.options = [dict(option) for option in data.get("options", [])]
    _audit(db, actor, "exam_module.question.update", module.id, ip, {"part_id": part.id, "question_id": question.id})
    db.commit()
    db.refresh(question)
    return _question_out(question)


def delete_question(
    db: Session, actor: User, module_id: int, part_id: int, question_id: int, ip: Optional[str]
) -> None:
    module = get_module_or_404(db, module_id)
    _require_owner(module, actor)
    _require_draft(module)
    part = _part_or_404(module, part_id)
    question = _question_or_404(part, question_id)
    _audit(db, actor, "exam_module.question.delete", module.id, ip, {"part_id": part.id, "question_id": question.id})
    db.delete(question)
    db.commit()


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
        raise HTTPException(status_code=400, detail="Audio can only be attached to a Listening part")

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
        raise HTTPException(status_code=400, detail="Avatar video can only be attached to a Speaking part")

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
        raise HTTPException(status_code=404, detail="Audio asset not found in this module")
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
            raise HTTPException(status_code=400, detail={"message": "Module is not ready to publish", "errors": errors})
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
