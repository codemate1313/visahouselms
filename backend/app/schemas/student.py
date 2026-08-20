from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class PlanSubscribeRequest(BaseModel):
    coupon_code: Optional[str] = Field(default=None, max_length=50)


class DailyEnglishAnswerRequest(BaseModel):
    question_id: str = Field(min_length=1, max_length=60)
    answer_index: int = Field(ge=0, le=3)


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
    rules_consent: bool
    camera_active: bool
    microphone_active: bool
    fullscreen_active: bool


class FinalTestHeartbeatRequest(BaseModel):
    sequence: int = Field(ge=1)
    client_id: str = Field(min_length=16, max_length=64)
    camera_active: bool
    microphone_active: bool
    fullscreen_active: bool
    visible: bool
    focused: bool
    current_part_id: Optional[int] = None
    client_at: datetime


class PartGradeRequest(BaseModel):
    # Empty/partial criteria are allowed here - this endpoint now only ever
    # saves a draft (see attempt_service.save_part_draft); the whole attempt
    # is finalized in one shot via the separate submit-grading endpoint.
    criteria: list[dict] = Field(default_factory=list)
    comment: Optional[str] = Field(default=None, max_length=4000)


class ReevaluationCreateRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=2000)


class ReevaluationResolveRequest(BaseModel):
    resolution: str = Field(pattern="^(resolved|rejected)$")
    note: str = Field(min_length=10, max_length=4000)


class RetakeRequestCreate(BaseModel):
    reason: str = Field(min_length=1, max_length=2000)


class RetakeResolveRequest(BaseModel):
    resolution: str = Field(pattern="^(approved|rejected)$")
    note: str = Field(min_length=10, max_length=4000)
