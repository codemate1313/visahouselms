from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.crypto import SettingsDecryptionError
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


def _get_ssl_context() -> ssl.SSLContext:
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx


def send_email(db: Session, to_address: str, subject: str, body: str, html_body: str | None = None) -> None:
    host = _require(db, "smtp.host")
    port = int(_require(db, "smtp.port"))
    username = get_setting(db, "smtp.username")
    try:
        password = get_setting(db, "smtp.password")
    except SettingsDecryptionError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stored SMTP password cannot be decrypted. Re-enter and save the SMTP password.",
        )
    encryption = (get_setting(db, "smtp.encryption") or "tls").lower()  # tls | ssl | none
    from_address = _require(db, "smtp.from_address")

    message = EmailMessage()
    if "<" not in from_address and "@" in from_address:
        message["From"] = f"Visa House <{from_address}>"
    else:
        message["From"] = from_address
    message["To"] = to_address
    message["Subject"] = subject
    # Optimize headers for transactional deliverability (helps prevent moving to spam)
    message["Auto-Submitted"] = "auto-generated"
    message["MIME-Version"] = "1.0"
    message.set_content(body)
    if html_body:
        message.add_alternative(html_body, subtype="html")

    ctx = _get_ssl_context()

    try:
        if encryption == "ssl":
            with smtplib.SMTP_SSL(host, port, context=ctx, timeout=SMTP_TIMEOUT_SECONDS) as server:
                if username and password:
                    server.login(username, password)
                server.send_message(message)
        else:
            with smtplib.SMTP(host, port, timeout=SMTP_TIMEOUT_SECONDS) as server:
                if encryption == "tls":
                    server.starttls(context=ctx)
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
        "Language CERT - SMTP test",
        "This is a test email from your Language CERT Platform Settings. SMTP is working.",
    )


def send_voucher_purchase_email(
    db: Session,
    to_email: str,
    buyer_name: str,
    voucher_name: str,
    code_16_digit: str,
    valid_until_str: str,
    amount_str: str,
    purchase_number: str,
) -> None:
    subject = f"Your {voucher_name} Exam Voucher Code [{code_16_digit}]"

    plain_text = f"""
Hello {buyer_name},

Thank you for purchasing your {voucher_name} exam voucher!

Your 16-Digit Voucher Code: {code_16_digit}
Valid Until: {valid_until_str}
Amount Paid: {amount_str}
Purchase Reference: {purchase_number}

Instructions:
1. Copy your 16-digit voucher code: {code_16_digit}
2. Visit the official test booking portal (e.g. Language CERT / Pearson PTE portal).
3. Select your test center and date.
4. Enter this 16-digit code at the payment checkout step to redeem your exam seat.

If you have any questions, please contact our support team.

Best regards,
VisaHouse LMS Team
"""

    html_content = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }}
    .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }}
    .header {{ background: linear-gradient(135deg, #0284c7, #2563eb); color: #ffffff; padding: 32px 24px; text-align: center; }}
    .header h1 {{ margin: 0; font-size: 24px; font-weight: 700; }}
    .header p {{ margin: 6px 0 0; opacity: 0.9; font-size: 14px; }}
    .content {{ padding: 32px 24px; }}
    .code-box {{ background: #f0f9ff; border: 2px dashed #0284c7; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }}
    .code-label {{ font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #0284c7; font-weight: 700; margin-bottom: 8px; }}
    .code-value {{ font-family: 'Courier New', Courier, monospace; font-size: 26px; font-weight: 800; color: #0f172a; letter-spacing: 3px; word-break: break-all; }}
    .details-table {{ width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px; }}
    .details-table td {{ padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }}
    .details-table td.label {{ color: #64748b; font-weight: 600; width: 40%; }}
    .details-table td.value {{ color: #0f172a; font-weight: 700; }}
    .instructions {{ background: #f8fafc; border-left: 4px solid #0284c7; padding: 16px; border-radius: 0 8px 8px 0; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }}
    .instructions ol {{ margin: 8px 0 0; padding-left: 20px; }}
    .footer {{ text-align: center; padding: 20px; background: #f1f5f9; color: #64748b; font-size: 12px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Exam Voucher Code</h1>
      <p>Visa House Verified Test Voucher</p>
    </div>
    <div class="content">
      <p>Hello <strong>{buyer_name}</strong>,</p>
      <p>Thank you for purchasing your <strong>{voucher_name}</strong> exam voucher. Your 16-digit voucher code is ready to use below:</p>

      <div class="code-box">
        <div class="code-label">16-Digit Alphanumeric Voucher Code</div>
        <div class="code-value">{code_16_digit}</div>
      </div>

      <table class="details-table">
        <tr><td class="label">Voucher Type:</td><td class="value">{voucher_name}</td></tr>
        <tr><td class="label">Valid Until:</td><td class="value">{valid_until_str}</td></tr>
        <tr><td class="label">Amount Paid:</td><td class="value">{amount_str}</td></tr>
        <tr><td class="label">Purchase Number:</td><td class="value">{purchase_number}</td></tr>
      </table>

      <div class="instructions">
        <strong>How to Redeem:</strong>
        <ol>
          <li>Copy your 16-digit voucher code: <code>{code_16_digit}</code></li>
          <li>Go to the official exam registration website (e.g. IDP / Pearson portal).</li>
          <li>Select your test date and location.</li>
          <li>Paste this code into the Voucher / Promo Code box at payment step.</li>
        </ol>
      </div>
    </div>
    <div class="footer">
      &copy; VisaHouse LMS. All rights reserved. For assistance, contact support.
    </div>
  </div>
</body>
</html>
"""

    send_email(
        db=db,
        to_address=to_email,
        subject=subject,
        body=plain_text,
        html_body=html_content,
    )
