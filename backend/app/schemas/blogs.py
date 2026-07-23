from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class BlogPostBase(BaseModel):
    title: str
    slug: str
    summary: str
    content_markdown: str
    featured_image_url: Optional[str] = None
    category: str = "IELTS Tips"
    tags: Optional[str] = "IELTS, Preparation"
    author_name: str = "IELTS LMS Editorial Team"
    read_time_minutes: int = 5
    is_published: bool = True
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None


class BlogPostCreate(BlogPostBase):
    pass


class BlogPostUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    summary: Optional[str] = None
    content_markdown: Optional[str] = None
    featured_image_url: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[str] = None
    author_name: Optional[str] = None
    read_time_minutes: Optional[int] = None
    is_published: Optional[bool] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None


class BlogPostResponse(BlogPostBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
