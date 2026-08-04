"""Seed an institute admin who has never bought a plan.

This is the state a public application lands in the moment a Super Admin
approves it: a real institute, a real admin who can sign in, and no
subscription behind either of them. Seats resolve to nothing without an active
plan, so the portal holds this account in the setup wizard until a tier is
chosen and paid for - which is exactly what this account exists to exercise.

    Email:    unpaid.institute@example.com
    Password: Test@12345

Safe to run repeatedly. Any subscription that somehow exists for this institute
is deleted, because an account that quietly acquired a plan would stop testing
the thing it was made to test.

Run:  python backend/scripts/seed_unpaid_institute.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import hash_password  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models.institute import Institute  # noqa: E402
from app.models.institute_branding import InstituteBranding  # noqa: E402
from app.models.role import INSTITUTE_ADMIN, Role  # noqa: E402
from app.models.subscription import Subscription  # noqa: E402
from app.models.user import User  # noqa: E402

PASSWORD = "Test@12345"
ADMIN_EMAIL = "unpaid.institute@example.com"
INSTITUTE_NAME = "Unpaid Test Institute"
INSTITUTE_SLUG = "unpaid-test-institute"


def main() -> None:
    db = SessionLocal()
    try:
        role = db.query(Role).filter(Role.name == INSTITUTE_ADMIN).first()
        if role is None:
            raise RuntimeError("Roles are not seeded; run Alembic migrations first")

        institute = db.query(Institute).filter(Institute.slug == INSTITUTE_SLUG).first()
        created_institute = institute is None
        if institute is None:
            institute = Institute(name=INSTITUTE_NAME, slug=INSTITUTE_SLUG)
            db.add(institute)

        # Active and published: the admin has to be able to sign in. What stops
        # them doing anything is the missing subscription, not a disabled flag.
        institute.name = INSTITUTE_NAME
        institute.contact_email = ADMIN_EMAIL
        institute.is_active = True
        institute.onboarding_status = "published"
        institute.session_duration_hours = 24
        # Limits come from the plan, so these stay empty until one is bought.
        institute.student_limit = None
        institute.staff_limit = None
        institute.test_limit = None
        db.flush()

        if db.query(InstituteBranding).filter(InstituteBranding.institute_id == institute.id).first() is None:
            db.add(InstituteBranding(institute_id=institute.id))

        removed = (
            db.query(Subscription)
            .filter(Subscription.institute_id == institute.id)
            .delete(synchronize_session=False)
        )

        admin = db.query(User).filter(User.email == ADMIN_EMAIL).first()
        created_admin = admin is None
        if admin is None:
            admin = User(email=ADMIN_EMAIL)
            db.add(admin)

        admin.password_hash = hash_password(PASSWORD)
        admin.role_id = role.id
        admin.institute_id = institute.id
        admin.first_name = "Unpaid"
        admin.last_name = "Admin"
        admin.is_active = True
        admin.deleted_at = None
        # A real approval forces a password change on first sign-in. Skipped
        # here so the account drops straight into the wizard being tested.
        admin.force_password_reset = False

        db.commit()

        print(f"{'created' if created_institute else 'updated'}  institute  {INSTITUTE_NAME} (id={institute.id})")
        print(f"{'created' if created_admin else 'updated'}  admin      {ADMIN_EMAIL}")
        if removed:
            print(f"removed  {removed} subscription(s) - this account must stay unpaid")
        print(f"\nSign in at /login as {ADMIN_EMAIL} / {PASSWORD}")
        print("Expect: redirected to /institute-portal/setup, no seats, plan picker + payment.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
