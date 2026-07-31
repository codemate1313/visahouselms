from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

MAX_FEATURES = 12


class PlanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None
    price: float = Field(ge=0)
    currency: str = "INR"
    duration_days: int = Field(gt=0)
    student_limit: int = Field(ge=0)
    test_limit: int = Field(ge=0)
    staff_limit: int = Field(ge=0)
    grace_days: int = Field(default=7, ge=0)
    module_ids: list[int] = Field(default_factory=list)
    gst_rate_id: Optional[int] = None
    is_international_enabled: bool = False
    usd_price: Optional[float] = Field(default=None, ge=0)
    audience: str = Field(default="direct_students", pattern="^(direct_students|institutes)$")
    is_published: bool = False
    # Marketing bullets for the public pricing card; empty falls back to a list
    # derived from the plan's modules and limits.
    features: list[str] = Field(default_factory=list, max_length=MAX_FEATURES)


class PlanUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None
    price: Optional[float] = Field(default=None, ge=0)
    currency: Optional[str] = None
    duration_days: Optional[int] = Field(default=None, gt=0)
    student_limit: Optional[int] = Field(default=None, ge=0)
    test_limit: Optional[int] = Field(default=None, ge=0)
    staff_limit: Optional[int] = Field(default=None, ge=0)
    grace_days: Optional[int] = Field(default=None, ge=0)
    module_ids: Optional[list[int]] = None
    gst_rate_id: Optional[int] = None
    is_international_enabled: Optional[bool] = None
    usd_price: Optional[float] = Field(default=None, ge=0)
    audience: Optional[str] = Field(default=None, pattern="^(direct_students|institutes)$")

    is_published: Optional[bool] = None
    features: Optional[list[str]] = Field(default=None, max_length=MAX_FEATURES)



class AssignSubscriptionRequest(BaseModel):
    plan_id: int
    starts_at: Optional[datetime] = None


class RenewSubscriptionRequest(BaseModel):
    plan_id: Optional[int] = None


class PlanDisplaySettings(BaseModel):
    """Per-catalogue visibility on the public pricing page. Both are optional so
    a screen can flip one switch without restating the other."""

    direct_students: Optional[bool] = None
    institutes: Optional[bool] = None
