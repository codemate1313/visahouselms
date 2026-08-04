from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class InstituteSignupCreate(BaseModel):
    """A public application to run an institute. Unauthenticated, so every
    field is length-bounded and nothing here grants anything by itself."""

    institute_name: str = Field(min_length=2, max_length=255)
    contact_email: EmailStr
    contact_phone: Optional[str] = Field(default=None, max_length=40)
    city: Optional[str] = Field(default=None, max_length=120)
    country: Optional[str] = Field(default=None, max_length=120)
    website: Optional[str] = Field(default=None, max_length=255)

    admin_first_name: str = Field(min_length=1, max_length=100)
    admin_last_name: str = Field(min_length=1, max_length=100)
    admin_email: EmailStr

    expected_students: Optional[int] = Field(default=None, ge=0, le=1_000_000)
    message: Optional[str] = Field(default=None, max_length=2000)
    # Which tier they were looking at. Context for the reviewer, never binding.
    interested_plan_id: Optional[int] = None


class InstituteSignupReject(BaseModel):
    """The reason is required: it is emailed to the applicant verbatim and kept
    on the record, so a later appeal is answerable."""

    reason: str = Field(min_length=3, max_length=1000)
