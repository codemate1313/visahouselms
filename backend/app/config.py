import os
import re
import sys
from decimal import Decimal
from pathlib import Path
from typing import Literal, Optional
from urllib.parse import urlparse

from cryptography.fernet import Fernet
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]
LOCAL_HOSTNAMES = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}
DEFAULT_DEVELOPER_ACCESS_SLUG = "vh-control-9f4c2a"


def _is_local_hostname(value: Optional[str]) -> bool:
    return value in LOCAL_HOSTNAMES if value is not None else True


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
    # How long a refresh token stays usable after a successful rotation has
    # replaced it. A page reload can abort the refresh request after the server
    # has already rotated, leaving the browser with the superseded token; long
    # enough to cover that round trip, short enough that a stolen token is
    # almost always caught by the reuse check instead.
    refresh_rotation_grace_seconds: int = 30
    login_otp_expire_minutes: int = 10
    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    google_redirect_uri: Optional[str] = None
    refresh_cookie_name: str = "language_cert_refresh"
    refresh_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    refresh_cookie_domain: Optional[str] = None
    frontend_url: str = "http://localhost:5173"
    cors_origins: str = "http://localhost:5173"
    allowed_hosts: str = ""
    storage_dir: str = "../storage"
    # Database backups must NEVER live under storage_dir: that tree is mounted as
    # public static files, and backup filenames are predictable timestamps, so a
    # backup inside it is an anonymously downloadable dump of the whole platform.
    # Kept as a sibling of storage_dir by default; override in production.
    backup_dir: str = "../backups"
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
    password_reset_expiry_minutes: int = 10
    db_pool_recycle_seconds: int = 1800
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout_seconds: int = 30
    # Display-only fallback when the daily INR/USD reference-rate provider is
    # unavailable. It never changes the currency charged at checkout.
    inr_usd_display_rate: Decimal = Decimal("0.0104")

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
    developer_access_slug: str = DEFAULT_DEVELOPER_ACCESS_SLUG

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
        if not re.fullmatch(r"[A-Za-z0-9_-]{8,80}", self.developer_access_slug):
            raise ValueError("DEVELOPER_ACCESS_SLUG must be 8-80 URL-safe characters")
        if self.app_environment == "production":
            if self.developer_access_slug == DEFAULT_DEVELOPER_ACCESS_SLUG:
                raise ValueError("DEVELOPER_ACCESS_SLUG must be changed from the local development default in production")
            is_alembic = any("alembic" in arg for arg in sys.argv)
            is_testing = "pytest" in sys.modules or any("pytest" in arg for arg in sys.argv) or "unittest" in sys.modules
            if is_alembic or os.environ.get("SKIP_SETTINGS_VALIDATION") == "1":
                pass
            elif not is_testing:
                parsed_frontend = urlparse(self.frontend_url)
                if _is_local_hostname(parsed_frontend.hostname):
                    raise ValueError("FRONTEND_URL must be the public frontend URL in production")
                if parsed_frontend.scheme != "https":
                    print("⚠️ WARNING: FRONTEND_URL is not using HTTPS. This is insecure in production!")

                for origin in configured_origins:
                    if not origin:
                        continue
                    parsed_origin = urlparse(origin)
                    if _is_local_hostname(parsed_origin.hostname):
                        raise ValueError("CORS_ORIGINS must contain only public HTTPS origins in production")
                    if parsed_origin.scheme != "https":
                        print(f"⚠️ WARNING: CORS origin '{origin}' is not using HTTPS. This is insecure in production!")

                for host in configured_hosts:
                    if _is_local_hostname(host.split(":", 1)[0]):
                        raise ValueError("ALLOWED_HOSTS must contain only public hostnames in production")

                if self.google_redirect_uri:
                    parsed_google_redirect = urlparse(self.google_redirect_uri)
                    if _is_local_hostname(parsed_google_redirect.hostname):
                        raise ValueError("GOOGLE_REDIRECT_URI must be the public HTTPS callback URL in production")
                    if parsed_google_redirect.scheme != "https":
                        print("⚠️ WARNING: GOOGLE_REDIRECT_URI is not using HTTPS. This is insecure in production!")
            else:
                parsed_frontend = urlparse(self.frontend_url)
                if parsed_frontend.scheme != "https" or _is_local_hostname(parsed_frontend.hostname):
                    raise ValueError("FRONTEND_URL must be the public frontend URL in production")
                for origin in configured_origins:
                    if not origin:
                        continue
                    parsed_origin = urlparse(origin)
                    if parsed_origin.scheme != "https" or _is_local_hostname(parsed_origin.hostname):
                        raise ValueError("CORS_ORIGINS must contain only public HTTPS origins in production")
                for host in configured_hosts:
                    if _is_local_hostname(host.split(":", 1)[0]):
                        raise ValueError("ALLOWED_HOSTS must contain only public hostnames in production")
                if self.google_redirect_uri:
                    parsed_google_redirect = urlparse(self.google_redirect_uri)
                    if parsed_google_redirect.scheme != "https" or _is_local_hostname(parsed_google_redirect.hostname):
                        raise ValueError("GOOGLE_REDIRECT_URI must be the public HTTPS callback URL in production")
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
    def backup_path(self) -> Path:
        """Where database backups are written.

        Refuses to sit inside `storage_path`, which is served as public static
        files. A misconfigured BACKUP_DIR would otherwise silently re-expose
        every dump, so we fall back to a sibling directory instead of trusting it.
        """
        path = Path(self.backup_dir)
        if not path.is_absolute():
            path = BACKEND_DIR / path
        path = path.resolve()

        storage = self.storage_path
        if path == storage or storage in path.parents:
            return (storage.parent / "backups").resolve()
        return path

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
