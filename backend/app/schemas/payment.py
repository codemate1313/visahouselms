from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class CouponCreate(BaseModel):
    code: str = Field(min_length=2, max_length=50)
    discount_type: str  # percent | flat
    value: float = Field(gt=0)
    scope: str = "all"  # all | plan
    scope_plan_id: Optional[int] = None
    usage_limit: Optional[int] = Field(default=None, gt=0)
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None


class CouponUpdate(BaseModel):
    value: Optional[float] = Field(default=None, gt=0)
    scope: Optional[str] = None
    scope_plan_id: Optional[int] = None
    usage_limit: Optional[int] = Field(default=None, gt=0)
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None


class RecordPaymentRequest(BaseModel):
    institute_id: int
    plan_id: int
    coupon_code: Optional[str] = None
    gateway_reference: Optional[str] = None
    payment_method_id: Optional[int] = None
    amount_received: Optional[float] = Field(default=None, gt=0)

    @field_validator("amount_received", mode="before")
    @classmethod
    def normalize_amount_received(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.replace(",", ".").strip()
            return float(v) if v else None
        return v


class AdminStudentPlanPaymentRequest(BaseModel):
    """Super Admin recording a plan payment for an existing direct student -
    first assignment or a renewal after the previous term expired. Same
    shape as RecordPaymentRequest, minus institute_id (the student is the
    target, taken from the URL) and with the payment method required, since
    there is no self-service checkout behind this to fall back on."""

    plan_id: int
    payment_method_id: int
    coupon_code: Optional[str] = None
    gateway_reference: Optional[str] = None
    amount_received: Optional[float] = Field(default=None, gt=0)

    @field_validator("amount_received", mode="before")
    @classmethod
    def normalize_amount_received(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.replace(",", ".").strip()
            return float(v) if v else None
        return v


class AddInstallmentRequest(BaseModel):
    amount: float = Field(gt=0)
    payment_method_id: Optional[int] = None
    reference: Optional[str] = None

    @field_validator("amount", mode="before")
    @classmethod
    def normalize_amount(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.replace(",", ".").strip()
            return float(v) if v else v
        return v


class PaymentMethodCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)


class InstituteRenewalOrderRequest(BaseModel):
    """Self-service renewal. `plan_id` defaults to the plan currently in force;
    any other value must be one the institute has held before or a published
    tier, which the service re-checks server-side."""

    plan_id: Optional[int] = None
    coupon_code: Optional[str] = None


class InstituteRenewalVerifyRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str


class SendInvoiceEmailRequest(BaseModel):
    recipient_email: str = Field(min_length=3, max_length=255)
    custom_message: Optional[str] = None

