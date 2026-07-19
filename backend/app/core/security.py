import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

import bcrypt
import jwt

from app.config import settings

TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))


def _create_token(
    subject: int,
    role: str,
    institute_id: Optional[int],
    token_type: str,
    expires_delta: timedelta,
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
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: int, role: str, institute_id: Optional[int]) -> str:
    return _create_token(
        user_id,
        role,
        institute_id,
        TOKEN_TYPE_ACCESS,
        timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(user_id: int, role: str, institute_id: Optional[int]) -> str:
    return _create_token(
        user_id,
        role,
        institute_id,
        TOKEN_TYPE_REFRESH,
        timedelta(days=settings.refresh_token_expire_days),
    )


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


def hash_refresh_token(refresh_token: str) -> str:
    # Refresh tokens are already high-entropy random JWTs; a fast SHA-256-based
    # digest (not bcrypt) is enough so a stolen DB doesn't yield usable tokens,
    # without the per-request cost bcrypt would add to every refresh call.
    return hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()
