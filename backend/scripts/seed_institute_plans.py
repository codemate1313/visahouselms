"""Seed the four standard institute tiers: Lite, Standard, Premium, Elite.

Safe to run repeatedly - plans are matched by name, so a second run updates the
existing rows rather than creating duplicates. Institutes that are already
subscribed are untouched: a subscription copies the terms it was cut with, so
editing a plan here never silently rewrites a running agreement.

The ladder is built around seats, which is the only thing these plans meter:

    Lite      15 students,  0 instructors   - a coaching desk that grades nothing
    Standard  60 students,  4 instructors   - a single-branch centre
    Premium  200 students, 15 instructors   - a multi-branch institute
    Elite    600 students, 50 instructors   - a chain

Test attempts are deliberately unmetered on every tier (test_limit=0 reads as
"unlimited" in the plan feature list). Lite carries no instructor seats at all,
so its students get auto-marked Listening and Reading plus AI evaluation on
Writing and Speaking - there is nobody on staff to hand-grade for them.

Run:  python backend/scripts/seed_institute_plans.py
"""

from __future__ import annotations

import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal  # noqa: E402
from app.models.plan import AUDIENCE_INSTITUTES, Plan  # noqa: E402


TIERS = [
    {
        "name": "Lite",
        "description": "Self-marking practice for a small coaching desk. No instructor seats.",
        "price": Decimal("14999.00"),
        "student_limit": 15,
        "staff_limit": 0,
        "features": [
            "15 student seats",
            "No instructor seats - auto-marked and AI-evaluated only",
            "Unlimited mock tests",
            "Listening & Reading marked instantly",
            "AI evaluation on Writing & Speaking",
            "Student progress dashboard",
        ],
    },
    {
        "name": "Standard",
        "description": "A single-branch centre with a small teaching team.",
        "price": Decimal("39999.00"),
        "student_limit": 60,
        "staff_limit": 4,
        "features": [
            "60 student seats",
            "4 instructor seats",
            "Unlimited mock tests",
            "Instructor grading with CEFR rubrics",
            "AI evaluation with instructor review",
            "Branch-wide reporting",
        ],
    },
    {
        "name": "Premium",
        "description": "A multi-branch institute running full mock cycles.",
        "price": Decimal("89999.00"),
        "student_limit": 200,
        "staff_limit": 15,
        "features": [
            "200 student seats",
            "15 instructor seats",
            "Unlimited mock tests",
            "Full grading workflow with retake control",
            "Priority AI evaluation",
            "Cohort analytics and export",
            "Announcements and bulk student import",
        ],
    },
    {
        "name": "Elite",
        "description": "A chain operating at scale across cities.",
        "price": Decimal("199999.00"),
        "student_limit": 600,
        "staff_limit": 50,
        "features": [
            "600 student seats",
            "50 instructor seats",
            "Unlimited mock tests",
            "Full grading workflow with retake control",
            "Highest AI evaluation allowance",
            "Cohort analytics and export",
            "Priority support and onboarding assistance",
        ],
    },
]

DURATION_DAYS = 365
GRACE_DAYS = 7


def seed() -> None:
    db = SessionLocal()
    try:
        for tier in TIERS:
            plan = db.query(Plan).filter(Plan.name == tier["name"]).first()
            created = plan is None
            if plan is None:
                plan = Plan(name=tier["name"])
                db.add(plan)

            plan.description = tier["description"]
            plan.price = tier["price"]
            plan.currency = "INR"
            plan.duration_days = DURATION_DAYS
            plan.student_limit = tier["student_limit"]
            plan.staff_limit = tier["staff_limit"]
            # 0 renders as "Unlimited mock tests" - attempts are never capped.
            plan.test_limit = 0
            plan.grace_days = GRACE_DAYS
            plan.is_active = True
            plan.audience = AUDIENCE_INSTITUTES
            plan.is_published = True
            plan.is_internal = False
            plan.features = tier["features"]

            print(
                f"{'created' if created else 'updated'}  {plan.name:<9} "
                f"₹{plan.price:>12,.2f}  {plan.student_limit:>3} students  "
                f"{plan.staff_limit:>2} instructors"
            )

        db.commit()
        print("\nDone. These now appear as renewal options on every institute's billing page.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
