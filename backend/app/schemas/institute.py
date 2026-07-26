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
    session_duration_hours: int = Field(default=24, ge=1, le=720)
    ai_monthly_limit: Optional[int] = Field(default=None, ge=0, le=100000)
    agreement_reference: Optional[str] = Field(default=None, max_length=100)
    agreement_notes: Optional[str] = Field(default=None, max_length=2000)
    agreed_amount: Optional[float] = Field(default=None, ge=0)
    amount_received: Optional[float] = Field(default=None, ge=0)
    currency: Optional[str] = Field(default="INR", min_length=3, max_length=8)
    payment_method_id: Optional[int] = None
    payment_reference: Optional[str] = Field(default=None, max_length=500)
    student_limit: Optional[int] = Field(default=None, ge=0)
    staff_limit: Optional[int] = Field(default=None, ge=0)
    access_duration_days: Optional[int] = Field(default=None, gt=0)
    module_ids: Optional[list[int]] = Field(default_factory=list)
    primary_color: Optional[str] = "#e53935"
    secondary_color: Optional[str] = "#17191d"


class InstituteUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    contact_email: Optional[EmailStr] = None
    admin_permissions: Optional[InstitutePermissions] = None
    session_duration_hours: Optional[int] = Field(default=None, ge=1, le=720)
    ai_monthly_limit: Optional[int] = Field(default=None, ge=0, le=100000)
    agreement_reference: Optional[str] = Field(default=None, max_length=100)
    agreement_notes: Optional[str] = Field(default=None, max_length=2000)
    agreed_amount: Optional[float] = Field(default=None, ge=0)
    amount_received: Optional[float] = Field(default=None, ge=0)
    currency: Optional[str] = Field(default=None, min_length=3, max_length=8)
    payment_method_id: Optional[int] = None
    payment_reference: Optional[str] = Field(default=None, max_length=500)
    student_limit: Optional[int] = Field(default=None, ge=0)
    staff_limit: Optional[int] = Field(default=None, ge=0)
    access_duration_days: Optional[int] = Field(default=None, gt=0)
    module_ids: Optional[list[int]] = None
    onboarding_status: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None


class BrandingUpdate(BaseModel):
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    font_family: Optional[str] = None
    heading_font_weight: Optional[int] = None
    body_font_weight: Optional[int] = None
