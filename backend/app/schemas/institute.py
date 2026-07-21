from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class InstitutePermissions(BaseModel):
    view_students: bool = False
    manage_students: bool = False
    view_student_activity: bool = False
    manage_student_sessions: bool = False
    manage_staff: bool = False
    view_billing: bool = False


class InstituteCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    contact_email: Optional[EmailStr] = None
    admin_email: EmailStr
    admin_first_name: str = Field(min_length=1, max_length=100)
    admin_last_name: str = Field(min_length=1, max_length=100)
    admin_permissions: InstitutePermissions = Field(default_factory=InstitutePermissions)


class InstituteUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    contact_email: Optional[EmailStr] = None
    admin_permissions: Optional[InstitutePermissions] = None


class BrandingUpdate(BaseModel):
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
