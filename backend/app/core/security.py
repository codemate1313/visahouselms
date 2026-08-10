import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy.orm import Session
import bcrypt
import jwt

from app.config import settings

TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"
TOKEN_TYPE_LOGIN_OTP = "login_otp"
TOKEN_TYPE_GOOGLE_OAUTH_STATE = "google_oauth_state"


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))


# The strongest hashing this stack ships with is bcrypt; there is no argon2
# dependency. For a secret that guards shutting the whole platform down, the
# work factor is raised well above the login default (12) so an offline guess
# against the stored hash is far more expensive. bcrypt caps the input at 72
# bytes, so the secret is pre-hashed to a fixed-size digest first - otherwise a
# long passphrase would be silently truncated.
_STRONG_SECRET_ROUNDS = 14


def hash_strong_secret(plain: str) -> str:
    digest = hashlib.sha256(plain.encode("utf-8")).digest()
    return bcrypt.hashpw(digest, bcrypt.gensalt(rounds=_STRONG_SECRET_ROUNDS)).decode("utf-8")


def verify_strong_secret(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    digest = hashlib.sha256(plain.encode("utf-8")).digest()
    try:
        return bcrypt.checkpw(digest, hashed.encode("utf-8"))
    except ValueError:
        return False


def _create_token(
    subject: int,
    role: str,
    institute_id: Optional[int],
    token_type: str,
    expires_delta: timedelta,
    auth_method: str = "password",
    session_key: Optional[str] = None,
    extra_claims: Optional[dict] = None,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(subject),
        "role": role,
        "institute_id": institute_id,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        "jti": uuid4().hex,
        "auth_method": auth_method,
    }
    if session_key is not None:
        payload["sid"] = session_key
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(
    user_id: int,
    role: str,
    institute_id: Optional[int],
    auth_method: str = "password",
    session_key: Optional[str] = None,
) -> str:
    return _create_token(
        user_id,
        role,
        institute_id,
        TOKEN_TYPE_ACCESS,
        timedelta(minutes=settings.access_token_expire_minutes),
        auth_method,
        session_key,
    )


def create_refresh_token(
    user_id: int,
    role: str,
    institute_id: Optional[int],
    auth_method: str = "password",
    session_key: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    return _create_token(
        user_id,
        role,
        institute_id,
        TOKEN_TYPE_REFRESH,
        expires_delta or timedelta(minutes=settings.refresh_token_expire_minutes),
        auth_method,
        session_key,
    )


def create_login_otp_token(
    user_id: int,
    role: str,
    institute_id: Optional[int],
    auth_method: str,
    remember_me: bool,
    device_identifier: Optional[str],
    device_name: Optional[str],
    otp_hash: str,
) -> str:
    return _create_token(
        user_id,
        role,
        institute_id,
        TOKEN_TYPE_LOGIN_OTP,
        timedelta(minutes=settings.login_otp_expire_minutes),
        auth_method,
        extra_claims={
            "remember_me": remember_me,
            "device_identifier": device_identifier,
            "device_name": device_name,
            "otp_hash": otp_hash,
        },
    )


def create_google_oauth_state_token(
    role: str,
    return_path: str,
    remember_me: bool,
    device_identifier: Optional[str],
    device_name: Optional[str],
    mode: str = "login",
) -> str:
    return _create_token(
        0,
        role,
        None,
        TOKEN_TYPE_GOOGLE_OAUTH_STATE,
        timedelta(minutes=10),
        "google_oauth",
        extra_claims={
            "return_path": return_path,
            "remember_me": remember_me,
            "device_identifier": device_identifier,
            "device_name": device_name,
            "mode": mode,
        },
    )


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


def is_static_otp_enabled(db: Optional[Session] = None) -> bool:
    """Return whether the static testing OTP is enabled.

    Production ignores the stored setting entirely. The static OTP turns every
    account's second factor into one shared, well-known code, so leaving it
    switchable from an admin screen means a single mis-click - or one
    compromised admin session - silently disables 2FA platform-wide. It is a
    local testing convenience and nothing else.
    """
    if settings.app_environment == "production":
        return False
    if db is not None:
        try:
            from app.services.settings_service import get_setting
            val = get_setting(db, "testing.static_otp_enabled")
            if val is not None:
                return val.strip().lower() in ("true", "1", "yes")
        except Exception:
            pass
    return settings.app_environment == "development"


def get_static_otp_code(db: Optional[Session] = None) -> str:
    """Returns the configured static testing OTP code (default '123456')."""
    if db is not None:
        try:
            from app.services.settings_service import get_setting
            val = get_setting(db, "testing.static_otp_code")
            if val and val.strip():
                return val.strip()
        except Exception:
            pass
    return settings.dev_static_otp_code or "123456"


def generate_login_otp_code(db: Optional[Session] = None) -> str:
    """Returns static OTP if enabled (default ON), or random 6-digit code."""
    if is_static_otp_enabled(db):
        return get_static_otp_code(db)
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_login_otp_code(otp_code: str) -> str:
    return hmac.new(
        settings.jwt_secret_key.encode("utf-8"),
        otp_code.strip().encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_login_otp_code(otp_code: str, otp_hash: str, db: Optional[Session] = None) -> bool:
    if not otp_hash:
        return False
    if is_static_otp_enabled(db):
        static_code = get_static_otp_code(db)
        if otp_code.strip() == static_code.strip():
            return True
    return hmac.compare_digest(hash_login_otp_code(otp_code), otp_hash)


def hash_refresh_token(refresh_token: str) -> str:
    # Refresh tokens are already high-entropy random JWTs; a fast SHA-256-based
    # digest (not bcrypt) is enough so a stolen DB doesn't yield usable tokens,
    # without the per-request cost bcrypt would add to every refresh call.
    return hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()
