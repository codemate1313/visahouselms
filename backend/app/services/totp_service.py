"""Time-based one-time passwords (authenticator app) for the developer account.

The developer login is password-only since its emailed code was removed. This
restores a second factor without email: the account scans a QR into an
authenticator app once, and every developer login then asks for the rolling
6-digit code.

The secret and the enabled flag are kept in the settings table, keyed by user
id - deliberately *not* on the users table. Adding columns to `users` means a
migration, and a model that declares columns the database has not got yet breaks
every query that loads a user, login included. Storing here needs no schema
change and cannot take login down. The secret is stored encrypted; it is never
returned after enrolment, only verified.
"""
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.crypto import decrypt_value, encrypt_value
from app.models.user import User
from app.services import settings_service

ISSUER = "Visa House LMS"


def _secret_key(user_id: int) -> str:
    return f"user_totp.{user_id}.secret"


def _enabled_key(user_id: int) -> str:
    return f"user_totp.{user_id}.enabled"


def _require_lib():
    try:
        import pyotp  # noqa: F401
    except Exception as exc:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Authenticator 2FA is unavailable: the pyotp library is not installed.",
        ) from exc
    return pyotp


def is_enabled(db: Session, user: User) -> bool:
    return (settings_service.get_setting(db, _enabled_key(user.id)) or "").lower() == "on"


def begin_enrolment(db: Session, user: User) -> dict:
    """Generate a fresh secret and the otpauth URL to turn into a QR.

    The secret is stored but not activated; login is unaffected until a code has
    been confirmed. Generating again simply replaces the pending secret.
    """
    pyotp = _require_lib()
    secret = pyotp.random_base32()
    settings_service.set_setting(db, _secret_key(user.id), encrypt_value(secret))
    settings_service.set_setting(db, _enabled_key(user.id), "off")

    uri = pyotp.totp.TOTP(secret).provisioning_uri(name=user.email, issuer_name=ISSUER)
    return {"secret": secret, "otpauth_url": uri}


def _current_secret(db: Session, user: User) -> Optional[str]:
    stored = settings_service.get_setting(db, _secret_key(user.id))
    if not stored:
        return None
    try:
        return decrypt_value(stored)
    except Exception:
        return None


def verify(db: Session, user: User, code: str) -> bool:
    """Check a code against the stored secret, with a one-step window so a code
    that ticks over mid-request is not rejected."""
    pyotp = _require_lib()
    secret = _current_secret(db, user)
    if not secret or not code:
        return False
    return pyotp.totp.TOTP(secret).verify(code.strip(), valid_window=1)


def confirm_enrolment(db: Session, user: User, code: str) -> None:
    """Activate 2FA once a live code proves the authenticator is set up."""
    if not verify(db, user, code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That code is not valid. Try again.")
    settings_service.set_setting(db, _enabled_key(user.id), "on")


def disable(db: Session, user: User, code: str) -> None:
    """Turn 2FA off. Requires a current code, so a walk-up to an unlocked screen
    cannot silently remove the factor."""
    if not verify(db, user, code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That code is not valid.")
    settings_service.set_setting(db, _enabled_key(user.id), "off")
    settings_service.set_setting(db, _secret_key(user.id), None)
