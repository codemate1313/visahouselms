from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class InstituteCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    contact_email: Optional[EmailStr] = None
    admin_email: EmailStr
    admin_first_name: str = Field(min_length=1, max_length=100)
    admin_last_name: str = Field(min_length=1, max_length=100)


class InstituteUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    contact_email: Optional[EmailStr] = None


class BrandingUpdate(BaseModel):
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
