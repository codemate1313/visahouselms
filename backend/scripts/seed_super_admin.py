"""Creates the first SUPER_ADMIN account from SUPER_ADMIN_* values in .env.
Safe to re-run: no-ops if that email already exists.

Usage: python scripts/seed_super_admin.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models.role import SUPER_ADMIN, Role  # noqa: E402
from app.models.user import User  # noqa: E402


def main() -> None:
    if not settings.super_admin_email or not settings.super_admin_password:
        print("SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not set in .env, nothing to seed.")
        return

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == settings.super_admin_email).first()
        if existing is not None:
            print(f"Super admin '{settings.super_admin_email}' already exists, skipping.")
            return

        role = db.query(Role).filter(Role.name == SUPER_ADMIN).first()
        if role is None:
            print("SUPER_ADMIN role not found - run 'alembic upgrade head' first.")
            sys.exit(1)

        user = User(
            email=settings.super_admin_email,
            password_hash=hash_password(settings.super_admin_password),
            role_id=role.id,
            institute_id=None,
            first_name=settings.super_admin_first_name,
            last_name=settings.super_admin_last_name,
            is_active=True,
        )
        db.add(user)
        db.commit()
        print(f"Created super admin '{settings.super_admin_email}'.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
