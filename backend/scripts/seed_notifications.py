"""Seed inbox notifications for the local QA accounts.

Every portal (Super Admin, SA Instructor, Institute Admin, Institute
Instructor, Student) shares the same `/notifications` inbox, so this gives
each role a realistic, role-appropriate feed to look at - including a couple
of already-read items and one already-pinned item so the pin list renders
both of its groups out of the box.

Safe to run repeatedly: notifications are matched on (user, title) and
updated in place rather than duplicated.

Usage:
    python scripts/seed_notifications.py
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.database import SessionLocal  # noqa: E402
from app.models.notification import ANNOUNCEMENT_PUBLISHED, StudentNotification  # noqa: E402
from app.models.user import User  # noqa: E402


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


NOW = _utcnow()


def _ago(**kwargs) -> datetime:
    return NOW - timedelta(**kwargs)


# (title, message, link_url, age, read, pinned)
FEEDS: dict[str, tuple] = {
    "qa.superadmin@example.com": (
        ("Platform revenue crossed ₹12,00,000 this cycle",
         "Monthly recurring revenue is up 18% against last cycle. Three institute plans renewed early.",
         "/super-admin/revenue", {"minutes": 25}, False, True),
        ("Meridian Institute submitted an onboarding request",
         "A new institute has completed the onboarding form and is waiting on plan assignment and branding review.",
         "/super-admin/onboarding", {"hours": 2}, False, False),
        ("4 payments failed in the last 24 hours",
         "Retry attempts were exhausted for four subscriptions. Review the payment log and contact the institutes.",
         "/super-admin/payments", {"hours": 6}, False, False),
        ("Cambridge Point upgraded to the annual plan",
         "The subscription switched from monthly to annual billing. Proration has been applied automatically.",
         "/super-admin/subscriptions", {"days": 1}, True, False),
        ("Grading oversight: 12 submissions past SLA",
         "Twelve writing and speaking submissions have been awaiting grading for more than 48 hours.",
         "/super-admin/grading", {"days": 2}, True, False),
    ),
    "sample.instructor@example.com": (
        ("9 submissions are waiting in your grading queue",
         "Five writing tasks and four speaking responses have been assigned to you for review.",
         "/super-admin/instructor/grading", {"minutes": 40}, False, True),
        ("Listening Practice Test 3 was published",
         "Your module passed review and is now live for all institutes on the platform.",
         "/super-admin/instructor/modules", {"hours": 5}, False, False),
        ("Reminder: Academic Writing Task 2 draft is incomplete",
         "This module has been in draft for nine days. Finish the rubric to publish it.",
         "/super-admin/instructor/modules", {"days": 3}, True, False),
        ("Speaking Mock 2 average band dropped to 6.4",
         "The cohort average fell 0.6 bands against the previous run - worth checking the audio prompts.",
         "/super-admin/instructor/dashboard", {"days": 4}, True, False),
    ),
    "qa.institute.admin@example.com": (
        ("Your plan renews in 6 days",
         "The QA Full Access plan renews automatically. Review seats and billing details before the renewal date.",
         "/institute-portal/billing", {"hours": 1}, False, True),
        ("14 new students joined this week",
         "Fourteen students completed registration and were added to your institute roster.",
         "/institute-portal/students", {"hours": 4}, False, False),
        ("Batch A average band improved to 7.2",
         "Your latest mock cycle is up 0.4 bands against the previous one, led by gains in Listening.",
         "/institute-portal/dashboard", {"days": 1}, False, False),
        ("Announcement 'Mock week schedule' was published",
         "Your announcement reached 128 students across the institute.",
         "/institute-portal/announcements", {"days": 2}, True, False),
        ("Instructor seat limit almost reached",
         "You are using 5 of 5 instructor seats. Add seats to onboard more staff.",
         "/institute-portal/staff", {"days": 5}, True, False),
    ),
    "qa.institute.instructor@example.com": (
        ("7 submissions are waiting for your feedback",
         "Four writing tasks and three speaking responses from your batches need grading.",
         "/institute-instructor/grading", {"minutes": 15}, False, True),
        ("Priya Nair resubmitted Writing Task 2",
         "The student uploaded a revised response after your rubric feedback.",
         "/institute-instructor/grading", {"hours": 3}, False, False),
        ("Mock week starts on Monday",
         "Your institute admin scheduled a full mock cycle. Expect a spike in grading volume.",
         "/institute-instructor/grading", {"days": 1}, False, False),
        ("You graded 23 submissions last week",
         "Your median turnaround was 9 hours - the fastest on your institute's team.",
         "/institute-instructor/grading", {"days": 6}, True, False),
    ),
    "qa.student@example.com": (
        ("Your Writing Task 2 result is ready",
         "Your instructor has completed this assessment. Review your score, rubric feedback, and detailed analysis.",
         "/student/attempts", {"minutes": 8}, False, True),
        ("Mock week starts Monday - 4 tests scheduled",
         "Your institute has scheduled a full mock cycle covering all four modules.",
         "/student/announcements", {"hours": 3}, False, False),
        ("Speaking Practice 2 is now available",
         "A new speaking module was added to your course. Recording opens for the next 14 days.",
         "/student/my-courses", {"hours": 9}, False, False),
        ("You are 2 tests away from your monthly goal",
         "Complete two more practice tests before the end of the month to hit your target.",
         "/student/progress", {"days": 2}, True, False),
        ("Your Listening Practice 1 result is ready",
         "Score released with a full section-by-section breakdown and answer review.",
         "/student/attempts", {"days": 4}, True, False),
        ("Welcome to Visa House",
         "Your account is active. Start with a diagnostic test so we can calibrate your study plan.",
         "/student/dashboard", {"days": 12}, True, False),
    ),
}


def seed_notifications() -> None:
    db = SessionLocal()
    created = updated = 0
    try:
        for email, rows in FEEDS.items():
            user = db.query(User).filter(User.email == email).first()
            if user is None:
                print(f"--> Skipped {email} (account not found - run seed_test_credentials.py first)")
                continue

            for title, message, link_url, age, read, pinned in rows:
                created_at = _ago(**age)
                notification = (
                    db.query(StudentNotification)
                    .filter(
                        StudentNotification.user_id == user.id,
                        StudentNotification.title == title,
                    )
                    .first()
                )
                if notification is None:
                    notification = StudentNotification(user_id=user.id, title=title)
                    db.add(notification)
                    created += 1
                else:
                    updated += 1
                notification.kind = ANNOUNCEMENT_PUBLISHED
                notification.message = message
                notification.link_url = link_url
                notification.created_at = created_at
                notification.read_at = created_at + timedelta(minutes=30) if read else None
                notification.pinned_at = NOW if pinned else None

            print(f"--> {email}: {len(rows)} notifications")

        db.commit()
        print(f"\nNotification seed complete - {created} created, {updated} refreshed.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_notifications()
