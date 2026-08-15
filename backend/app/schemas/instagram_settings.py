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


class InstagramAddUrlItemRequest(BaseModel):
    url: str = Field(..., description="Full Instagram Reel, Post or TV URL (e.g. https://www.instagram.com/reel/C8vZ_abc123/)")
    media_type: Optional[str] = Field(default=None, description="REEL, VIDEO, IMAGE, or POST")
    thumbnail_url: Optional[str] = Field(default=None, description="Direct URL of the video thumbnail or cover image")
    caption: Optional[str] = Field(default=None, description="Caption, title or description of the reel")
    like_count: Optional[int] = Field(default=1200, ge=0)
    views_count: Optional[int] = Field(default=15000, ge=0)
    comments_count: Optional[int] = Field(default=45, ge=0)


class InstagramUpdateFeedItemRequest(BaseModel):
    media_type: Optional[str] = None
    permalink: Optional[str] = None
    thumbnail_url: Optional[str] = None
    media_url: Optional[str] = None
    caption: Optional[str] = None
    like_count: Optional[int] = Field(default=None, ge=0)
    views_count: Optional[int] = Field(default=None, ge=0)
    comments_count: Optional[int] = Field(default=None, ge=0)


