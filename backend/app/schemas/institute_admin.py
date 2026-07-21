from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.role import INST_INSTRUCTOR, STUDENT


class InstituteMemberCreate(BaseModel):
    email: EmailStr
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    role: str
    phone_number: Optional[str] = Field(default=None, max_length=50)
    address: Optional[str] = Field(default=None, max_length=255)

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        if value not in (INST_INSTRUCTOR, STUDENT):
            raise ValueError("Role must be INST_INSTRUCTOR or STUDENT")
        return value

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value


class InstituteMemberUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    phone_number: Optional[str] = Field(default=None, max_length=50)
    address: Optional[str] = Field(default=None, max_length=255)

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value


class InstituteCheckoutRequest(BaseModel):
    coupon_code: Optional[str] = Field(default=None, max_length=50)

