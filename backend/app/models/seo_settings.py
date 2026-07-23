from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SEOSetting(Base):
    __tablename__ = "seo_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    site_name: Mapped[str] = mapped_column(String(255), default="IELTS LMS Pro")
    default_title: Mapped[str] = mapped_column(String(255), default="IELTS LMS Pro | Computer-Delivered Exam Platform & AI Feedback")
    title_template: Mapped[str] = mapped_column(String(255), default="%s | IELTS LMS Pro")
    default_meta_description: Mapped[str] = mapped_column(Text, default="Experience authentic computer-delivered IELTS environments. Powered by instant AI Speaking evaluation, automated Writing feedback, and real-time institute tracking.")
    default_meta_keywords: Mapped[str] = mapped_column(Text, default="IELTS LMS, IELTS Online Practice, AI IELTS Evaluation, Computer Delivered IELTS, IELTS Mock Test, IELTS Preparation Platform")
    default_og_image: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, default="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80")
    twitter_handle: Mapped[Optional[str]] = mapped_column(String(100), default="@ieltslmspro")
    robots_txt: Mapped[Optional[str]] = mapped_column(Text, default="User-agent: *\nAllow: /")
    custom_head_tags: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
