"""Delete all student users from the database while leaving admin and instructor accounts intact.

Usage:
    python scripts/delete_students.py
"""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import bindparam, text
from app.database import SessionLocal
from app.models.role import STUDENT, Role
from app.models.user import User

# Tables whose user_id FK has no ON DELETE action (RESTRICT), so they'd block
# deleting a student outright. Their rows are per-student history (logs,
# payments, sessions), so wiping them alongside the student matches what
# "delete all students" means here. Everything else - test_attempts and
# everything hanging off it (answers, grades, AI evaluations, ...),
# enrollments, notifications, badges, etc. - already has ON DELETE CASCADE at
# the DB level, so it's cleaned up automatically as long as we don't disable
# foreign key checks (that used to suppress those cascades too, leaving
# orphaned test_attempts rows behind - see incident notes).
BLOCKING_TABLES = [
    "api_logs",
    "audit_logs",
    "error_logs",
    "payments",
    "subscriptions",
    "user_sessions",
]


def main() -> None:
    db = SessionLocal()

    try:
        student_role = db.query(Role).filter(Role.name == STUDENT).first()
        if not student_role:
            print("STUDENT role not found in database.")
            return

        students = db.query(User).filter(User.role_id == student_role.id).all()
        if not students:
            print("No student accounts found in database.")
            return

        student_ids = [s.id for s in students]
        print(f"Found {len(students)} student account(s) to delete:")
        for s in students:
            print(f"  - ID {s.id}: {s.email} ({s.first_name} {s.last_name})")

        for table in BLOCKING_TABLES:
            db.execute(
                text(f"DELETE FROM {table} WHERE user_id IN :ids").bindparams(
                    bindparam("ids", expanding=True)
                ),
                {"ids": student_ids},
            )

        db.execute(
            text("DELETE FROM users WHERE role_id = :role_id"),
            {"role_id": student_role.id},
        )

        db.commit()

        remaining_users = db.query(User).all()
        print("\n==========================================")
        print(f"Successfully deleted {len(student_ids)} student account(s).")
        print(f"Remaining users in DB ({len(remaining_users)}):")
        for u in remaining_users:
            print(f"  - ID {u.id}: {u.email} (Role: {u.role.name if u.role else u.role_id})")
        print("==========================================")

    finally:
        db.close()


if __name__ == "__main__":
    main()
