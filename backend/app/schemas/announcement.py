from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=2, max_length=180)
    message: str = Field(min_length=2, max_length=5000)
    audience: str = "students"
    status: Literal["draft", "published", "scheduled"] = "published"
    scheduled_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    target_institute_ids: Optional[list[int]] = None
    target_user_ids: Optional[list[int]] = None


