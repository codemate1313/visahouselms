from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.core.uploads import read_compressed_profile_image, read_validated_mp3
from app.database import get_db
from app.dependencies.auth import get_current_user, require_password_change_complete, require_role
from app.models.exam_module import MODULE_STATUSES, MODULE_TYPES
from app.models.role import SA_INSTRUCTOR
from app.models.user import User
from app.schemas.assessment import QuestionCreate
from app.schemas.exam_module import (
    ModuleCreate,
    ModuleQuestionBatchCreate,
    ModuleStatusUpdate,
    ModuleUpdate,
    PartAiEvaluationUpdate,
    SpeakingPartTimingUpdate,
    TTSCreate,
)
from app.services import (
    avatar_service,
    job_service,
    module_authoring_service,
    module_blueprint_service,
    question_import_service,
    tts_service,
)


router = APIRouter(
    prefix="/instructor/modules",
    tags=["module-authoring"],
    dependencies=[
        Depends(require_role(SA_INSTRUCTOR)),
        Depends(require_password_change_complete),
    ],
)


def _ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.get("/blueprints")
def list_blueprints():
    return module_blueprint_service.list_blueprints()


@router.get("/tts-voices")
def list_tts_voices():
    return tts_service.TTS_VOICES


@router.get("")
def list_modules(
    search: Optional[str] = Query(default=None, max_length=200),
    module_type: Optional[str] = None,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    if module_type and module_type not in MODULE_TYPES:
        return []
    if status_filter and status_filter not in MODULE_STATUSES:
        return []
    return module_authoring_service.list_modules(db, actor, search, module_type, status_filter)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_module(
    payload: ModuleCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return module_authoring_service.create_module(db, actor, payload.model_dump(), _ip(request))


@router.get("/{module_id}")
def get_module(
    module_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    module = module_authoring_service.get_module_or_404(db, module_id)
    if module.created_by_id != actor.id:
        # Instructor content remains private to its author at this phase.
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This module belongs to another instructor")
    return module_authoring_service.serialize_module(module, detailed=True)


@router.patch("/{module_id}")
def update_module(
    module_id: int,
    payload: ModuleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return module_authoring_service.update_module(
        db,
        actor,
        module_id,
        payload.model_dump(),
        set(payload.model_fields_set),
        _ip(request),
    )


@router.patch("/{module_id}/parts/{part_id}/speaking-timing")
def update_speaking_part_timing(
    module_id: int,
    part_id: int,
    payload: SpeakingPartTimingUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return module_authoring_service.update_speaking_part_timing(
        db,
        actor,
        module_id,
        part_id,
        payload.preparation_seconds,
        payload.response_seconds,
        _ip(request),
    )


@router.patch("/{module_id}/parts/{part_id}/ai-evaluation")
def update_part_ai_evaluation(
    module_id: int,
    part_id: int,
    payload: PartAiEvaluationUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return module_authoring_service.update_part_ai_evaluation(
        db,
        actor,
        module_id,
        part_id,
        payload.ai_evaluation_enabled,
        _ip(request),
    )


@router.post("/{module_id}/status")
def set_module_status(
    module_id: int,
    payload: ModuleStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return module_authoring_service.set_status(db, actor, module_id, payload.status, _ip(request))


@router.delete("/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_module(
    module_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    module_authoring_service.delete_module(db, actor, module_id, _ip(request))


@router.post("/{module_id}/parts/{part_id}/questions", status_code=status.HTTP_201_CREATED)
def add_question(
    module_id: int,
    part_id: int,
    payload: QuestionCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return module_authoring_service.add_question(
        db, actor, module_id, part_id, payload.model_dump(), _ip(request)
    )


@router.put("/{module_id}/parts/{part_id}/questions/{question_id}")
def update_question(
    module_id: int,
    part_id: int,
    question_id: int,
    payload: QuestionCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return module_authoring_service.update_question(
        db, actor, module_id, part_id, question_id, payload.model_dump(), _ip(request)
    )


@router.delete("/{module_id}/parts/{part_id}/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(
    module_id: int,
    part_id: int,
    question_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    module_authoring_service.delete_question(
        db, actor, module_id, part_id, question_id, _ip(request)
    )


@router.post("/{module_id}/parts/{part_id}/import-preview")
async def preview_import(
    module_id: int,
    part_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    module_authoring_service.get_editable_part(db, actor, module_id, part_id)
    return await question_import_service.preview_upload(file)


@router.post("/{module_id}/parts/{part_id}/import", status_code=status.HTTP_201_CREATED)
def commit_import(
    module_id: int,
    part_id: int,
    payload: ModuleQuestionBatchCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return module_authoring_service.import_questions(
        db,
        actor,
        module_id,
        part_id,
        [question.model_dump() for question in payload.questions],
        payload.source_type,
        payload.source_filename,
        _ip(request),
    )


@router.post("/{module_id}/parts/{part_id}/audio", status_code=status.HTTP_201_CREATED)
async def upload_audio(
    module_id: int,
    part_id: int,
    request: Request,
    title: str = Form(..., min_length=1, max_length=200),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    # Validate the module/part before reading a potentially large upload.
    module_authoring_service.get_editable_part(db, actor, module_id, part_id)
    content = await read_validated_mp3(file)
    return module_authoring_service.add_audio_asset(
        db,
        actor,
        module_id,
        part_id,
        content=content,
        title=title,
        original_filename=file.filename or "listening-audio.mp3",
        asset_type="mp3",
        transcript=None,
        voice=None,
        ip=_ip(request),
    )


@router.post("/{module_id}/parts/{part_id}/question-image", status_code=status.HTTP_201_CREATED)
async def upload_question_image(
    module_id: int,
    part_id: int,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    # Validate the module/part before reading a potentially large upload.
    module_authoring_service.get_editable_part(db, actor, module_id, part_id)
    _, content = await read_compressed_profile_image(
        file, label="Question image", max_dimension=2000, quality=85
    )
    return module_authoring_service.save_question_image(
        db, actor, module_id, part_id, content=content, ip=_ip(request)
    )


@router.post("/{module_id}/parts/{part_id}/tts", status_code=status.HTTP_201_CREATED)
def save_browser_narration(
    module_id: int,
    part_id: int,
    payload: TTSCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    _, part = module_authoring_service.get_editable_part(db, actor, module_id, part_id)
    if part.section_type != "listening":
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Text-to-speech is available only for Listening parts")
    return module_authoring_service.add_tts_text_asset(
        db,
        actor,
        module_id,
        part_id,
        title=payload.title,
        transcript=payload.conversation,
        voice=payload.voice,
        rate=payload.rate,
        ip=_ip(request),
    )


@router.post("/{module_id}/parts/{part_id}/avatar", status_code=status.HTTP_202_ACCEPTED)
def generate_avatar(
    module_id: int,
    part_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    # Fail fast on obvious problems (wrong section, no prompts, not the
    # owner, module not draft) before enqueuing the slow vendor call.
    avatar_service.validate_part_for_generation(db, actor, module_id, part_id)
    job = job_service.enqueue(
        db,
        "generate_avatar",
        {"module_id": module_id, "part_id": part_id, "actor_id": actor.id, "ip": _ip(request)},
    )
    return {"job_id": job.id, "status": job.status}


@router.get("/jobs/{job_id}")
def avatar_job_status(job_id: int, db: Session = Depends(get_db), actor: User = Depends(get_current_user)):
    job = job_service.get_job(db, job_id)
    if job is None or (job.payload or {}).get("actor_id") != actor.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return {
        "id": job.id,
        "type": job.type,
        "status": job.status,
        "result": job.result,
        "created_at": job.created_at,
        "started_at": job.started_at,
        "finished_at": job.finished_at,
    }


@router.delete("/{module_id}/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_audio(
    module_id: int,
    asset_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    module_authoring_service.delete_asset(db, actor, module_id, asset_id, _ip(request))
