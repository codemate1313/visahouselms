"""Create predictable local QA accounts and module access.

Safe to run repeatedly. This script only owns accounts using the qa.* email
prefix plus the existing sample instructor created by seed_dummy_modules.py.
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import hash_password  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models.institute import Institute  # noqa: E402
from app.models.instructor_profile import InstructorProfile  # noqa: E402
from app.models.plan import Plan  # noqa: E402
from app.models.role import (  # noqa: E402
    INSTITUTE_ADMIN,
    INST_INSTRUCTOR,
    SA_INSTRUCTOR,
    STUDENT,
    SUPER_ADMIN,
    Role,
)
from app.models.subscription import Subscription  # noqa: E402
from app.models.user import User  # noqa: E402

PASSWORD = "Test@12345"
INSTITUTE_NAME = "QA Institute"
INSTITUTE_SLUG = "qa-institute"
PLAN_NAME = "QA Full Access"
ADMIN_PERMISSIONS = {
    "view_students": True,
    "manage_students": True,
    "view_student_activity": True,
    "manage_student_sessions": True,
    "manage_staff": True,
    "view_billing": True,
}

ACCOUNTS = (
    ("qa.superadmin@example.com", SUPER_ADMIN, None, "QA", "Super Admin"),
    ("sample.instructor@example.com", SA_INSTRUCTOR, None, "Sample", "Instructor"),
    ("qa.institute.admin@example.com", INSTITUTE_ADMIN, INSTITUTE_SLUG, "QA", "Institute Admin"),
    ("qa.student@example.com", STUDENT, INSTITUTE_SLUG, "QA", "Student"),
    ("qa.institute.instructor@example.com", INST_INSTRUCTOR, INSTITUTE_SLUG, "QA", "Institute Instructor"),
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _role(db, name: str) -> Role:
    role = db.query(Role).filter(Role.name == name).first()
    if role is None:
        raise RuntimeError(f"Role {name} is not seeded; run Alembic migrations first")
    return role


def _upsert_account(
    db,
    email: str,
    role_name: str,
    institute: Optional[Institute],
    first_name: str,
    last_name: str,
) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(email=email)
    user.password_hash = hash_password(PASSWORD)
    user.role_id = _role(db, role_name).id
    user.institute_id = institute.id if institute else None
    user.first_name = first_name
    user.last_name = last_name
    user.is_active = True
    user.deleted_at = None
    user.force_password_reset = False
    db.add(user)
    db.flush()

    if role_name == SA_INSTRUCTOR and user.instructor_profile is None:
        db.add(
            InstructorProfile(
                user_id=user.id,
                title="LanguageCert Academic Instructor",
                bio="Local QA instructor for assessment authoring and grading tests.",
            )
        )
    return user


def main() -> None:
    db = SessionLocal()
    try:
        institute = db.query(Institute).filter(Institute.slug == INSTITUTE_SLUG).first()
        if institute is None:
            institute = Institute(
                name=INSTITUTE_NAME,
                slug=INSTITUTE_SLUG,
                contact_email="qa.institute.admin@example.com",
                admin_permissions=ADMIN_PERMISSIONS,
                is_active=True,
            )
            db.add(institute)
            db.flush()
        else:
            institute.name = INSTITUTE_NAME
            institute.contact_email = "qa.institute.admin@example.com"
            institute.admin_permissions = ADMIN_PERMISSIONS
            institute.is_active = True

        from app.models.exam_module import ExamModule

        modules = (
            db.query(ExamModule)
            .filter(ExamModule.status == "published")
            .order_by(ExamModule.id)
            .all()
        )
        if not modules:
            raise RuntimeError("No published modules found; run scripts/seed_dummy_modules.py first")

        plan = db.query(Plan).filter(Plan.name == PLAN_NAME).first()
        if plan is None:
            plan = Plan(
                name=PLAN_NAME,
                description="Full published-module access for local portal testing.",
                price=Decimal("0"),
                currency="INR",
                duration_days=365,
                student_limit=50,
                staff_limit=10,
                test_limit=200,
                grace_days=7,
                is_active=True,
            )
            db.add(plan)
            db.flush()
        plan.modules = modules
        plan.is_active = True

        institute_by_slug = {INSTITUTE_SLUG: institute}
        users = []
        for email, role_name, institute_slug, first_name, last_name in ACCOUNTS:
            users.append(
                _upsert_account(
                    db,
                    email,
                    role_name,
                    institute_by_slug.get(institute_slug),
                    first_name,
                    last_name,
                )
            )

        now = _utcnow()
        active_subscription = (
            db.query(Subscription)
            .filter(
                Subscription.institute_id == institute.id,
                Subscription.cancelled_at.is_(None),
                Subscription.expires_at > now,
            )
            .order_by(Subscription.expires_at.desc())
            .first()
        )
        if active_subscription is None or active_subscription.plan_id != plan.id:
            db.add(
                Subscription(
                    institute_id=institute.id,
                    plan_id=plan.id,
                    starts_at=now,
                    expires_at=now + timedelta(days=plan.duration_days),
                    grace_days=plan.grace_days,
                )
            )

        db.commit()
        print(f"QA credentials ready. Password for every account: {PASSWORD}")
        for user in users:
            print(f"{user.role.name}: {user.email}")
        print(f"Institute: {institute.name}")
        print(f"Plan: {plan.name} ({len(modules)} published modules)")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
