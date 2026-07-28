from typing import Optional

from pydantic import BaseModel, EmailStr, Field



class InstituteOnboardingCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    contact_email: Optional[EmailStr] = None
    admin_email: EmailStr
    admin_first_name: str = Field(min_length=1, max_length=100)
    admin_last_name: str = Field(min_length=1, max_length=100)
    # The commercial terms an institute is onboarded against - all recorded,
    # so the agreement can be reconciled against the money later.
    agreement_reference: str = Field(min_length=1, max_length=100)
    agreed_amount: float = Field(gt=0)
    amount_received: float = Field(gt=0)
    currency: str = Field(min_length=3, max_length=8)
    payment_method_id: int
    agreement_notes: Optional[str] = Field(default=None, max_length=2000)
    payment_reference: Optional[str] = Field(default=None, max_length=500)
    student_limit: int = Field(ge=0)
    staff_limit: int = Field(ge=0)
    access_duration_days: int = Field(gt=0)
    ai_student_monthly_limit: Optional[int] = Field(default=0, ge=0, le=100000)
    primary_color: str = "#e53935"
    secondary_color: str = "#17191d"
    module_ids: list[int] = Field(default_factory=list)
