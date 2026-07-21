from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class PlanSubscribeRequest(BaseModel):
    coupon_code: Optional[str] = Field(default=None, max_length=50)


class AnswerSaveRequest(BaseModel):
    response: Optional[dict] = None
    revision: Optional[int] = Field(default=None, ge=1)


class ProctorFlagRequest(BaseModel):
    flag_type: str
    meta: Optional[dict] = None
    client_sequence: Optional[int] = Field(default=None, ge=1)
    client_occurred_at: Optional[datetime] = None


class FinalTestPreflightRequest(BaseModel):
    client_id: str = Field(min_length=16, max_length=64)
    camera_active: bool
    microphone_active: bool
    screen_share_active: bool
    fullscreen_active: bool
    display_surface: Literal["monitor"]


class FinalTestHeartbeatRequest(BaseModel):
    sequence: int = Field(ge=1)
    client_id: str = Field(min_length=16, max_length=64)
    camera_active: bool
    microphone_active: bool
    screen_share_active: bool
    fullscreen_active: bool
    visible: bool
    focused: bool
    display_surface: Optional[str] = Field(default=None, max_length=30)
    current_part_id: Optional[int] = None
    client_at: datetime


class PartGradeRequest(BaseModel):
    criteria: list[dict] = Field(min_length=1)
    comment: Optional[str] = Field(default=None, max_length=4000)


class ReevaluationCreateRequest(BaseModel):
    reason: str = Field(min_length=20, max_length=2000)


class ReevaluationResolveRequest(BaseModel):
    resolution: str = Field(pattern="^(resolved|rejected)$")
    note: str = Field(min_length=10, max_length=4000)
