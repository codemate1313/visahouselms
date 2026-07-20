from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.models.course import COURSE_STATUSES


class CourseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    summary: Optional[str] = Field(default=None, max_length=500)
    description: Optional[str] = Field(default=None, max_length=10000)
    level: str = Field(default="all_levels", max_length=30)
    estimated_duration_minutes: Optional[int] = Field(default=None, ge=1, le=100000)
    price: Decimal = Field(default=Decimal("0"), ge=0, max_digits=10, decimal_places=2)
    currency: str = Field(default="INR", min_length=3, max_length=8)
    is_featured: bool = False

    @field_validator("title", "level")
    @classmethod
    def required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("summary", "description")
    @classmethod
    def optional_text(cls, value: Optional[str]) -> Optional[str]:
        return value.strip() or None if value is not None else None


class CourseUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    summary: Optional[str] = Field(default=None, max_length=500)
    description: Optional[str] = Field(default=None, max_length=10000)
    level: Optional[str] = Field(default=None, max_length=30)
    estimated_duration_minutes: Optional[int] = Field(default=None, ge=1, le=100000)
    price: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    currency: Optional[str] = Field(default=None, min_length=3, max_length=8)
    is_featured: Optional[bool] = None

    @field_validator("title", "level")
    @classmethod
    def required_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: Optional[str]) -> Optional[str]:
        return value.strip().upper() if value is not None else None

    @field_validator("summary", "description")
    @classmethod
    def optional_text(cls, value: Optional[str]) -> Optional[str]:
        return value.strip() or None if value is not None else None


class CourseStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: str) -> str:
        if value not in COURSE_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(COURSE_STATUSES)}")
        return value


class AssetUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class AssetReorder(BaseModel):
    asset_ids: list[int] = Field(min_length=1)


class CourseAssignmentRequest(BaseModel):
    institute_id: int = Field(gt=0)
