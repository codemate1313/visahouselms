from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_super_admin_or_verified_developer
from app.models.audit_log import AuditLog
from app.models.hero_slide import HERO_LOCATIONS, HeroSlide
from app.models.user import User
from app.schemas.hero_slide import (
    HeroSlideCreate,
    HeroSlideReorderItem,
    HeroSlideResponse,
    HeroSlideUpdate,
)

public_router = APIRouter(prefix="/hero-slides", tags=["hero-slides"])
admin_router = APIRouter(
    prefix="/super-admin/hero-slides",
    tags=["admin-hero-slides"],
    dependencies=[Depends(require_super_admin_or_verified_developer)],
)


# Seeded on first read so a fresh database renders exactly what the hardcoded
# frontend arrays used to render, and Super Admin has something to edit.
DEFAULT_SLIDES: List[dict] = [
    {
        "location": "home",
        "badge": "Designed for Students · Self-Paced Practice",
        "title": "Practice Smarter with\nFull-Length Mock Tests",
        "highlight": " & Instant Scoring.",
        "subtitle": "Practise timed mock tests across all 4 skills with instant scoring, answer explanations, and personal progress tracking.",
        "image_url": "/images/hero_slide_1.png",
        "cta_text": "Start Practising Free",
        "cta_link": "/register",
        "alt_text": "View Student Plans →",
        "alt_link": "/plans",
        "stats": [
            {"value": "4 Skills", "label": "All Exam Modules"},
            {"value": "Instant", "label": "AI Score & Feedback"},
            {"value": "Full Mock", "label": "Real Exam Simulations"},
        ],
        "display_order": 0,
    },
    {
        "location": "home",
        "badge": "Interactive AI Practice · Real Audio",
        "title": "Prepare Smarter with Avatar Speaking\n& Real Exam Audio",
        "highlight": " for Success.",
        "subtitle": "Authentic listening audio and interactive Avatar speaking tests with instant AI evaluations to build exam confidence.",
        "image_url": "/images/hero_slide_2.png",
        "cta_text": "Explore Features",
        "cta_link": "#features",
        "alt_text": "See How It Works →",
        "alt_link": "#steps",
        "stats": [
            {"value": "10+", "label": "Years Experience"},
            {"value": "1,000+", "label": "Students Prepped"},
            {"value": "24/7", "label": "On-Demand Access"},
        ],
        "display_order": 1,
    },
    {
        "location": "home",
        "badge": "For Institutes & Language Schools",
        "title": "Scale Your Institute with\nAdvanced Analytics",
        "highlight": " & Cohort Tools.",
        "subtitle": "Manage cohorts, assign CEFR-aligned question banks, and track student growth in real time.",
        "image_url": "/images/hero_slide_3.png",
        "cta_text": "Book an Institute Demo",
        "cta_link": "/contact?tab=partner",
        "alt_text": "Partner with Visa House →",
        "alt_link": "/contact?tab=partner",
        "stats": [
            {"value": "CEFR", "label": "Aligned Question Banks"},
            {"value": "Real-Time", "label": "Student Diagnostics"},
            {"value": "Enterprise", "label": "Cohort Management"},
        ],
        "display_order": 2,
    },
    {
        "location": "login",
        "badge": "LanguageCert PLATFORM",
        "title": "AI-Powered Speaking & Writing Evaluation",
        "subtitle": "Empowering institutes and students with real-time LanguageCert scoring, automated grading, and comprehensive analytics.",
        "image_url": "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop",
        "cta_text": None,
        "cta_link": None,
        "display_order": 1,
    },
    {
        "id": 2,
        "location": "home",
        "badge": "REAL-TIME SIMULATION",
        "title": "Interactive Practice & AI Mock Tests",
        "subtitle": "Deliver authentic computer-delivered LanguageCert exam environments with live speaking evaluation and instant feedback.",
        "image_url": "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1200&auto=format&fit=crop",
        "stats": [],
        "display_order": 1,
    },
    {
        "location": "login",
        "badge": "GLOBAL LEARNING HUB",
        "title": "Seamless Student & Instructor Portals",
        "subtitle": "Track candidate progress, manage subscriptions, and deliver world-class learning modules across your branch network.",
        "image_url": "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=1200&auto=format&fit=crop",
        "stats": [],
        "display_order": 2,
    },
]


def _defaults_for(location: Optional[str]) -> List[dict]:
    if location is None:
        return DEFAULT_SLIDES
    return [slide for slide in DEFAULT_SLIDES if slide["location"] == location]


def _seed_missing_locations(db: Session) -> None:
    """Create the default slides for any location that has none yet."""
    existing = set(db.scalars(select(HeroSlide.location).distinct()).all())
    missing = [loc for loc in HERO_LOCATIONS if loc not in existing]
    if not missing:
        return
    for slide in DEFAULT_SLIDES:
        if slide["location"] in missing:
            db.add(HeroSlide(**slide))
    db.commit()


def _query(db: Session, location: Optional[str], active_only: bool) -> List[HeroSlide]:
    stmt = select(HeroSlide)
    if location:
        stmt = stmt.where(HeroSlide.location == location)
    if active_only:
        stmt = stmt.where(HeroSlide.is_active.is_(True))
    stmt = stmt.order_by(HeroSlide.display_order.asc(), HeroSlide.id.asc())
    return list(db.scalars(stmt).all())


def _validate_location(location: str) -> None:
    if location not in HERO_LOCATIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Location must be one of: {', '.join(HERO_LOCATIONS)}",
        )


def _get_or_404(db: Session, slide_id: int) -> HeroSlide:
    slide = db.get(HeroSlide, slide_id)
    if slide is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hero slide not found")
    return slide


def _audit(db: Session, actor: User, action: str, request: Request, entity_id=None, details=None) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            action=action,
            entity_type="hero_slide",
            entity_id=entity_id,
            details=details,
            ip_address=request.client.host if request.client else None,
        )
    )
    db.commit()


@public_router.get("", response_model=List[HeroSlideResponse])
def get_public_hero_slides(
    location: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    if location:
        _validate_location(location)
    _seed_missing_locations(db)
    slides = _query(db, location, active_only=True)
    if slides:
        return slides
    # Every slide for this location was disabled - fall back to the defaults so
    # visitors never land on an empty hero.
    return [{"id": 0, **slide} for slide in _defaults_for(location)]


@admin_router.get("", response_model=List[HeroSlideResponse])
def list_hero_slides_admin(
    location: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    if location:
        _validate_location(location)
    _seed_missing_locations(db)
    return _query(db, location, active_only=False)


@admin_router.put("/reorder", response_model=List[HeroSlideResponse])
def reorder_hero_slides_admin(
    items: List[HeroSlideReorderItem],
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    for item in items:
        slide = db.get(HeroSlide, item.id)
        if slide:
            slide.display_order = item.display_order
    db.commit()
    _audit(db, actor, "hero_slide.reorder", request, details={"count": len(items)})
    return _query(db, None, active_only=False)


@admin_router.post("/reset", response_model=List[HeroSlideResponse])
def reset_hero_slides_admin(
    request: Request,
    location: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    """Delete the slides for a location and recreate the shipped defaults."""
    if location:
        _validate_location(location)
    for slide in _query(db, location, active_only=False):
        db.delete(slide)
    db.commit()
    for slide in _defaults_for(location):
        db.add(HeroSlide(**slide))
    db.commit()
    _audit(db, actor, "hero_slide.reset", request, details={"location": location or "all"})
    return _query(db, location, active_only=False)


@admin_router.post("", response_model=HeroSlideResponse, status_code=status.HTTP_201_CREATED)
def create_hero_slide_admin(
    payload: HeroSlideCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    data = payload.model_dump()
    data["stats"] = data.get("stats") or []
    slide = HeroSlide(**data)
    db.add(slide)
    db.commit()
    db.refresh(slide)
    _audit(
        db, actor, "hero_slide.create", request, entity_id=slide.id,
        details={"location": slide.location, "title": slide.title},
    )
    return slide


@admin_router.put("/{slide_id}", response_model=HeroSlideResponse)
def update_hero_slide_admin(
    slide_id: int,
    payload: HeroSlideUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    slide = _get_or_404(db, slide_id)
    update_data = payload.model_dump(exclude_unset=True)
    if "location" in update_data and update_data["location"]:
        _validate_location(update_data["location"])
    for key, val in update_data.items():
        setattr(slide, key, val)
    db.commit()
    db.refresh(slide)
    _audit(db, actor, "hero_slide.update", request, entity_id=slide.id, details=update_data)
    return slide


@admin_router.delete("/{slide_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hero_slide_admin(
    slide_id: int,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    slide = _get_or_404(db, slide_id)
    _audit(
        db, actor, "hero_slide.delete", request, entity_id=slide.id,
        details={"location": slide.location, "title": slide.title},
    )
    db.delete(slide)
    db.commit()
    return None
