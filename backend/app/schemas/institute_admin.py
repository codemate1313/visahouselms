from datetime import date
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.models.role import INST_INSTRUCTOR, STUDENT


class AccessWindow(BaseModel):
    """The dates an institute admin types. Deliberately dates, not datetimes -
    the admin thinks in calendar days and the service resolves them to instants
    in the institute's own timezone."""

    access_starts_on: date
    access_ends_on: date

    @model_validator(mode="after")
    def check_order(self) -> "AccessWindow":
        if self.access_ends_on < self.access_starts_on:
            raise ValueError("The access end date cannot be before the start date")
        return self


class InstituteMemberCreate(BaseModel):
    email: EmailStr
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    role: str
    phone_number: str = Field(max_length=50)
    address: Optional[str] = Field(default=None, max_length=255)
    # Required for students, ignored for staff. No default: a defaulted window
    # is how a student outlives the subscription that paid for them.
    access_starts_on: Optional[date] = None
    access_ends_on: Optional[date] = None

    @model_validator(mode="after")
    def students_need_a_window(self) -> "InstituteMemberCreate":
        if self.role == STUDENT:
            if self.access_starts_on is None or self.access_ends_on is None:
                raise ValueError("A student needs an access start and end date")
            if self.access_ends_on < self.access_starts_on:
                raise ValueError("The access end date cannot be before the start date")
        return self

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        if value not in (INST_INSTRUCTOR, STUDENT):
            raise ValueError("Role must be INST_INSTRUCTOR or STUDENT")
        return value

    @field_validator("first_name", "last_name", "phone_number")
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
    phone_number: str = Field(max_length=50)
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

    @field_validator("phone_number")
    @classmethod
    def strip_required_phone(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value


class InstituteCheckoutRequest(BaseModel):
    coupon_code: Optional[str] = Field(default=None, max_length=50)

