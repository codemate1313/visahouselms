from typing import Optional

from pydantic import BaseModel, EmailStr


class SmtpSettingsIn(BaseModel):
    host: Optional[str] = None
    port: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None  # write-only; masked value leaves stored secret untouched
    encryption: Optional[str] = None  # tls | ssl | none
    from_address: Optional[str] = None


class FcmSettingsIn(BaseModel):
    project_id: Optional[str] = None
    service_account_json: Optional[str] = None  # write-only


class AvatarSettingsIn(BaseModel):
    provider: Optional[str] = None  # currently only "d_id"
    api_key: Optional[str] = None  # write-only; masked value leaves stored secret untouched
    presenter_image_url: Optional[str] = None
    voice_id: Optional[str] = None


class AiEvaluationSettingsIn(BaseModel):
    enabled: bool = False
    provider: str = "custom_json"
    endpoint_url: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    monthly_limit: int = 100


class BackupSettingsIn(BaseModel):
    schedule: Optional[str] = None  # none | daily | weekly
    retention: Optional[str] = None


class LogSettingsIn(BaseModel):
    retention_days: Optional[str] = None


class TestEmailIn(BaseModel):
    to_address: EmailStr


class TestFcmIn(BaseModel):
    device_token: Optional[str] = None


class RestoreIn(BaseModel):
    confirmation: str  # must equal "RESTORE"


class TerminalOpenIn(BaseModel):
    password: str
