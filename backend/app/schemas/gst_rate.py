from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

from app.models.gst_rate import TAX_TYPE_EXCLUSIVE, TAX_TYPE_INCLUSIVE


class GstRateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    percentage: float = Field(ge=0, le=100)
    tax_type: str = Field(default=TAX_TYPE_EXCLUSIVE, pattern=f"^({TAX_TYPE_EXCLUSIVE}|{TAX_TYPE_INCLUSIVE})$")
    is_active: bool = True
    is_default: bool = False


class GstRateUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    percentage: Optional[float] = Field(default=None, ge=0, le=100)
    tax_type: Optional[str] = Field(default=None, pattern=f"^({TAX_TYPE_EXCLUSIVE}|{TAX_TYPE_INCLUSIVE})$")
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None


class GstRateResponse(BaseModel):
    id: int
    name: str
    percentage: float
    tax_type: str
    is_active: bool
    is_default: bool
    created_at: datetime

    class Config:
        from_attributes = True
