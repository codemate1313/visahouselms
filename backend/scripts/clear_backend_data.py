"""Clear all application data from the backend database while preserving roles, 
alembic version, and the owner super admin account.

Usage:
    python scripts/clear_backend_data.py
"""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import inspect, text
from app.config import settings
from app.database import engine, SessionLocal
from app.models.role import SUPER_ADMIN, Role
from app.models.user import User
import scripts.seed_super_admin as seed_super_admin


def main() -> None:
    db = SessionLocal()

    try:
        # First ensure owner super admin exists
        seed_super_admin.main()

        owner_user = (
            db.query(User).filter(User.is_owner.is_(True)).first()
            or db.query(User).filter(User.email == settings.super_admin_email).first()
        )

        if not owner_user:
            print("Error: Could not find or create owner super admin account.")
            sys.exit(1)

        owner_id = owner_user.id
        owner_email = owner_user.email
        print(f"Preserving Owner Super Admin: ID {owner_id} ({owner_email})")

        inspector = inspect(engine)
        all_tables = inspector.get_table_names()

        # Tables to preserve completely
        preserved_tables = {"alembic_version", "roles"}

        dialect_name = engine.dialect.name
        print(f"Database dialect: {dialect_name}")

        with engine.begin() as conn:
            if dialect_name == "mysql":
                conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
            elif dialect_name == "sqlite":
                conn.execute(text("PRAGMA foreign_keys = OFF;"))

            for table in all_tables:
                if table in preserved_tables:
                    continue
                elif table == "users":
                    conn.execute(
                        text("DELETE FROM users WHERE id != :owner_id"),
                        {"owner_id": owner_id},
                    )
                    print(f"Cleared all users except owner super admin (ID: {owner_id}).")
                else:
                    conn.execute(text(f"DELETE FROM {table}"))
                    print(f"Cleared table: {table}")

            if dialect_name == "mysql":
                conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
            elif dialect_name == "sqlite":
                conn.execute(text("PRAGMA foreign_keys = ON;"))

        # Re-verify and ensure owner super admin is active & has owner flag
        db.expire_all()
        owner_user = db.query(User).filter(User.id == owner_id).first()
        if owner_user:
            owner_user.is_owner = True
            owner_user.is_active = True
            db.commit()

        total_users = db.query(User).count()
        print("\n==========================================")
        print("Data wipe complete!")
        print(f"Total remaining users in DB: {total_users}")
        if owner_user:
            print(f"Owner Super Admin: {owner_user.email}")
        print("==========================================")

    finally:
        db.close()


if __name__ == "__main__":
    main()
