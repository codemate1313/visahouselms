from email_validator import EmailNotValidError, caching_resolver, validate_email
from fastapi import HTTPException, status

from app.config import settings


INVALID_ACCOUNT_EMAIL_DETAIL = (
    "This email address is invalid or cannot receive email. "
    "Please check it and try creating the account again."
)

# Reuse DNS answers across bulk imports and concurrent account forms. A short
# timeout keeps account creation responsive when a DNS provider is degraded.
_DNS_RESOLVER = caching_resolver(timeout=3)
_NON_PRODUCTION_TEST_DOMAINS = {"example.com", "example.org", "example.net"}


def _is_non_production_test_address(email: str) -> bool:
    if settings.app_environment == "production" or "@" not in email:
        return False
    domain = email.rsplit("@", 1)[1].rstrip(".").lower()
    if domain.endswith(".test"):
        return True
    return any(domain == test_d or domain.endswith("." + test_d) for test_d in _NON_PRODUCTION_TEST_DOMAINS)


def validate_account_email(email: str) -> str:
    """Normalize an account email and require a mail-receiving domain.

    SMTP mailbox probing is intentionally not used: most providers block it
    and its result is not reliable. Ownership is still proven by the existing
    OTP flow for self-registration; this guard rejects malformed addresses,
    reserved domains in production, and domains without email delivery.
    """
    candidate = email.strip()
    test_address = _is_non_production_test_address(candidate)
    try:
        result = validate_email(
            candidate,
            check_deliverability=not test_address,
            test_environment=test_address,
            dns_resolver=None if test_address else _DNS_RESOLVER,
        )
    except EmailNotValidError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=INVALID_ACCOUNT_EMAIL_DETAIL,
        ) from exc
    return result.normalized.lower()
