from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, EmailStr, field_validator

from app.core.password_policy import validate_password_strength


def _clean_required_phone(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Phone number cannot be blank")
    return value


class SuperAdminAccountOut(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    is_active: bool
    force_password_reset: bool
    is_owner: bool = False
    is_developer_verified: bool = False
    can_view_monetary_analytics: bool = False
    role_name: Optional[str] = None
    dob: Optional[datetime] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    avatar_path: Optional[str] = None
    gender: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SuperAdminAccountCreate(BaseModel):
    # phone_number stays optional here: this schema is shared with the
    # Developer Panel's "Create Controlled Account" flow
    # (routers/developer.py), which has no phone field in its UI at all.
    # The regular Super Admin AccountForm enforces entry with a `required`
    # input and always sends the field.
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    dob: Optional[datetime] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    avatar_path: Optional[str] = None
    is_developer_verified: bool = False
    can_view_monetary_analytics: bool = False

    @field_validator("password")
    @classmethod
    def check_password_strength(cls, value: str) -> str:
        validate_password_strength(value)
        return value


class SuperAdminAccountUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    dob: Optional[datetime] = None
    phone_number: str
    address: Optional[str] = None
    avatar_path: Optional[str] = None
    can_view_monetary_analytics: Optional[bool] = None

    @field_validator("phone_number")
    @classmethod
    def check_phone_number(cls, value: str) -> str:
        return _clean_required_phone(value)


class DeveloperAccountCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    is_developer_verified: bool = True

    @field_validator("password")
    @classmethod
    def check_password_strength(cls, value: str) -> str:
        validate_password_strength(value)
        return value


class DeveloperAccountUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_developer_verified: Optional[bool] = None


class ProfileUpdateRequest(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    dob: Optional[datetime] = None
    phone_number: str
    address: Optional[str] = None
    avatar_path: Optional[str] = None
    gender: Optional[str] = None

    @field_validator("phone_number")
    @classmethod
    def check_phone_number(cls, value: str) -> str:
        return _clean_required_phone(value)


class SessionOut(BaseModel):
    id: int
    user_agent: Optional[str]
    ip_address: Optional[str]
    created_at: datetime
    expires_at: datetime
    is_current: bool = False

    model_config = {"from_attributes": True}


class RevokeOthersRequest(BaseModel):
    refresh_token: Optional[str] = None


class ForceResetRequest(BaseModel):
    enabled: bool


class ChangePasswordRequest(BaseModel):
    current_password: Optional[str] = None
    new_password: str

    @field_validator("new_password")
    @classmethod
    def check_password_strength(cls, value: str) -> str:
        validate_password_strength(value)
        return value


class InitialPasswordRequest(BaseModel):
    new_password: str

    @field_validator("new_password")
    @classmethod
    def check_password_strength(cls, value: str) -> str:
        validate_password_strength(value)
        return value


class LastPasswordChangeOut(BaseModel):
    """Newest entry from the account's password trail in audit_logs."""

    at: datetime
    action: str
    by_self: bool
    by_name: Optional[str] = None
    ip_address: Optional[str] = None


class DirectoryUserOut(BaseModel):
    """One row of the Super Admin cross-role user directory. Institute fields are
    null for platform-wide roles (super admins and SA instructors)."""

    id: int
    email: str
    first_name: str
    last_name: str
    role_name: str
    is_active: bool
    force_password_reset: bool
    is_owner: bool = False
    avatar_path: Optional[str] = None
    institute_id: Optional[int] = None
    institute_name: Optional[str] = None
    institute_slug: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    created_at: datetime
    # null means the account is still on the password it was created with
    password_changed_at: Optional[datetime] = None
    last_password_change: Optional[LastPasswordChangeOut] = None

    model_config = {"from_attributes": True}


class DirectoryUserPage(BaseModel):
    items: List[DirectoryUserOut]
    total: int
    page: int
    page_size: int
    role_counts: Dict[str, int]
