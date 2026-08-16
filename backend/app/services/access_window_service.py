"""Per-student access windows, and the seat each student occupies.

An institute buys a fixed number of seats for a fixed term. A student account
had neither an end date nor any state between "in use" and "deleted", so a seat
was taken forever once given, and the only way to reclaim one was to delete the
student - which releases their email and blocks them from ever coming back.

This module owns the whole of that model. The rules it enforces, in the order
they matter:

1.  A seat is released ONLY by an explicit admin action (`release_seat`). A date
    passing never releases one. If it did, an admin could edit an end date
    backwards, watch the sweep free the seat, fill it, then edit the date
    forward again - and be over their cap with nothing to show for it.

2.  Releasing is not deleting. A released student keeps their row, their email,
    their attempts and their results, and stays searchable, so a returner can be
    found and reactivated years later.

3.  Reactivating a released student takes a seat, and is refused when there is
    none free - the same 402 as creating one.

4.  A window can never outlive the institute's own subscription. Renew, and
    student windows may be extended to the new expiry; lapse, and nothing keeps
    running on a term nobody paid for.

5.  Dates are resolved at end of day in the INSTITUTE's timezone. "Ends 31
    March" for a Delhi institute must not cut a student off at 05:30 on the
    31st, which is what midnight UTC means there.

6.  The sweep never touches a student with a test in progress. Access is checked
    on every request, so flipping the flag mid-exam logs them out, loses the
    recording and destroys the sitting.
"""

from datetime import date, datetime, time, timedelta, timezone
from typing import Optional, Tuple
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.attempt import ATTEMPT_IN_PROGRESS, TestAttempt
from app.models.audit_log import AuditLog
from app.models.institute import Institute
from app.models.role import STUDENT
from app.models.user import (
    ACCESS_ACTIVE,
    ACCESS_EXPIRED,
    ACCESS_RELEASED,
    ACCESS_SUSPENDED,
    User,
)

# Institutes without an explicit timezone are read in this one. The product is
# sold in INR to Indian institutes; UTC would silently cut every one of them off
# five and a half hours early on the last day of a window.
DEFAULT_TIMEZONE = "Asia/Kolkata"

# A window has to be long enough to be worth a seat, and short enough that a
# typo cannot grant a decade.
MIN_WINDOW_DAYS = 1
MAX_WINDOW_DAYS = 3653  # ten years, as a typo guard rather than a policy


def _naive_utc(value: datetime) -> datetime:
    """The database stores naive UTC; everything here normalises to that."""
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ---------------------------------------------------------------- timezones


def institute_timezone(institute: Optional[Institute]) -> ZoneInfo:
    name = getattr(institute, "timezone", None) or DEFAULT_TIMEZONE
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        # A bad value in the column must not take the institute offline.
        return ZoneInfo(DEFAULT_TIMEZONE)


def start_of_day_utc(day: date, tz: ZoneInfo) -> datetime:
    """00:00 local on `day`, as naive UTC."""
    return _naive_utc(datetime.combine(day, time.min, tzinfo=tz))


def end_of_day_utc(day: date, tz: ZoneInfo) -> datetime:
    """23:59:59 local on `day`, as naive UTC.

    The last day of a window is a day the student still has, in the timezone
    they live in. Storing midnight would take it away from them.
    """
    return _naive_utc(datetime.combine(day, time.max, tzinfo=tz))


def to_local_date(value: Optional[datetime], tz: ZoneInfo) -> Optional[date]:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc).astimezone(tz).date()


# ------------------------------------------------------------ subscriptions


def subscription_ceiling(db: Session, institute_id: int) -> Optional[datetime]:
    """The furthest a student's window may reach: the institute's own expiry.

    Grace days are deliberately excluded. Grace keeps an institute working while
    a renewal clears; it is not term the student was sold.
    """
    from app.services import subscription_service

    institute = db.get(Institute, institute_id)
    if institute is not None and institute.onboarding_status == "draft":
        # Still onboarding, no subscription row yet. The agreed access duration
        # from the signup paperwork is the ceiling.
        days = institute.access_duration_days or 365
        return now_utc() + timedelta(days=days)

    # The furthest-running live term, not the one a billing screen calls
    # "current". An institute that stacked a second plan has paid for access to
    # that later date, and a student window must be allowed to reach it.
    live = subscription_service.live_subscriptions(db, institute_id=institute_id)
    if live:
        return max(row.expires_at for row in live)

    subscription, _state = subscription_service.current_subscription(db, institute_id)
    if subscription is None:
        return None
    return subscription.expires_at


# ------------------------------------------------------------- the window


def resolve_window(
    db: Session,
    institute_id: int,
    starts_on: date,
    ends_on: date,
    *,
    allow_past_start: bool = False,
) -> Tuple[datetime, datetime]:
    """Turn two calendar dates from an admin into a stored UTC window.

    Raises 400 for anything that cannot be honoured, and 400 rather than
    silently trimming when the window would outlive the subscription - an admin
    who asks for a date they cannot have should be told, not quietly given a
    different one.
    """
    institute = db.get(Institute, institute_id)
    tz = institute_timezone(institute)

    if ends_on < starts_on:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The access end date cannot be before the start date.",
        )

    span = (ends_on - starts_on).days + 1
    if span < MIN_WINDOW_DAYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Access must run for at least one day.",
        )
    if span > MAX_WINDOW_DAYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Access cannot be granted for more than ten years.",
        )

    starts_at = start_of_day_utc(starts_on, tz)
    ends_at = end_of_day_utc(ends_on, tz)

    if not allow_past_start and ends_at <= now_utc():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The access end date is already in the past.",
        )

    ceiling = subscription_ceiling(db, institute_id)
    if ceiling is None:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                "This institute has no active subscription. "
                "Purchase or renew a plan before granting student access."
            ),
        )
    if ends_at > ceiling:
        last_day = to_local_date(ceiling, tz)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Student access cannot run past the institute's subscription, "
                f"which ends on {last_day:%d %b %Y}. Renew the subscription to "
                "grant access beyond that date."
            ),
        )

    return starts_at, ends_at


# ------------------------------------------------------------------ state


def is_window_open(user: User, now: Optional[datetime] = None) -> bool:
    now = now or now_utc()
    if user.access_starts_at is not None and now < user.access_starts_at:
        return False
    if user.access_ends_at is not None and now > user.access_ends_at:
        return False
    return True


def access_denied_reason(user: User, now: Optional[datetime] = None) -> Optional[str]:
    """Why this account cannot be used right now, in words a student can act on.

    Returns None when access is fine. Only students carry windows; staff and
    B2C users fall straight through.
    """
    if user.role is None or user.role.name != STUDENT or user.institute_id is None:
        return None

    now = now or now_utc()
    tz = institute_timezone(user.institute)

    if user.access_state == ACCESS_RELEASED:
        return (
            "Your seat with this institute has been released. "
            "Contact your institute to be enrolled again."
        )
    if user.access_state == ACCESS_SUSPENDED:
        return "Your account has been deactivated by your institute. Contact them to restore it."

    if user.access_starts_at is not None and now < user.access_starts_at:
        first_day = to_local_date(user.access_starts_at, tz)
        return f"Your access starts on {first_day:%d %b %Y}."

    if user.access_ends_at is not None and now > user.access_ends_at:
        last_day = to_local_date(user.access_ends_at, tz)
        return (
            f"Your access ended on {last_day:%d %b %Y}. "
            "Contact your institute to extend it."
        )

    return None


def serialize_access(user: User) -> dict:
    """The window as the admin UI needs it."""
    tz = institute_timezone(user.institute)
    now = now_utc()
    starts_on = to_local_date(user.access_starts_at, tz)
    ends_on = to_local_date(user.access_ends_at, tz)
    days_left = None
    if user.access_ends_at is not None and user.access_state != ACCESS_RELEASED:
        days_left = (user.access_ends_at - now).days
    return {
        "access_state": user.access_state,
        "access_starts_on": starts_on.isoformat() if starts_on else None,
        "access_ends_on": ends_on.isoformat() if ends_on else None,
        "holds_seat": user.access_state != ACCESS_RELEASED and user.deleted_at is None,
        "window_open": is_window_open(user, now),
        "days_remaining": days_left,
        "timezone": str(tz),
    }


# ------------------------------------------------------------------ sweep


def students_with_live_attempts(db: Session, user_ids) -> set:
    """Anyone mid-exam. The sweep must leave these alone."""
    if not user_ids:
        return set()
    rows = (
        db.query(TestAttempt.user_id)
        .filter(
            TestAttempt.user_id.in_(list(user_ids)),
            TestAttempt.status == ATTEMPT_IN_PROGRESS,
        )
        .distinct()
        .all()
    )
    return {row[0] for row in rows}


def expire_due_students(db: Session, now: Optional[datetime] = None) -> dict:
    """Move students whose window has closed to `expired`.

    They keep their seat - only an admin release gives that back. What they lose
    is the ability to log in, which is what "locked out entirely" means.

    A student sitting a test is skipped and picked up on the next run. Access is
    re-checked on every request, so expiring them now would 401 their next
    autosave, lose the recording and destroy the sitting.
    """
    now = now or now_utc()

    due = (
        db.query(User)
        .filter(
            User.access_state == ACCESS_ACTIVE,
            User.access_ends_at.isnot(None),
            User.access_ends_at < now,
            User.deleted_at.is_(None),
            User.institute_id.isnot(None),
        )
        .all()
    )
    if not due:
        return {"expired": 0, "skipped_in_exam": 0, "user_ids": []}

    busy = students_with_live_attempts(db, [user.id for user in due])

    expired_ids = []
    for user in due:
        if user.id in busy:
            continue
        user.access_state = ACCESS_EXPIRED
        user.is_active = False
        db.add(user)
        db.add(
            AuditLog(
                user_id=None,
                action="student_access.expired",
                entity_type="user",
                entity_id=user.id,
                ip_address=None,
            )
        )
        expired_ids.append(user.id)

    # Sessions must go, or an already-issued token keeps working until it
    # expires on its own.
    if expired_ids:
        from app.services import account_service

        for user_id in expired_ids:
            account_service.revoke_all_sessions(db, user_id)

    db.commit()
    return {
        "expired": len(expired_ids),
        "skipped_in_exam": len(busy),
        "user_ids": expired_ids,
    }


def open_windows_for_renewal(db: Session, institute_id: int, new_expiry: datetime) -> int:
    """After a renewal, let expired students' windows be extended in bulk.

    Deliberately does NOT reactivate anyone - it only lifts the ceiling so an
    admin can extend windows. Silently restoring access to everyone who ever
    expired would hand seats back to students the institute may have finished
    with.
    """
    return (
        db.query(User)
        .filter(
            User.institute_id == institute_id,
            User.access_state == ACCESS_EXPIRED,
            User.access_ends_at.isnot(None),
            User.access_ends_at < new_expiry,
        )
        .count()
    )
