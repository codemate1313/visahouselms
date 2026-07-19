from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator

from app.core.password_policy import validate_password_strength


class SuperAdminAccountOut(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    is_active: bool
    force_password_reset: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SuperAdminAccountCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str

    @field_validator("password")
    @classmethod
    def check_password_strength(cls, value: str) -> str:
        validate_password_strength(value)
        return value


class SuperAdminAccountUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class ProfileUpdateRequest(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class SessionOut(BaseModel):
    id: int
    user_agent: Optional[str]
    ip_address: Optional[str]
    created_at: datetime
    expires_at: datetime
    is_current: bool = False

    model_config = {"from_attributes": True}


class RevokeOthersRequest(BaseModel):
    refresh_token: str


class ForceResetRequest(BaseModel):
    enabled: bool


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def check_password_strength(cls, value: str) -> str:
        validate_password_strength(value)
        return value
