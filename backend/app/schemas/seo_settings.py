from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class SEOSettingBase(BaseModel):
    site_name: str = "Visa House LMS"
    default_title: str = "Visa House LMS | Computer-Delivered Exam Platform & AI Feedback"
    title_template: str = "%s | Visa House LMS"
    default_meta_description: str = "Experience authentic computer-delivered LanguageCert environments with AI Speaking & Writing scoring."
    default_meta_keywords: str = "Visa House LMS, LanguageCert Practice, AI LanguageCert Evaluation, Computer Delivered LanguageCert"
    default_og_image: Optional[str] = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80"
    twitter_handle: Optional[str] = "@visahouselms"
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
