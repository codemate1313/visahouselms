from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_role
from app.models.role import SUPER_ADMIN
from app.models.seo_settings import SEOSetting
from app.schemas.seo_settings import SEOSettingResponse, SEOSettingUpdate

public_router = APIRouter(prefix="/seo-settings", tags=["seo-settings"])
admin_router = APIRouter(
    prefix="/super-admin/seo-settings",
    tags=["admin-seo-settings"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


def _get_or_create_seo_settings(db: Session) -> SEOSetting:
    setting = db.scalar(select(SEOSetting).limit(1))
    if not setting:
        setting = SEOSetting(
            site_name="IELTS LMS Pro",
            default_title="IELTS LMS Pro | Computer-Delivered Exam Platform & AI Feedback",
            title_template="%s | IELTS LMS Pro",
            default_meta_description="Experience authentic computer-delivered IELTS environments with AI Speaking & Writing scoring.",
            default_meta_keywords="IELTS LMS, IELTS Practice, AI IELTS Evaluation, Computer Delivered IELTS",
            default_og_image="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80",
            twitter_handle="@ieltslmspro",
            robots_txt="User-agent: *\nAllow: /",
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


@public_router.get("", response_model=SEOSettingResponse)
def get_public_seo_settings(db: Session = Depends(get_db)):
    return _get_or_create_seo_settings(db)


@admin_router.get("", response_model=SEOSettingResponse)
def get_admin_seo_settings(db: Session = Depends(get_db)):
    return _get_or_create_seo_settings(db)


@admin_router.put("", response_model=SEOSettingResponse)
def update_admin_seo_settings(payload: SEOSettingUpdate, db: Session = Depends(get_db)):
    setting = _get_or_create_seo_settings(db)
    update_data = payload.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(setting, key, val)
    db.commit()
    db.refresh(setting)
    return setting
