import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_super_admin_or_verified_developer
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.instagram_settings import (
    InstagramAddUrlItemRequest,
    InstagramPublicFeedResponse,
    InstagramSettingsAdminResponse,
    InstagramSettingsUpdate,
    InstagramTestConnectionResponse,
    InstagramUpdateFeedItemRequest,
)
from app.services import account_service, instagram_service

logger = logging.getLogger(__name__)

public_router = APIRouter(prefix="/instagram", tags=["instagram"])
admin_router = APIRouter(
    prefix="/super-admin/instagram-settings",
    tags=["admin-instagram-settings"],
    dependencies=[Depends(require_super_admin_or_verified_developer)],
)


@admin_router.post("/upload-cover")
async def upload_instagram_cover(
    file: UploadFile = File(...),
):
    """Upload custom thumbnail/cover image for an Instagram reel/post."""
    return await account_service.save_temp_avatar(file)


def _audit(
    db: Session,
    actor: Optional[User],
    action: str,
    request: Request,
    entity_id: Optional[int] = None,
    details: Optional[dict] = None,
) -> None:
    try:
        ip = request.client.host if request.client else "unknown"
        actor_id = actor.id if actor else None
        db.add(
            AuditLog(
                user_id=actor_id,
                action=action,
                entity_type="instagram_settings",
                entity_id=entity_id,
                ip_address=ip,
                details=details or {},
            )
        )
        db.commit()
    except Exception as exc:
        logger.warning("Failed to record audit log for %s: %s", action, exc)


@public_router.get("/feed", response_model=InstagramPublicFeedResponse)
def get_public_instagram_feed(db: Session = Depends(get_db)):
    setting = instagram_service.get_or_create_instagram_settings(db)
    if not setting.is_enabled:
        return InstagramPublicFeedResponse(is_enabled=False, username=setting.username, items=[])

    items = instagram_service.parse_feed_items(setting.feed_data_json)
    # Apply limit
    limit = max(1, min(setting.fetch_limit, 20))
    return InstagramPublicFeedResponse(
        is_enabled=True,
        username=setting.username,
        items=items[:limit],
    )


@admin_router.get("", response_model=InstagramSettingsAdminResponse)
def get_admin_instagram_settings(db: Session = Depends(get_db)):
    setting = instagram_service.get_or_create_instagram_settings(db)
    items = instagram_service.parse_feed_items(setting.feed_data_json)
    return InstagramSettingsAdminResponse(
        id=setting.id,
        is_enabled=setting.is_enabled,
        access_token_masked=instagram_service.mask_token(setting.access_token),
        has_access_token=bool(setting.access_token and setting.access_token.strip()),
        instagram_account_id=setting.instagram_account_id,
        username=setting.username,
        fetch_limit=setting.fetch_limit,
        feed_items=items,
        last_fetched_at=setting.last_fetched_at,
        updated_at=setting.updated_at,
    )


@admin_router.put("", response_model=InstagramSettingsAdminResponse)
def update_admin_instagram_settings(
    payload: InstagramSettingsUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_super_admin_or_verified_developer),
):
    setting = instagram_service.get_or_create_instagram_settings(db)

    update_dict = {}
    if payload.is_enabled is not None:
        setting.is_enabled = payload.is_enabled
        update_dict["is_enabled"] = payload.is_enabled

    if payload.username is not None and payload.username.strip():
        clean_user = payload.username.strip().lstrip("@")
        setting.username = clean_user
        update_dict["username"] = clean_user

    if payload.fetch_limit is not None:
        setting.fetch_limit = max(1, min(payload.fetch_limit, 20))
        update_dict["fetch_limit"] = setting.fetch_limit

    if payload.instagram_account_id is not None:
        setting.instagram_account_id = payload.instagram_account_id.strip() or None
        update_dict["instagram_account_id"] = setting.instagram_account_id

    # If access token is provided (not empty string / not masked placeholder)
    if payload.access_token is not None:
        token_val = payload.access_token.strip()
        if token_val and not token_val.startswith("****"):
            setting.access_token = token_val
            update_dict["access_token_updated"] = True
        elif token_val == "":
            setting.access_token = None
            update_dict["access_token_cleared"] = True

    db.commit()
    db.refresh(setting)

    _audit(db, actor, "instagram_settings.update", request, entity_id=setting.id, details=update_dict)

    items = instagram_service.parse_feed_items(setting.feed_data_json)
    return InstagramSettingsAdminResponse(
        id=setting.id,
        is_enabled=setting.is_enabled,
        access_token_masked=instagram_service.mask_token(setting.access_token),
        has_access_token=bool(setting.access_token and setting.access_token.strip()),
        instagram_account_id=setting.instagram_account_id,
        username=setting.username,
        fetch_limit=setting.fetch_limit,
        feed_items=items,
        last_fetched_at=setting.last_fetched_at,
        updated_at=setting.updated_at,
    )


@admin_router.post("/seed-samples", response_model=InstagramSettingsAdminResponse)
def seed_instagram_sample_reels(
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_super_admin_or_verified_developer),
):
    items = instagram_service.seed_sample_feed(db)
    setting = instagram_service.get_or_create_instagram_settings(db)

    _audit(db, actor, "instagram_settings.seed_samples", request, entity_id=setting.id, details={"sample_count": len(items)})

    return InstagramSettingsAdminResponse(
        id=setting.id,
        is_enabled=setting.is_enabled,
        access_token_masked=instagram_service.mask_token(setting.access_token),
        has_access_token=bool(setting.access_token and setting.access_token.strip()),
        instagram_account_id=setting.instagram_account_id,
        username=setting.username,
        fetch_limit=setting.fetch_limit,
        feed_items=items,
        last_fetched_at=setting.last_fetched_at,
        updated_at=setting.updated_at,
    )


@admin_router.post("/test-connection", response_model=InstagramTestConnectionResponse)
def test_instagram_api_connection(
    request: Request,
    payload: Optional[InstagramSettingsUpdate] = None,
    db: Session = Depends(get_db),
    actor: User = Depends(require_super_admin_or_verified_developer),
):
    setting = instagram_service.get_or_create_instagram_settings(db)
    token = payload.access_token.strip() if payload and payload.access_token and not payload.access_token.startswith("****") else setting.access_token

    if not token or not token.strip():
        return InstagramTestConnectionResponse(
            success=False,
            message="Please provide a valid Instagram Graph API Access Token first.",
        )

    success, msg, account_id, media_count = instagram_service.test_instagram_token(token)
    return InstagramTestConnectionResponse(
        success=success,
        message=msg,
        account_id=account_id,
        media_count=media_count,
    )


@admin_router.post("/refresh-feed", response_model=InstagramSettingsAdminResponse)
def refresh_instagram_feed(
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_super_admin_or_verified_developer),
):
    setting = instagram_service.get_or_create_instagram_settings(db)
    if not setting.access_token or not setting.access_token.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Instagram Access Token configured. Use 'Add Test Samples' or provide a valid Graph API token.",
        )

    success, msg, live_items = instagram_service.fetch_live_instagram_feed(setting.access_token, setting.fetch_limit)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=msg,
        )

    setting.feed_data_json = json.dumps(live_items)
    setting.last_fetched_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(setting)

    _audit(db, actor, "instagram_settings.refresh_feed", request, entity_id=setting.id, details={"count": len(live_items)})

    items = instagram_service.parse_feed_items(setting.feed_data_json)
    return InstagramSettingsAdminResponse(
        id=setting.id,
        is_enabled=setting.is_enabled,
        access_token_masked=instagram_service.mask_token(setting.access_token),
        has_access_token=bool(setting.access_token and setting.access_token.strip()),
        instagram_account_id=setting.instagram_account_id,
        username=setting.username,
        fetch_limit=setting.fetch_limit,
        feed_items=items,
        last_fetched_at=setting.last_fetched_at,
        updated_at=setting.updated_at,
    )


@admin_router.delete("/feed-items", response_model=InstagramSettingsAdminResponse)
def clear_all_instagram_feed_items(
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_super_admin_or_verified_developer),
):
    items = instagram_service.clear_feed_items(db)
    setting = instagram_service.get_or_create_instagram_settings(db)

    _audit(db, actor, "instagram_settings.clear_feed", request, entity_id=setting.id)

    return InstagramSettingsAdminResponse(
        id=setting.id,
        is_enabled=setting.is_enabled,
        access_token_masked=instagram_service.mask_token(setting.access_token),
        has_access_token=bool(setting.access_token and setting.access_token.strip()),
        instagram_account_id=setting.instagram_account_id,
        username=setting.username,
        fetch_limit=setting.fetch_limit,
        feed_items=items,
        last_fetched_at=setting.last_fetched_at,
        updated_at=setting.updated_at,
    )


@admin_router.delete("/feed-items/{item_id}", response_model=InstagramSettingsAdminResponse)
def delete_single_instagram_feed_item(
    item_id: str,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_super_admin_or_verified_developer),
):
    items = instagram_service.delete_feed_item(db, item_id)
    setting = instagram_service.get_or_create_instagram_settings(db)

    _audit(db, actor, "instagram_settings.delete_item", request, entity_id=setting.id, details={"item_id": item_id})

    return InstagramSettingsAdminResponse(
        id=setting.id,
        is_enabled=setting.is_enabled,
        access_token_masked=instagram_service.mask_token(setting.access_token),
        has_access_token=bool(setting.access_token and setting.access_token.strip()),
        instagram_account_id=setting.instagram_account_id,
        username=setting.username,
        fetch_limit=setting.fetch_limit,
        feed_items=items,
        last_fetched_at=setting.last_fetched_at,
        updated_at=setting.updated_at,
    )


@admin_router.post("/feed-items/by-url", response_model=InstagramSettingsAdminResponse)
def add_instagram_feed_item_by_url(
    payload: InstagramAddUrlItemRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_super_admin_or_verified_developer),
):
    try:
        items = instagram_service.add_item_by_url(db, payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        logger.exception("Failed to add Instagram reel by URL")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add Instagram reel: {str(exc)}",
        )

    setting = instagram_service.get_or_create_instagram_settings(db)
    _audit(
        db,
        actor,
        "instagram_settings.add_item_by_url",
        request,
        entity_id=setting.id,
        details={"url": payload.url, "caption": payload.caption},
    )

    return InstagramSettingsAdminResponse(
        id=setting.id,
        is_enabled=setting.is_enabled,
        access_token_masked=instagram_service.mask_token(setting.access_token),
        has_access_token=bool(setting.access_token and setting.access_token.strip()),
        instagram_account_id=setting.instagram_account_id,
        username=setting.username,
        fetch_limit=setting.fetch_limit,
        feed_items=items,
        last_fetched_at=setting.last_fetched_at,
        updated_at=setting.updated_at,
    )


@admin_router.put("/feed-items/{item_id}", response_model=InstagramSettingsAdminResponse)
def update_single_instagram_feed_item(
    item_id: str,
    payload: InstagramUpdateFeedItemRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_super_admin_or_verified_developer),
):
    try:
        items = instagram_service.update_feed_item(db, item_id, payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except Exception as exc:
        logger.exception("Failed to update Instagram feed item")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update feed item: {str(exc)}",
        )

    setting = instagram_service.get_or_create_instagram_settings(db)
    _audit(
        db,
        actor,
        "instagram_settings.update_item",
        request,
        entity_id=setting.id,
        details={"item_id": item_id, "caption": payload.caption},
    )

    return InstagramSettingsAdminResponse(
        id=setting.id,
        is_enabled=setting.is_enabled,
        access_token_masked=instagram_service.mask_token(setting.access_token),
        has_access_token=bool(setting.access_token and setting.access_token.strip()),
        instagram_account_id=setting.instagram_account_id,
        username=setting.username,
        fetch_limit=setting.fetch_limit,
        feed_items=items,
        last_fetched_at=setting.last_fetched_at,
        updated_at=setting.updated_at,
    )



