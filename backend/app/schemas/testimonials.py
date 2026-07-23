from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class TestimonialBase(BaseModel):
    student_name: str
    student_role: Optional[str] = "Academic IELTS Student"
    target_score: Optional[str] = "Band 7.5+"
    avatar_url: Optional[str] = None
    rating: int = 5
    quote: str
    is_active: bool = True
    display_order: int = 0


class TestimonialCreate(TestimonialBase):
    pass


class TestimonialUpdate(BaseModel):
    student_name: Optional[str] = None
    student_role: Optional[str] = None
    target_score: Optional[str] = None
    avatar_url: Optional[str] = None
    rating: Optional[int] = None
    quote: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class TestimonialResponse(TestimonialBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
