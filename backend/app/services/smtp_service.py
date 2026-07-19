import smtplib
import ssl
from email.message import EmailMessage

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.services.settings_service import get_setting

SMTP_TIMEOUT_SECONDS = 15


def _require(db: Session, key: str) -> str:
    value = get_setting(db, key)
    if not value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SMTP is not fully configured - missing '{key.split('.', 1)[1]}'",
        )
    return value


def send_email(db: Session, to_address: str, subject: str, body: str) -> None:
    host = _require(db, "smtp.host")
    port = int(_require(db, "smtp.port"))
    username = get_setting(db, "smtp.username")
    password = get_setting(db, "smtp.password")
    encryption = (get_setting(db, "smtp.encryption") or "tls").lower()  # tls | ssl | none
    from_address = _require(db, "smtp.from_address")

    message = EmailMessage()
    message["From"] = from_address
    message["To"] = to_address
    message["Subject"] = subject
    message.set_content(body)

    try:
        if encryption == "ssl":
            with smtplib.SMTP_SSL(host, port, timeout=SMTP_TIMEOUT_SECONDS) as server:
                if username and password:
                    server.login(username, password)
                server.send_message(message)
        else:
            with smtplib.SMTP(host, port, timeout=SMTP_TIMEOUT_SECONDS) as server:
                if encryption == "tls":
                    server.starttls(context=ssl.create_default_context())
                if username and password:
                    server.login(username, password)
                server.send_message(message)
    except (smtplib.SMTPException, OSError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"SMTP send failed: {exc}",
        )


def send_test_email(db: Session, to_address: str) -> None:
    send_email(
        db,
        to_address,
        "IELTS LMS - SMTP test",
        "This is a test email from your IELTS LMS Developer Settings. SMTP is working.",
    )
