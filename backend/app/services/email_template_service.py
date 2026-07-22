"""Executive, Ultra-Premium Light HTML Email Generator for IELTS LMS.

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
                      IELTS <span style="color: #b91c2b;">LMS</span>
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
                IELTS LMS Platform &bull; Official Account Notification
              </p>
              <p style="margin: 0; font-size: 11.5px; color: #94a3b8; line-height: 1.5;">
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
    subject = f"Welcome to IELTS LMS, {first_name}! 🎉"

    plain = f"""Hi {first_name},

Welcome to IELTS LMS! Your account has been created successfully.

Log in to access your course materials, practice assessments, and mock tests:
{login_url}

Best regards,
The IELTS LMS Team
"""

    content_html = f"""
    <p style="margin-top: 0; font-size: 16px; font-weight: 700; color: #0f172a;">Hi {first_name},</p>
    <p>Welcome aboard! Your <strong>IELTS LMS</strong> student portal account is now active and ready to use.</p>
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
        title=f"Welcome to IELTS LMS, {first_name}!",
        subtitle="Your student portal is now active and ready for your preparation.",
        content_html=content_html,
        action_url=login_url,
        action_text="Log In to Student Portal",
        badge_color="#b91c2b",
    )

    return subject, plain, html


def render_forgot_password_email(first_name: str, reset_url: str) -> tuple[str, str, str]:
    """Returns (subject, plain_text, html_content)."""
    subject = "Reset Your Password — IELTS LMS"

    plain = f"""Hi {first_name},

We received a request to reset your password for your IELTS LMS account.

Click the link below to set a new password (link expires in 30 minutes):
{reset_url}

If you did not request a password reset, please ignore this message.

Best regards,
The IELTS LMS Team
"""

    content_html = f"""
    <p style="margin-top: 0; font-size: 16px; font-weight: 700; color: #0f172a;">Hi {first_name},</p>
    <p>We received a security request to reset the password for your <strong>IELTS LMS</strong> account.</p>
    <p>Click the button below to set up a new password. For security reasons, this link will expire in <strong>30 minutes</strong>.</p>
    
    <!-- Clean Amber Security Callout -->
    <div style="background-color: #fffbe6; border: 1px solid #ffe58f; border-left: 4px solid #faad14; border-radius: 8px; padding: 16px 18px; margin: 24px 0;">
      <div style="font-size: 13.5px; font-weight: 700; color: #873800; margin-bottom: 2px;">
        Security Notice
      </div>
      <div style="font-size: 13px; color: #a15c00; line-height: 1.5;">
        If you did not request a password reset, please ignore this email. Your current password remains completely safe and unchanged.
      </div>
    </div>
    """

    html = render_base_email(
        badge_label="Security Verification",
        title="Password Reset Request",
        subtitle="Secure verification link for your IELTS LMS account.",
        content_html=content_html,
        action_url=reset_url,
        action_text="Reset Password Now",
        badge_color="#b91c2b",
    )

    return subject, plain, html
