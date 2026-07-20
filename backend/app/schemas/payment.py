from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CouponCreate(BaseModel):
    code: str = Field(min_length=2, max_length=50)
    discount_type: str  # percent | flat
    value: float = Field(gt=0)
    scope: str = "all"  # all | plan | course
    scope_plan_id: Optional[int] = None
    scope_course_id: Optional[int] = None
    usage_limit: Optional[int] = Field(default=None, gt=0)
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None


class CouponUpdate(BaseModel):
    value: Optional[float] = Field(default=None, gt=0)
    scope: Optional[str] = None
    scope_plan_id: Optional[int] = None
    scope_course_id: Optional[int] = None
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


class AddInstallmentRequest(BaseModel):
    amount: float = Field(gt=0)
    payment_method_id: Optional[int] = None
    reference: Optional[str] = None


class PaymentMethodCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
