from pathlib import Path
from typing import Literal, Optional

from cryptography.fernet import Fernet
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(BACKEND_DIR / ".env"), ".env"),
        extra="ignore",
        protected_namespaces=("model_",),
    )

    database_url: str
    jwt_secret_key: str
    app_environment: Literal["development", "test", "production"] = "development"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7
    login_otp_expire_minutes: int = 10
    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    google_redirect_uri: Optional[str] = None
    refresh_cookie_name: str = "ielts_lms_refresh"
    refresh_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    refresh_cookie_domain: Optional[str] = None
    frontend_url: str = "http://localhost:5173"
    cors_origins: str = "http://localhost:5173"
    allowed_hosts: str = ""
    storage_dir: str = "../storage"
    # Path to a MaxMind GeoLite2-City .mmdb, used to resolve a session's IP to a
    # city. Optional: when unset or missing, session location shows as unknown
    # and nothing breaks. Download the free DB from MaxMind and point this here.
    geoip_db_path: str = "../data/GeoLite2-City.mmdb"
    settings_encryption_key: Optional[str] = None
    registration_rate_limit: int = 5
    registration_rate_window_seconds: int = 3600
    login_rate_limit: int = 10
    login_rate_window_seconds: int = 900
    otp_attempt_limit: int = 5
    otp_ip_rate_limit: int = 30
    otp_rate_window_seconds: int = 900
    password_reset_rate_limit: int = 5
    password_reset_rate_window_seconds: int = 3600

    ai_enabled: bool = True
    ai_provider: str = "gemini"
    ai_model: str = "gemini-1.5-flash"
    ai_api_key: Optional[str] = None
    ai_endpoint_url: Optional[str] = None

    # Local-only convenience: fixes the login OTP to a known value. Rejected
    # outright in production by validate_production_secrets below.
    dev_static_otp_code: Optional[str] = None
    mysql_bin_dir: str = "/opt/homebrew/opt/mysql/bin"

    super_admin_email: Optional[str] = None
    super_admin_password: Optional[str] = None
    super_admin_first_name: str = "Super"
    super_admin_last_name: str = "Admin"
    developer_access_slug: str = "vh-control-9f4c2a"

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        if self.app_environment == "production" and not self.settings_encryption_key:
            raise ValueError("SETTINGS_ENCRYPTION_KEY is required in production")
        if self.app_environment == "production" and self.settings_encryption_key:
            try:
                Fernet(self.settings_encryption_key.encode("utf-8"))
            except (TypeError, ValueError):
                raise ValueError("SETTINGS_ENCRYPTION_KEY must be a valid Fernet key") from None
        configured_origins = [origin.strip() for origin in self.cors_origins.split(",")]
        if "*" in configured_origins:
            raise ValueError("Wildcard CORS origins are not allowed with credentialed requests")
        configured_hosts = [host.strip() for host in self.allowed_hosts.split(",") if host.strip()]
        if self.app_environment == "production" and (not configured_hosts or "*" in configured_hosts):
            raise ValueError("ALLOWED_HOSTS must be explicitly configured in production")
        if self.refresh_cookie_samesite == "none" and self.app_environment != "production":
            raise ValueError("SameSite=None refresh cookies are only allowed in production")
        if self.app_environment == "production" and self.dev_static_otp_code:
            raise ValueError("DEV_STATIC_OTP_CODE must not be set in production")
        return self

    @property
    def refresh_cookie_secure(self) -> bool:
        return self.app_environment == "production" or self.refresh_cookie_samesite == "none"

    @property
    def storage_path(self) -> Path:
        path = Path(self.storage_dir)
        if not path.is_absolute():
            path = BACKEND_DIR / path
        return path.resolve()

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
        if self.app_environment == "production":
            return origins
        defaults = [
            f"http://{host}:{port}"
            for host in ("localhost", "127.0.0.1")
            for port in range(5170, 5190)
        ]
        return list(set(origins + defaults))

    @property
    def cors_origin_regex(self) -> Optional[str]:
        if self.app_environment == "production":
            return None
        return r"http://(localhost|127\.0\.0\.1)(:\d+)?"

    @property
    def allowed_host_list(self) -> list[str]:
        hosts = [host.strip() for host in self.allowed_hosts.split(",") if host.strip()]
        if hosts:
            return hosts
        if self.app_environment == "production":
            return []
        return ["*"]


settings = Settings()
