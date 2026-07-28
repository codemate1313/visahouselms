from typing import Optional

from pydantic import BaseModel, EmailStr, Field, model_validator


class InstituteCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    contact_email: Optional[EmailStr] = None
    admin_email: EmailStr
    admin_first_name: str = Field(min_length=1, max_length=100)
    admin_last_name: str = Field(min_length=1, max_length=100)
    session_duration_hours: int = Field(default=24, ge=1, le=720)
    ai_student_monthly_limit: Optional[int] = Field(default=None, ge=0, le=100000)
    # An institute is only created against a recorded commercial agreement, so
    # the terms and the money behind it are not optional here.
    agreement_reference: str = Field(min_length=1, max_length=100)
    agreed_amount: float = Field(ge=0)
    amount_received: float = Field(ge=0)
    currency: str = Field(min_length=3, max_length=8)
    payment_method_id: int
    agreement_notes: Optional[str] = Field(default=None, max_length=2000)
    payment_reference: Optional[str] = Field(default=None, max_length=500)
    # The provisions allocated to this institute. They are enforced through a
    # plan the server derives and keeps in step (see `_sync_agreement_plan`) -
    # there is no plan to name, price or list, so none of that is accepted here.
    student_limit: Optional[int] = Field(default=None, ge=0)
    staff_limit: Optional[int] = Field(default=None, ge=0)
    access_duration_days: Optional[int] = Field(default=None, gt=0)
    grace_days: Optional[int] = Field(default=None, ge=0)
    module_ids: Optional[list[int]] = Field(default_factory=list)
    primary_color: Optional[str] = "#e53935"
    secondary_color: Optional[str] = "#17191d"

    @model_validator(mode="after")
    def _received_within_agreed(self) -> "InstituteCreate":
        # Same rule the onboarding wizard enforces: an institute cannot have
        # paid more than it agreed to.
        if self.amount_received > self.agreed_amount:
            raise ValueError("Amount received cannot exceed the agreed amount")
        return self


class InstituteUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    contact_email: Optional[EmailStr] = None
    session_duration_hours: Optional[int] = Field(default=None, ge=1, le=720)
    ai_student_monthly_limit: Optional[int] = Field(default=None, ge=0, le=100000)
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
    grace_days: Optional[int] = Field(default=None, ge=0)
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
