from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


def _clean_text(value: str, label: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError(f"{label} cannot be blank")
    return cleaned


class InstructorAccountCreate(BaseModel):
    email: EmailStr
    first_name: str = Field(max_length=100)
    last_name: str = Field(max_length=100)
    title: str = Field(default="IELTS Instructor", max_length=120)
    bio: Optional[str] = Field(default=None, max_length=3000)
    dob: Optional[datetime] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    avatar_path: Optional[str] = None

    @field_validator("first_name", "last_name", "title")
    @classmethod
    def non_blank(cls, value: str, info) -> str:
        return _clean_text(value, info.field_name.replace("_", " ").title())

    @field_validator("bio")
    @classmethod
    def clean_bio(cls, value: Optional[str]) -> Optional[str]:
        return value.strip() or None if value is not None else None


class InstructorAccountUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = Field(default=None, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)
    title: Optional[str] = Field(default=None, max_length=120)
    bio: Optional[str] = Field(default=None, max_length=3000)
    dob: Optional[datetime] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    avatar_path: Optional[str] = None

    @field_validator("first_name", "last_name", "title")
    @classmethod
    def non_blank(cls, value: Optional[str], info) -> Optional[str]:
        return _clean_text(value, info.field_name.replace("_", " ").title()) if value is not None else None

    @field_validator("bio")
    @classmethod
    def clean_bio(cls, value: Optional[str]) -> Optional[str]:
        return value.strip() or None if value is not None else None


class InstructorAccountOut(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    is_active: bool
    force_password_reset: bool
    title: str
    bio: Optional[str]
    dob: Optional[datetime] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    avatar_path: Optional[str] = None
    created_at: datetime


class InstructorAccountCreated(InstructorAccountOut):
    temporary_password: str


class InstructorPasswordResetOut(BaseModel):
    temporary_password: str


class InstructorDashboardOut(BaseModel):
    profile_completion: int
    content: dict[str, int]
    grading: dict[str, int]
    recent_activity: list[dict]
