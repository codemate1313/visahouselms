from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

HeroLocation = Literal["home", "login"]


class HeroStat(BaseModel):
    value: str = ""
    label: str = ""


class HeroSlideBase(BaseModel):
    location: HeroLocation = "home"
    badge: Optional[str] = None
    title: str
    highlight: Optional[str] = None
    subtitle: Optional[str] = None
    image_url: str
    cta_text: Optional[str] = None
    cta_link: Optional[str] = None
    alt_text: Optional[str] = None
    alt_link: Optional[str] = None
    stats: List[HeroStat] = Field(default_factory=list)
    is_active: bool = True
    display_order: int = 0


class HeroSlideCreate(HeroSlideBase):
    pass


class HeroSlideUpdate(BaseModel):
    location: Optional[HeroLocation] = None
    badge: Optional[str] = None
    title: Optional[str] = None
    highlight: Optional[str] = None
    subtitle: Optional[str] = None
    image_url: Optional[str] = None
    cta_text: Optional[str] = None
    cta_link: Optional[str] = None
    alt_text: Optional[str] = None
    alt_link: Optional[str] = None
    stats: Optional[List[HeroStat]] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class HeroSlideResponse(HeroSlideBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class HeroSlideReorderItem(BaseModel):
    id: int
    display_order: int
