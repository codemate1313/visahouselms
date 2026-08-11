from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class SEOSettingBase(BaseModel):
    site_name: str = "Language CERT Pro"
    default_title: str = "Language CERT Pro | Computer-Delivered Exam Platform & AI Feedback"
    title_template: str = "%s | Language CERT Pro"
    default_meta_description: str = "Experience authentic computer-delivered Language CERT environments with AI Speaking & Writing scoring."
    default_meta_keywords: str = "Language CERT, Language CERT Practice, AI Language CERT Evaluation, Computer Delivered Language CERT"
    default_og_image: Optional[str] = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80"
    twitter_handle: Optional[str] = "@languagecertpro"
    robots_txt: Optional[str] = "User-agent: *\nAllow: /"
    custom_head_tags: Optional[str] = None


class SEOSettingUpdate(BaseModel):
    site_name: Optional[str] = None
    default_title: Optional[str] = None
    title_template: Optional[str] = None
    default_meta_description: Optional[str] = None
    default_meta_keywords: Optional[str] = None
    default_og_image: Optional[str] = None
    twitter_handle: Optional[str] = None
    robots_txt: Optional[str] = None
    custom_head_tags: Optional[str] = None


class SEOSettingResponse(SEOSettingBase):
    id: int
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
