from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


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
    audience: str = Field(default="both", pattern="^(both|direct_students|institutes)$")
    is_published: bool = False


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
    audience: Optional[str] = Field(default=None, pattern="^(both|direct_students|institutes)$")
    is_published: Optional[bool] = None


class AssignSubscriptionRequest(BaseModel):
    plan_id: int
    starts_at: Optional[datetime] = None


class RenewSubscriptionRequest(BaseModel):
    plan_id: Optional[int] = None
