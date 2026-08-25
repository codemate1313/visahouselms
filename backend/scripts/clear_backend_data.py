"""Clear all application data from the backend database while preserving roles, 
alembic version, the owner super admin account, and developer accounts.

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
from app.models.role import DEVELOPER, SUPER_ADMIN, Role
from app.models.user import User
import scripts.seed_super_admin as seed_super_admin


def main() -> None:
    db = SessionLocal()

    try:
        # First ensure owner super admin exists
        seed_super_admin.main()

        # Find owner super admin and any developer accounts to preserve
        developer_role = db.query(Role).filter(Role.name == DEVELOPER).first()
        dev_role_id = developer_role.id if developer_role else -1

        preserved_users = db.query(User).filter(
            (User.is_owner.is_(True))
            | (User.email == settings.super_admin_email)
            | (User.role_id == dev_role_id)
        ).all()

        if not preserved_users:
            print("Error: Could not find any owner super admin or developer accounts.")
            sys.exit(1)

        preserved_ids = [u.id for u in preserved_users]
        print(f"Preserving {len(preserved_users)} account(s):")
        for u in preserved_users:
            print(f"  - ID: {u.id} | Email: {u.email} | Role: {u.role.name if u.role else 'Unknown'} | is_owner: {u.is_owner}")

        inspector = inspect(engine)
        all_tables = inspector.get_table_names()

        # Tables to preserve completely
        preserved_tables = {"alembic_version", "roles"}

        dialect_name = engine.dialect.name
        print(f"\nDatabase dialect: {dialect_name}")

        with engine.begin() as conn:
            if dialect_name == "mysql":
                conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
            elif dialect_name == "sqlite":
                conn.execute(text("PRAGMA foreign_keys = OFF;"))

            for table in all_tables:
                if table in preserved_tables:
                    continue
                elif table == "users":
                    if preserved_ids:
                        ids_str = ", ".join(str(i) for i in preserved_ids)
                        conn.execute(text(f"DELETE FROM users WHERE id NOT IN ({ids_str})"))
                        print(f"Cleared all users except preserved accounts (IDs: {ids_str}).")
                    else:
                        conn.execute(text("DELETE FROM users"))
                else:
                    conn.execute(text(f"DELETE FROM {table}"))
                    print(f"Cleared table: {table}")

            if dialect_name == "mysql":
                conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
            elif dialect_name == "sqlite":
                conn.execute(text("PRAGMA foreign_keys = ON;"))

        # Re-verify and ensure owner super admin is active & has owner flag
        db.expire_all()
        for pid in preserved_ids:
            u = db.query(User).filter(User.id == pid).first()
            if u:
                u.is_active = True
                u.institute_id = None
                if u.email == settings.super_admin_email:
                    u.is_owner = True
        db.commit()

        total_users = db.query(User).count()
        print("\n==========================================")
        print("Data wipe complete!")
        print(f"Total remaining users in DB: {total_users}")
        for u in db.query(User).all():
            print(f"  Account: {u.email} ({u.role.name if u.role else 'No role'}) - Owner: {u.is_owner}")
        print("==========================================")

    finally:
        db.close()


if __name__ == "__main__":
    main()
