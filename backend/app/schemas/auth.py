from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.password_policy import validate_password_strength


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    device_id: Optional[str] = Field(default=None, min_length=16, max_length=200)
    device_name: Optional[str] = Field(default=None, max_length=120)
    remember_me: bool = True
    # Authenticator code, supplied on the second step of a developer login when
    # TOTP 2FA is enabled. Ignored for every other account.
    totp_code: Optional[str] = Field(default=None, max_length=10)
    role: Optional[str] = Field(default=None, max_length=40)


class GoogleOtpRequest(BaseModel):
    email: EmailStr
    device_id: Optional[str] = Field(default=None, min_length=16, max_length=200)
    device_name: Optional[str] = Field(default=None, max_length=120)
    remember_me: bool = True
    role: Optional[str] = Field(default=None, max_length=40)


class VerifyOtpRequest(BaseModel):
    challenge_id: str = Field(min_length=20, max_length=3000)
    otp_code: str = Field(min_length=4, max_length=12)


class RegisterRequest(BaseModel):
    """Public self-registration for direct (B2C) students only - every other
    role in this app is admin-created."""

    email: EmailStr
    password: str
    first_name: str
    last_name: str
    device_id: Optional[str] = Field(default=None, min_length=16, max_length=200)
    device_name: Optional[str] = Field(default=None, max_length=120)

    @field_validator("password")
    @classmethod
    def check_password_strength(cls, value: str) -> str:
        validate_password_strength(value)
        return value

    @field_validator("first_name", "last_name")
    @classmethod
    def required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value[:100]


class RefreshRequest(BaseModel):
    refresh_token: Optional[str] = None


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    otp_required: bool = False
    otp_challenge_id: Optional[str] = None
    otp_delivery: Optional[str] = None
    message: Optional[str] = None
    # Set when a developer login needs the authenticator code as a second step.
    totp_required: bool = False


class CurrentUser(BaseModel):
    id: int
    email: str
    role: str
    institute_id: Optional[int]
    institute_slug: Optional[str] = None
    first_name: str
    last_name: str
    force_password_reset: bool = False
    avatar_url: Optional[str] = None
    institute_permissions: Optional[dict] = None
    is_owner: bool = False
    is_developer_verified: bool = False
    can_view_monetary_analytics: bool = False
    dob: Optional[datetime] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    gender: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def check_password_strength(cls, value: str) -> str:
        validate_password_strength(value)
        return value
