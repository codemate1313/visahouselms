from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class TrialConfigUpdate(BaseModel):
    trial_duration_days: Optional[int] = Field(default=None, gt=0)
    course_limit: Optional[int] = Field(default=None, ge=0)
    test_limit: Optional[int] = Field(default=None, ge=0)
    is_enabled: Optional[bool] = None


class DemoAccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    admin_email: EmailStr
    admin_first_name: str = Field(min_length=1, max_length=100)
    admin_last_name: str = Field(min_length=1, max_length=100)
    duration_days: int = Field(gt=0, default=14)
    course_limit: int = Field(ge=0, default=2)
    test_limit: int = Field(ge=0, default=5)
