"""Time-based one-time passwords (authenticator app) for the developer account.

The developer login is password-only since its emailed code was removed. This
restores a second factor without email: the account scans a QR into an
authenticator app once, and every developer login then asks for the rolling
6-digit code.

The secret is stored encrypted via the settings encryption the rest of the app
uses, never returned after enrolment, and only ever verified. Enrolment is a two
step handshake - generate, then confirm with a live code - so a secret is never
switched on until the app that holds it has proven it works.
"""
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.crypto import decrypt_value, encrypt_value
from app.models.user import User

ISSUER = "Visa House LMS"


def _require_lib():
    try:
        import pyotp  # noqa: F401
    except Exception as exc:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Authenticator 2FA is unavailable: the pyotp library is not installed.",
        ) from exc
    return pyotp


def is_enabled(user: User) -> bool:
    return bool(getattr(user, "totp_enabled", False))


def begin_enrolment(db: Session, user: User) -> dict:
    """Generate a fresh secret and the otpauth URL to turn into a QR.

    The secret is stored but not activated; login is unaffected until a code has
    been confirmed. Generating again simply replaces the pending secret.
    """
    pyotp = _require_lib()
    secret = pyotp.random_base32()
    user.totp_secret = encrypt_value(secret)
    user.totp_enabled = False
    db.add(user)
    db.commit()

    uri = pyotp.totp.TOTP(secret).provisioning_uri(name=user.email, issuer_name=ISSUER)
    return {"secret": secret, "otpauth_url": uri}


def _current_secret(user: User) -> Optional[str]:
    stored = getattr(user, "totp_secret", None)
    if not stored:
        return None
    try:
        return decrypt_value(stored)
    except Exception:
        return None


def verify(user: User, code: str) -> bool:
    """Check a code against the stored secret, with a one-step window so a code
    that ticks over mid-request is not rejected."""
    pyotp = _require_lib()
    secret = _current_secret(user)
    if not secret or not code:
        return False
    return pyotp.totp.TOTP(secret).verify(code.strip(), valid_window=1)


def confirm_enrolment(db: Session, user: User, code: str) -> None:
    """Activate 2FA once a live code proves the authenticator is set up."""
    if not verify(user, code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That code is not valid. Try again.")
    user.totp_enabled = True
    db.add(user)
    db.commit()


def disable(db: Session, user: User, code: str) -> None:
    """Turn 2FA off. Requires a current code, so a walk-up to an unlocked screen
    cannot silently remove the factor."""
    if not verify(user, code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That code is not valid.")
    user.totp_enabled = False
    user.totp_secret = None
    db.add(user)
    db.commit()
