import logging

from sqlalchemy.orm import Session

from app.models.attempt import TestAttempt
from app.services import smtp_service

logger = logging.getLogger(__name__)


def send_grade_released_email(db: Session, attempt: TestAttempt) -> None:
    """Best-effort notification once a Writing/Speaking submission is fully
    graded - failure (unconfigured SMTP, network error, ...) is logged and
    never raised, so it can never block the grading response the instructor
    is waiting on."""
    try:
        user = attempt.user
        module = attempt.module
        lines = [
            f"Hi {user.first_name},",
            "",
            f'Your submission for "{module.title}" has been graded.',
        ]
        if attempt.max_score is not None:
            lines.append(f"Score: {attempt.raw_score} / {attempt.max_score}")
        if attempt.band_label:
            lines.append(f"Band: {attempt.band_label}")
        lines += ["", "Log in to the student portal to see the full breakdown."]
        smtp_service.send_email(db, user.email, f'Your "{module.title}" result is ready', "\n".join(lines))
    except Exception:
        logger.exception("Failed to send grade-released email for attempt %s", attempt.id)
