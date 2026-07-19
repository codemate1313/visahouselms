from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", protected_namespaces=("model_",))

    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    cors_origins: str = "http://localhost:5173"
    storage_dir: str = "../storage"
    settings_encryption_key: Optional[str] = None
    mysql_bin_dir: str = "/opt/homebrew/opt/mysql/bin"

    super_admin_email: Optional[str] = None
    super_admin_password: Optional[str] = None
    super_admin_first_name: str = "Super"
    super_admin_last_name: str = "Admin"

    @property
    def storage_path(self) -> Path:
        path = Path(self.storage_dir)
        if not path.is_absolute():
            path = BACKEND_DIR / path
        return path.resolve()

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
