from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.schemas.institute import InstitutePermissions


class InstituteOnboardingCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    contact_email: Optional[EmailStr] = None
    admin_email: EmailStr
    admin_first_name: str = Field(min_length=1, max_length=100)
    admin_last_name: str = Field(min_length=1, max_length=100)
    admin_permissions: InstitutePermissions = Field(default_factory=InstitutePermissions)
    agreement_reference: Optional[str] = Field(default=None, max_length=100)
    agreement_notes: Optional[str] = Field(default=None, max_length=2000)
    agreed_amount: float = Field(gt=0)
    amount_received: float = Field(gt=0)
    currency: str = Field(default="INR", min_length=3, max_length=8)
    payment_method_id: Optional[int] = None
    payment_reference: Optional[str] = Field(default=None, max_length=500)
    student_limit: int = Field(ge=0)
    staff_limit: int = Field(ge=0)
    access_duration_days: int = Field(gt=0)
    primary_color: str = "#e53935"
    secondary_color: str = "#17191d"
    module_ids: list[int] = Field(default_factory=list)
