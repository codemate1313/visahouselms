from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class InstagramFeedItem(BaseModel):
    id: str
    media_type: str = Field(default="REEL", description="REEL, VIDEO, IMAGE, or CAROUSEL_ALBUM")
    media_url: str
    thumbnail_url: Optional[str] = None
    permalink: str
    caption: Optional[str] = None
    like_count: Optional[int] = 0
    comments_count: Optional[int] = 0
    views_count: Optional[int] = 0
    timestamp: Optional[str] = None


class InstagramPublicFeedResponse(BaseModel):
    is_enabled: bool
    username: str
    items: List[InstagramFeedItem] = []


class InstagramSettingsAdminResponse(BaseModel):
    id: int
    is_enabled: bool
    access_token_masked: Optional[str] = None
    has_access_token: bool = False
    instagram_account_id: Optional[str] = None
    username: str
    fetch_limit: int
    feed_items: List[InstagramFeedItem] = []
    last_fetched_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class InstagramSettingsUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    access_token: Optional[str] = None
    instagram_account_id: Optional[str] = None
    username: Optional[str] = None
    fetch_limit: Optional[int] = Field(default=None, ge=1, le=20)


class InstagramTestConnectionResponse(BaseModel):
    success: bool
    message: str
    account_id: Optional[str] = None
    media_count: Optional[int] = None
