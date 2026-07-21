from typing import Optional

from pydantic import BaseModel, Field


class PlanSubscribeRequest(BaseModel):
    coupon_code: Optional[str] = Field(default=None, max_length=50)


class AnswerSaveRequest(BaseModel):
    response: Optional[dict] = None


class ProctorFlagRequest(BaseModel):
    flag_type: str
    meta: Optional[dict] = None


class PartGradeRequest(BaseModel):
    criteria: list[dict] = Field(min_length=1)
    comment: Optional[str] = Field(default=None, max_length=4000)


class ReevaluationCreateRequest(BaseModel):
    reason: str = Field(min_length=20, max_length=2000)


class ReevaluationResolveRequest(BaseModel):
    resolution: str = Field(pattern="^(resolved|rejected)$")
    note: str = Field(min_length=10, max_length=4000)
