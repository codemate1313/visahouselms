from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.avatar_gateway import AvatarGenerationError, AvatarNotConfigured, get_provider
from app.models.user import User
from app.services import module_authoring_service
from app.services.settings_service import get_settings_group, set_settings_group

DEFAULT_VOICE_ID = "en-GB-SoniaNeural"


def get_config(db: Session) -> dict:
    return get_settings_group(db, "avatar")


def update_config(db: Session, values: dict) -> dict:
    set_settings_group(db, "avatar", values)
    return get_config(db)


def _provider(db: Session):
    cfg = get_settings_group(db, "avatar", mask_secrets=False)
    api_key = cfg.get("api_key")
    presenter_image_url = cfg.get("presenter_image_url")
    if not api_key or not presenter_image_url:
        raise HTTPException(
            status_code=409,
            detail="Avatar provider is not configured yet - add a D-ID API key and presenter image in Developer Settings",
        )
    return get_provider(api_key, presenter_image_url, cfg.get("voice_id") or DEFAULT_VOICE_ID)


def test_connection(db: Session) -> dict:
    try:
        provider = _provider(db)
        return {"connected": provider.verify_credentials()}
    except AvatarNotConfigured as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except AvatarGenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


def validate_part_for_generation(db: Session, actor: User, module_id: int, part_id: int) -> str:
    """Cheap, synchronous checks so the instructor gets immediate feedback
    before the (slow) job is enqueued. Returns the script text to narrate."""
    module, part = module_authoring_service.get_editable_part(db, actor, module_id, part_id)
    if part.section_type != "speaking":
        raise HTTPException(status_code=400, detail="Avatar video is only available for Speaking parts")
    script_text = module_authoring_service.speaking_script(part)
    if not script_text.strip():
        raise HTTPException(
            status_code=400, detail="Add at least one speaking prompt question before generating an avatar video"
        )
    return script_text


def generate_for_part(db: Session, actor: User, module_id: int, part_id: int, ip: Optional[str]) -> dict:
    """Runs the (slow) vendor call and persists the resulting clip. Intended
    to run inside the background job worker, not an HTTP request."""
    script_text = validate_part_for_generation(db, actor, module_id, part_id)
    provider = _provider(db)
    clip = provider.generate(script_text)
    _, part = module_authoring_service.get_editable_part(db, actor, module_id, part_id)
    return module_authoring_service.add_avatar_asset(
        db,
        actor,
        module_id,
        part_id,
        content=clip.content,
        title=f"{part.title} - Avatar presenter",
        script_text=script_text,
        ip=ip,
    )
