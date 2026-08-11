from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class GrammarContentBase(BaseModel):
    title: str
    description: Optional[str] = None
    is_active: bool = True


class GrammarContentResponse(GrammarContentBase):
    id: int
    file_name: str
    file_size: int
    file_url: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GrammarContentListResponse(BaseModel):
    items: List[GrammarContentResponse]
    total: int
