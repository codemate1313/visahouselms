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
    # Firebase Web SDK config - used client-side to register a browser for push;
    # distinct from the service account JSON above, which stays server-only.
    web_api_key: Optional[str] = None
    web_app_id: Optional[str] = None
    web_messaging_sender_id: Optional[str] = None
    web_vapid_key: Optional[str] = None


class AiEvaluationSettingsIn(BaseModel):
    enabled: bool = False
    provider: str = "custom_json"
    endpoint_url: Optional[str] = None
    api_key: Optional[str] = None
    api_keys: Optional[list[dict]] = None
    model: Optional[str] = None


class AiEvaluationKeyTestIn(BaseModel):
    key_id: Optional[str] = None
    provider: str = "gemini"
    preferred_provider: Optional[str] = None
    endpoint_url: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    # The choices sitting in the form, which may not be saved yet. Without
    # these the check answers about the stored key and hands back its own
    # pick, silently undoing what the admin just selected.
    writing_model: Optional[str] = None
    speaking_model: Optional[str] = None


class AiEvaluationModelListIn(BaseModel):
    key_id: Optional[str] = None
    provider: str = "gemini"
    preferred_provider: Optional[str] = None
    endpoint_url: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    writing_model: Optional[str] = None
    speaking_model: Optional[str] = None


class AiQuotaLimitsIn(BaseModel):
    """{"API Key 1": {"rpm": 10, "tpm": 250000, "rpd": 250}} - typed in from AI
    Studio, since Google exposes no endpoint that reports them."""
    limits: dict = {}


class AiMarkingToggleIn(BaseModel):
    enabled: bool


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


class PaymentGatewaySettingsIn(BaseModel):
    razorpay_enabled: Optional[bool] = False
    razorpay_key_id: Optional[str] = None
    razorpay_key_secret: Optional[str] = None
    razorpay_webhook_secret: Optional[str] = None
    stripe_enabled: Optional[bool] = False
    stripe_publishable_key: Optional[str] = None
    stripe_secret_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None


class StaticOtpSettingsIn(BaseModel):
    enabled: bool = True
    code: Optional[str] = "123456"


class GoogleOAuthSettingsIn(BaseModel):
    client_id: Optional[str] = None
    client_secret: Optional[str] = None  # write-only; masked value leaves stored secret untouched
    redirect_uri: Optional[str] = None
