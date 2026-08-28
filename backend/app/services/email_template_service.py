"""Executive, Ultra-Premium Light HTML Email Generator for Visa House.

Designed specifically for 100% rendering compatibility across Gmail, Outlook,
Apple Mail, and mobile clients without SVG stripping or dark inversion bugs.
"""

from __future__ import annotations


def render_base_email(
    badge_label: str,
    title: str,
    subtitle: str,
    content_html: str,
    action_url: str | None = None,
    action_text: str | None = None,
    badge_color: str = "#b91c2b",
) -> str:
    action_button_html = ""
    if action_url and action_text:
        action_button_html = f"""
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 32px 0 16px 0; width: 100%;">
          <tr>
            <td align="center">
              <a href="{action_url}" target="_blank" style="display: inline-block; padding: 15px 38px; background-color: #b91c2b; color: #ffffff !important; font-weight: 700; font-size: 15px; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 14px rgba(185, 28, 43, 0.3); letter-spacing: -0.01em;">
                {action_text} &rarr;
              </a>
            </td>
          </tr>
        </table>
        """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased;">
  
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f4f6f9; padding: 48px 16px;">
    <tr>
      <td align="center">
        <!-- Main Email Container Card -->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06);">
          
          <!-- Top Accent Gradient Line -->
          <tr>
            <td style="height: 5px; background: linear-gradient(90deg, #b91c2b 0%, #e11d48 50%, #f43f5e 100%);"></td>
          </tr>

          <!-- Header Bar with Logo -->
          <tr>
            <td style="padding: 28px 36px 20px 36px; background-color: #ffffff; border-bottom: 1px solid #f1f5f9;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left">
                    <span style="font-size: 18px; font-weight: 900; letter-spacing: -0.03em; color: #0f172a;">
                      Visa <span style="color: #b91c2b;">House</span>
                    </span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 12px; background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 20px; color: {badge_color}; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">
                      {badge_label}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero Section -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; background-color: #ffffff;">
              <h1 style="margin: 0 0 8px 0; color: #0f172a; font-size: 24px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.25;">
                {title}
              </h1>
              <p style="margin: 0; color: #64748b; font-size: 14px; font-weight: 400; line-height: 1.5;">
                {subtitle}
              </p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 0 36px 28px 36px; background-color: #ffffff;">
              <div style="font-size: 15px; line-height: 1.7; color: #334155;">
                {content_html}
              </div>

              {action_button_html}
            </td>
          </tr>

          <!-- Clean Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 24px 36px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #475569;">
                Visa House Platform &bull; Official Account Notification
              </p>
              <p style="margin: 0; font-size: 11.5px; color: #64748b; line-height: 1.5;">
                If you have questions or need assistance, visit your student portal or contact our support team.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
"""


def render_welcome_email(first_name: str, login_url: str) -> tuple[str, str, str]:
    """Returns (subject, plain_text, html_content)."""
    subject = f"Welcome to Visa House, {first_name}! 🎉"

    plain = f"""Hi {first_name},

Welcome to Visa House! Your account has been created successfully.

Log in to access your course materials, practice assessments, and mock tests:
{login_url}

Best regards,
The Visa House Team
"""

    content_html = f"""
    <p style="margin-top: 0; font-size: 16px; font-weight: 700; color: #0f172a;">Hi {first_name},</p>
    <p>Welcome aboard! Your <strong>Visa House</strong> student portal account is now active and ready to use.</p>
    <p>You can log in to practice all four test modules, take timed mock exams, submit writing and speaking tasks, and track your Band score progress in real-time.</p>

    <!-- Clean Light Feature Card -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
      <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #b91c2b; margin-bottom: 12px;">
        Included in Your Account
      </div>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width: 100%; font-size: 14px; color: #334155; line-height: 1.6;">
        <tr>
          <td style="padding: 4px 0; width: 22px; vertical-align: top; color: #b91c2b; font-weight: bold;">✓</td>
          <td style="padding: 4px 0;">Full practice sets for Listening, Reading, Writing, & Speaking</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; vertical-align: top; color: #b91c2b; font-weight: bold;">✓</td>
          <td style="padding: 4px 0;">Instant AI evaluation & detailed instructor feedback</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; vertical-align: top; color: #b91c2b; font-weight: bold;">✓</td>
          <td style="padding: 4px 0;">Real-time Band score tracking and analytics dashboard</td>
        </tr>
      </table>
    </div>
    """

    html = render_base_email(
        badge_label="Account Ready",
        title=f"Welcome to Visa House, {first_name}!",
        subtitle="Your student portal is now active and ready for your preparation.",
        content_html=content_html,
        action_url=login_url,
        action_text="Log In to Student Portal",
        badge_color="#b91c2b",
    )

    return subject, plain, html


def render_account_credentials_email(
    first_name: str,
    email: str,
    temporary_password: str,
    login_url: str,
    role_label: str = "Account",
    is_super_instructor: bool = False,
    institute_name: Optional[str] = None,
) -> tuple[str, str, str]:
    """Returns (subject, plain_text, html_content).

    Sent when an admin/super-admin creates a new user account on someone
    else's behalf, so the recipient receives the auto-generated login
    credentials rather than having to be told them out-of-band.
    """
    subject = f"Welcome to Visa House — Your {role_label} Account is Ready"

    if is_super_instructor:
        intro_text = "Your Super Instructor account has been set up and is ready for you. You have been assigned as a Super Instructor of Visa House."
    elif institute_name:
        intro_text = f"Your Instructor account has been set up and is ready for you. You have become an instructor of {institute_name}."
    else:
        intro_text = f"Your {role_label} account has been set up and is ready for you."

    plain = f"""Hi {first_name},

Welcome to Visa House! We're delighted to have you on board.

{intro_text} Please find your login credentials below:

  Email:              {email}
  Temporary Password: {temporary_password}

To get started, visit the link below and log in with the credentials above:
{login_url}

IMPORTANT: For your security, you will be required to create a new password immediately upon your first login. Please do not share these credentials with anyone.

If you did not expect this email or believe it was sent in error, please contact our support team immediately.

Warm regards,
The Visa House Team
"""

    if is_super_instructor:
        welcome_paragraph = f"""Welcome to <strong style="color: #b91c2b;">Visa House</strong>! We are pleased to inform you that you have been assigned as a <strong style="color: #0f172a;">Super Instructor</strong> of Visa House. You now have full access to the Visa House platform."""
    elif institute_name:
        welcome_paragraph = f"""Welcome to <strong style="color: #b91c2b;">Visa House</strong>! We are pleased to inform you that you have become an instructor of <strong style="color: #0f172a;">{institute_name}</strong>. You now have full access to the Visa House platform."""
    else:
        welcome_paragraph = f"""Welcome to <strong style="color: #b91c2b;">Visa House</strong>! We are pleased to inform you that your <strong>{role_label}</strong> account has been successfully created. You now have full access to the Visa House platform."""

    content_html = f"""
    <p style="margin-top: 0; font-size: 15px; color: #334155; line-height: 1.6;">
      Dear <strong style="color: #0f172a;">{first_name}</strong>,
    </p>
    <p style="font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 20px 0;">
      {welcome_paragraph}
    </p>
    <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin: 0 0 20px 0;">
      Please use the credentials below to access your account for the first time.
    </p>

    <!-- Credentials Card -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 24px; margin: 8px 0 24px 0;">
      <div style="display: flex; align-items: center; margin-bottom: 18px;">
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #b91c2b; background-color: #fef2f2; padding: 4px 10px; border-radius: 20px; display: inline-block;">
          &#128274;&nbsp; Login Credentials
        </div>
      </div>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: separate; border-spacing: 0 10px; font-size: 14px;">
        <tr>
          <td style="width: 110px; color: #475569; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; vertical-align: middle; padding: 10px 12px 10px 0;">Email</td>
          <td style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; font-weight: 600; color: #1e40af; font-size: 14px;">{email}</td>
        </tr>
        <tr>
          <td style="width: 110px; color: #475569; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; vertical-align: middle; padding: 10px 12px 10px 0;">Password</td>
          <td style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; font-weight: 700; color: #0f172a; font-family: 'SFMono-Regular', Consolas, 'Courier New', monospace; letter-spacing: 0.06em; font-size: 15px;">{temporary_password}</td>
        </tr>
      </table>
    </div>

    <!-- Security Notice -->
    <div style="background-color: #fffbeb; border: 1px solid #fcd34d; border-left: 4px solid #f59e0b; border-radius: 10px; padding: 16px 18px; margin: 0 0 8px 0;">
      <div style="display: flex; align-items: flex-start; gap: 10px;">
        <div>
          <div style="font-size: 13px; font-weight: 700; color: #92400e; margin-bottom: 5px;">&#9888;&nbsp; Important Security Notice</div>
          <div style="font-size: 13px; color: #78350f; line-height: 1.6;">
            This is a <strong>temporary password</strong>. You will be asked to create a new, secure password the moment you first log in. Please keep this email confidential and do not share your credentials with anyone.
          </div>
        </div>
      </div>
    </div>
    """

    html = render_base_email(
        badge_label="Account Created",
        title=f"Your {role_label} Account is Ready",
        subtitle=f"Welcome to Visa House — your gateway to exam success.",
        content_html=content_html,
        action_url=login_url,
        action_text="Access My Account",
        badge_color="#b91c2b",
    )

    return subject, plain, html



def render_forgot_password_email(first_name: str, reset_url: str) -> tuple[str, str, str]:
    """Returns (subject, plain_text, html_content)."""
    subject = "Reset Your Password — Visa House"

    plain = f"""Hi {first_name},

We received a security request to reset the password for your Visa House account.

To set up a new password, please click the secure link below. For your protection, this link will expire in exactly 10 minutes.

Reset Password Link:
{reset_url}

If you did not request this password reset, please ignore this message. Your current password remains secure and unchanged.

Best regards,
The Visa House Security Team
"""

    content_html = f"""
    <p style="margin-top: 0; font-size: 15px; color: #334155; line-height: 1.6;">
      Dear <strong style="color: #0f172a;">{first_name}</strong>,
    </p>
    <p style="font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 20px 0;">
      We received a security request to reset the password associated with your <strong style="color: #b91c2b;">Visa House</strong> account.
    </p>
    <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin: 0 0 24px 0;">
      Click the button below to securely set up a new password. For your protection, this verification link is only valid for <strong>10 minutes</strong>.
    </p>
    
    <!-- Security Notice Card -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #94a3b8; border-radius: 10px; padding: 16px 18px; margin: 0 0 8px 0;">
      <div style="display: flex; align-items: flex-start; gap: 10px;">
        <div>
          <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; margin-bottom: 6px;">&#128272;&nbsp; Security Notice</div>
          <div style="font-size: 13px; color: #64748b; line-height: 1.6;">
            If you did not request a password reset, you can safely ignore this email. Your current password remains completely safe and unchanged.
          </div>
        </div>
      </div>
    </div>
    """

    html = render_base_email(
        badge_label="Security Verification",
        title="Password Reset Request",
        subtitle="Secure verification link for your Visa House account.",
        content_html=content_html,
        action_url=reset_url,
        action_text="Reset Password Now",
        badge_color="#b91c2b",
    )

    return subject, plain, html


def render_password_reset_by_admin_email(
    first_name: str,
    email: str,
    new_password: str,
    login_url: str,
) -> tuple[str, str, str]:
    """Returns (subject, plain_text, html_content).

    Sent when an administrator resets a user's password.
    Informs them of their new password and provides a direct login link.
    """
    subject = "Your Visa House Password Has Been Reset"

    plain = f"""Hi {first_name},

Your Visa House account password has been reset by an administrator.

Please find your new login credentials below:

  Email:        {email}
  New Password: {new_password}

To log in to your account, visit the link below:
{login_url}

IMPORTANT: For your security, any previous active sessions have been signed out. You will be prompted to update your password upon logging in.

Best regards,
The Visa House Team
"""

    content_html = f"""
    <p style="margin-top: 0; font-size: 15px; color: #334155; line-height: 1.6;">
      Dear <strong style="color: #0f172a;">{first_name}</strong>,
    </p>
    <p style="font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 20px 0;">
      Your <strong style="color: #b91c2b;">Visa House</strong> account password has been updated by an administrator.
    </p>
    <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin: 0 0 20px 0;">
      Please use your new password below to log in:
    </p>

    <!-- Credentials Card -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 24px; margin: 8px 0 24px 0;">
      <div style="display: flex; align-items: center; margin-bottom: 18px;">
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #b91c2b; background-color: #fef2f2; padding: 4px 10px; border-radius: 20px; display: inline-block;">
          &#128274;&nbsp; Updated Credentials
        </div>
      </div>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: separate; border-spacing: 0 10px; font-size: 14px;">
        <tr>
          <td style="width: 110px; color: #475569; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; vertical-align: middle; padding: 10px 12px 10px 0;">Email</td>
          <td style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; font-weight: 600; color: #1e40af; font-size: 14px;">{email}</td>
        </tr>
        <tr>
          <td style="width: 110px; color: #475569; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; vertical-align: middle; padding: 10px 12px 10px 0;">New Password</td>
          <td style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; font-weight: 700; color: #0f172a; font-family: 'SFMono-Regular', Consolas, 'Courier New', monospace; letter-spacing: 0.06em; font-size: 15px;">{new_password}</td>
        </tr>
      </table>
    </div>

    <!-- Security Notice -->
    <div style="background-color: #fffbeb; border: 1px solid #fcd34d; border-left: 4px solid #f59e0b; border-radius: 10px; padding: 16px 18px; margin: 0 0 8px 0;">
      <div style="display: flex; align-items: flex-start; gap: 10px;">
        <div>
          <div style="font-size: 13px; font-weight: 700; color: #92400e; margin-bottom: 5px;">&#9888;&nbsp; Account Security Notice</div>
          <div style="font-size: 13px; color: #78350f; line-height: 1.6;">
            All previous active sessions have been revoked for your security. You will be prompted to set your own password upon your next login.
          </div>
        </div>
      </div>
    </div>
    """

    html = render_base_email(
        badge_label="Password Updated",
        title="Your Password Has Been Reset",
        subtitle="An administrator has generated a new password for your account.",
        content_html=content_html,
        action_url=login_url,
        action_text="Log In to Portal",
        badge_color="#b91c2b",
    )

    return subject, plain, html


def render_login_otp_email(first_name: str, otp_code: str, expires_minutes: int) -> tuple[str, str, str]:
    """Returns (subject, plain_text, html_content)."""
    subject = "Your Visa House login verification code"

    plain = f"""Hi {first_name},

Your Visa House verification code is:

{otp_code}

This code expires in {expires_minutes} minutes. If you did not try to sign in, ignore this email and contact your administrator.

Best regards,
The Visa House Team
"""

    content_html = f"""
    <p style="margin-top: 0; font-size: 16px; font-weight: 700; color: #0f172a;">Hi {first_name},</p>
    <p>Use this one-time code to complete your <strong>Visa House</strong> login.</p>

    <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 14px; padding: 24px; margin: 24px 0; text-align: center;">
      <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #b91c2b; margin-bottom: 10px;">
        Verification Code
      </div>
      <div style="font-size: 36px; font-weight: 900; letter-spacing: 0.22em; color: #0f172a; line-height: 1;">
        {otp_code}
      </div>
      <div style="font-size: 12px; color: #64748b; margin-top: 14px;">
        Expires in {expires_minutes} minutes
      </div>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #b91c2b; border-radius: 8px; padding: 16px 18px; margin: 24px 0;">
      <div style="font-size: 13.5px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
        Security Notice
      </div>
      <div style="font-size: 13px; color: #64748b; line-height: 1.5;">
        If you did not request this code, do not share it with anyone. Your account remains protected.
      </div>
    </div>
    """

    html = render_base_email(
        badge_label="Login OTP",
        title="Verify Your Login",
        subtitle="Secure one-time code for your Visa House account.",
        content_html=content_html,
        badge_color="#b91c2b",
    )

    return subject, plain, html


def render_register_otp_email(first_name: str, otp_code: str, expires_minutes: int) -> tuple[str, str, str]:
    """Returns (subject, plain_text, html_content)."""
    subject = "Verify your email address for Visa House"

    plain = f"""Hi {first_name},

Thank you for registering with Visa House!

Your email verification code is:

{otp_code}

This code expires in {expires_minutes} minutes. If you did not create an account, you can safely ignore this email.

Best regards,
The Visa House Team
"""

    content_html = f"""
    <p style="margin-top: 0; font-size: 16px; font-weight: 700; color: #0f172a;">Hi {first_name},</p>
    <p>Thank you for creating an account with <strong>Visa House</strong>. To complete your registration and activate your student portal, please verify your email address.</p>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 24px; margin: 24px 0; text-align: center;">
      <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #15803d; margin-bottom: 10px;">
        Verification Code
      </div>
      <div style="font-size: 36px; font-weight: 900; letter-spacing: 0.22em; color: #0f172a; line-height: 1;">
        {otp_code}
      </div>
      <div style="font-size: 12px; color: #64748b; margin-top: 14px;">
        Expires in {expires_minutes} minutes
      </div>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 16px 18px; margin: 24px 0;">
      <div style="font-size: 13.5px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
        Account Security
      </div>
      <div style="font-size: 13px; color: #64748b; line-height: 1.5;">
        If you didn't attempt to register an account, please ignore this message.
      </div>
    </div>
    """

    html = render_base_email(
        badge_label="Email Verification",
        title="Verify Your Email",
        subtitle="Activate your new Visa House account.",
        content_html=content_html,
        badge_color="#15803d",
    )

    return subject, plain, html


def render_institute_application_received_email(
    first_name: str,
    institute_name: str,
) -> tuple[str, str, str]:
    """Acknowledges a public institute application so the applicant knows the
    form went somewhere. Deliberately promises review, not approval."""
    subject = "We've received your Visa House institute application"
    body_lines = (
        f"Thanks for applying to run {institute_name} on Visa House. Your application is "
        "with our team now."
    )
    plain = f"""Hi {first_name},

{body_lines}

We review applications by hand, usually within two working days. If it is approved
you will receive a second email with login details for your institute admin account,
and you can choose a plan from there.

There is nothing you need to do in the meantime.

- The Visa House team
"""
    html = render_base_email(
        badge_label="APPLICATION RECEIVED",
        title="Thanks for applying",
        subtitle=institute_name,
        content_html=f"""
          <p style="margin:0 0 16px 0; font-size:15px; line-height:1.6;">Hi {first_name},</p>
          <p style="margin:0 0 16px 0; font-size:15px; line-height:1.6;">{body_lines}</p>
          <p style="margin:0 0 16px 0; font-size:15px; line-height:1.6;">
            We review applications by hand, usually within two working days. If it is approved
            you will receive a second email with login details for your institute admin account,
            and you can choose a plan from there.
          </p>
          <p style="margin:0; font-size:15px; line-height:1.6; color:#475569;">
            There is nothing you need to do in the meantime.
          </p>
        """,
    )
    return subject, plain, html


def render_institute_application_rejected_email(
    first_name: str,
    institute_name: str,
    reason: str,
) -> tuple[str, str, str]:
    """Declines an application, carrying the reviewer's own words.

    The reason is shown verbatim rather than softened - an applicant who is
    told why can fix it and reapply, which a generic decline never allows.
    """
    subject = "About your Visa House institute application"
    plain = f"""Hi {first_name},

Thank you for your interest in running {institute_name} on Visa House.

We are not able to approve your application at this time.

Reason given by our team:
{reason}

If you believe this was a mistake, or your circumstances change, you are welcome to
reply to this email or apply again.

- The Visa House team
"""
    html = render_base_email(
        badge_label="APPLICATION UPDATE",
        title="We couldn't approve this application",
        subtitle=institute_name,
        badge_color="#475569",
        content_html=f"""
          <p style="margin:0 0 16px 0; font-size:15px; line-height:1.6;">Hi {first_name},</p>
          <p style="margin:0 0 16px 0; font-size:15px; line-height:1.6;">
            Thank you for your interest in running {institute_name} on Visa House.
            We are not able to approve your application at this time.
          </p>
          <div style="margin:0 0 20px 0; padding:14px 16px; background-color:#f8fafc; border-left:3px solid #94a3b8; border-radius:6px;">
            <div style="font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#64748b; margin-bottom:6px;">Reason given by our team</div>
            <div style="font-size:14px; line-height:1.6; color:#0f172a;">{reason}</div>
          </div>
          <p style="margin:0; font-size:15px; line-height:1.6; color:#475569;">
            If you believe this was a mistake, or your circumstances change, you are welcome to
            reply to this email or apply again.
          </p>
        """,
    )
    return subject, plain, html


def render_payment_invoice_email(
    invoice_number: str,
    customer_name: str,
    plan_name: str,
    final_amount: str,
    amount_paid: str,
    due_amount: str,
    currency: str,
    status_label: str,
    gateway_ref: str | None,
    issue_date: str,
    custom_message: str | None = None,
) -> tuple[str, str, str]:
    """Generates an official, luxury branded payment receipt email without external online links."""
    subject = f"Invoice & Payment Receipt #{invoice_number} - Visa House"
    curr_symbol = "₹" if currency.upper() in ["INR", "₹"] else f"{currency} "
    
    plain_custom = f"\nNote from Visa House:\n{custom_message}\n" if custom_message else ""
    plain = f"""Hi {customer_name},

Thank you for your payment to Visa House LMS. Here is your official invoice and payment receipt.

Invoice Number: {invoice_number}
Issue Date: {issue_date}
Item / Plan: {plan_name}
Total Amount: {curr_symbol}{final_amount}
Amount Paid: {curr_symbol}{amount_paid}
Balance Due: {curr_symbol}{due_amount}
Status: {status_label.upper()}
{f"Reference: {gateway_ref}" if gateway_ref else ""}
{plain_custom}
If you have any billing questions, please contact support@visahouse.com.

- Visa House LMS Billing Team
"""

    custom_block_html = ""
    if custom_message:
        custom_block_html = f"""
        <div style="margin: 0 0 24px 0; padding: 14px 18px; background-color: #fff8f8; border-left: 3.5px solid #a31c28; border-radius: 6px;">
          <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #a31c28; margin-bottom: 4px;">Message from Visa House</div>
          <div style="font-size: 14px; line-height: 1.6; color: #334155;">{custom_message}</div>
        </div>
        """

    content_html = f"""
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6;">Hi {customer_name},</p>
      <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #475569;">
        Thank you for your business. Please find below the details of your official invoice and payment receipt.
      </p>

      {custom_block_html}

      <!-- Receipt Summary Card -->
      <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 24px; overflow: hidden;">
        <tr>
          <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; background-color: #f1f5f9;">
            <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Invoice Summary</td>
                <td align="right" style="font-size: 12px; font-weight: 800; color: #a31c28; font-family: monospace;">{invoice_number}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 16px 18px;">
            <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Description:</td>
                <td align="right" style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #0f172a;">{plan_name}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Issue Date:</td>
                <td align="right" style="padding: 6px 0; font-size: 13px; color: #0f172a;">{issue_date}</td>
              </tr>
              {f'<tr><td style="padding: 6px 0; font-size: 13px; color: #64748b;">Transaction Reference:</td><td align="right" style="padding: 6px 0; font-size: 12px; font-family: monospace; color: #0f172a;">{gateway_ref}</td></tr>' if gateway_ref else ''}
              <tr>
                <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Payment Status:</td>
                <td align="right" style="padding: 6px 0; font-size: 12px; font-weight: 800; color: #059669; text-transform: uppercase;">{status_label}</td>
              </tr>
              <tr>
                <td colspan="2" style="padding-top: 12px; border-top: 1.5px dashed #cbd5e1;"></td>
              </tr>
              <tr>
                <td style="padding: 4px 0; font-size: 13px; color: #64748b;">Total Amount:</td>
                <td align="right" style="padding: 4px 0; font-size: 13px; font-weight: 700; color: #0f172a;">{curr_symbol}{final_amount}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; font-size: 13px; color: #64748b;">Amount Paid:</td>
                <td align="right" style="padding: 4px 0; font-size: 13px; font-weight: 700; color: #059669;">{curr_symbol}{amount_paid}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0 0 0; font-size: 14px; font-weight: 800; color: #0f172a;">Balance Outstanding:</td>
                <td align="right" style="padding: 8px 0 0 0; font-size: 15px; font-weight: 800; color: {'#dc2626' if float(due_amount or 0) > 0 else '#0f172a'};">{curr_symbol}{due_amount}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #64748b;">
        If you have any questions regarding this invoice, please reach out to our billing team at <a href="mailto:support@visahouse.com" style="color: #a31c28; text-decoration: none; font-weight: 600;">support@visahouse.com</a>.
      </p>
    """

    html = render_base_email(
        badge_label="OFFICIAL RECEIPT",
        title=f"Invoice {invoice_number}",
        subtitle=f"Payment Receipt for {plan_name}",
        badge_color="#a31c28",
        content_html=content_html,
        action_url=None,
        action_text=None,
    )
    return subject, plain, html


def render_account_status_email(
    first_name: str,
    email: str,
    active: bool,
) -> tuple[str, str, str]:
    """Returns (subject, plain_text, html_content) for account deactivation or reactivation."""
    if active:
        subject = "Your Visa House Account Access Has Been Restored"
        plain = f"""Hi {first_name},

Great news! Your Visa House account ({email}) has been reactivated by an administrator.

You can now log in to the portal to continue your preparation, take assessments, and view your progress.

Warm regards,
The Visa House Team
"""
        content_html = f"""
        <p style="margin-top: 0; font-size: 15px; color: #334155; line-height: 1.6;">
          Hi <strong style="color: #0f172a;">{first_name}</strong>,
        </p>
        <p style="font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 16px 0;">
          Great news! Your Visa House account (<strong style="color: #0f172a;">{email}</strong>) has been reactivated by an administrator.
        </p>
        <p style="font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 16px 0;">
          You can now log in to access your modules, practice exams, and learning dashboard.
        </p>
        """
        html = render_base_email(
            badge_label="ACCOUNT RESTORED",
            title="Account Reactivated",
            subtitle="Your account access has been successfully restored.",
            content_html=content_html,
            action_url=None,
            action_text=None,
            badge_color="#059669",
        )
    else:
        subject = "Important: Your Visa House Account Has Been Deactivated"
        plain = f"""Hi {first_name},

This is an official notice to inform you that your Visa House account ({email}) has been deactivated by an administrator.

All active sessions have been revoked and your portal access has been suspended.

If you believe this was done in error or have questions regarding your account status, please contact your institute administrator or our support team.

Warm regards,
The Visa House Team
"""
        content_html = f"""
        <p style="margin-top: 0; font-size: 15px; color: #334155; line-height: 1.6;">
          Dear <strong style="color: #0f172a;">{first_name}</strong>,
        </p>
        <p style="font-size: 15px; color: #334155; line-height: 1.7; margin: 0 0 16px 0;">
          This is an official notice to inform you that your Visa House account (<strong style="color: #0f172a;">{email}</strong>) has been deactivated by an administrator.
        </p>
        <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 18px; margin: 16px 0 20px 0;">
          <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #9f1239;">
            Account status update:
          </p>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #4c0519; line-height: 1.6;">
            <li>All active login sessions have been immediately signed out.</li>
            <li>Access to exams, practice tests, and student portals has been suspended.</li>
          </ul>
        </div>
        <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin: 0;">
          If you believe this was done in error or have questions regarding your access, please contact your institute administrator or our support team.
        </p>
        """
        html = render_base_email(
            badge_label="ACCOUNT NOTICE",
            title="Account Deactivated",
            subtitle="Your account access has been disabled by an administrator.",
            content_html=content_html,
            action_url=None,
            action_text=None,
            badge_color="#b91c2b",
        )
    return subject, plain, html


