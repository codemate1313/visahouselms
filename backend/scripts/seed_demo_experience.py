"""Seed the no-subscription demo experience.

Safe to run repeatedly. Two things happen:

1. The sample Listening and Reading modules become demo modules (is_demo=True).
   Demo modules are free sample tests: any student can sit them without a
   subscription and receive an instant auto-marked score. Listening/Reading are
   chosen because they are fully objective — no instructor grading needed.

2. A direct (no institute, no subscription) student account is created:
       demo.student@example.com / Test@12345
   Logging in as this account shows the demo state of the portal: free sample
   tests unlocked, every other module locked with an upgrade prompt, and the
   exam & immigration news panel on the dashboard.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import hash_password  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models.exam_module import ExamModule  # noqa: E402
from app.models.role import STUDENT, Role  # noqa: E402
from app.models.user import User  # noqa: E402

PASSWORD = "Test@12345"
DEMO_STUDENT_EMAIL = "demo.student@example.com"
DEMO_MODULE_TITLES = (
    "Sample Listening Course - Academic Set 1",
    "Sample Reading Course - Academic Set 1",
)


def main() -> None:
    db = SessionLocal()
    try:
        flagged = 0
        for title in DEMO_MODULE_TITLES:
            module = db.query(ExamModule).filter(ExamModule.title == title).first()
            if module is None:
                print(f"  ! module not found (run seed_dummy_modules first): {title}")
                continue
            if not module.is_demo:
                module.is_demo = True
                flagged += 1

        role = db.query(Role).filter(Role.name == STUDENT).first()
        if role is None:
            raise RuntimeError("Roles are not seeded; run Alembic migrations first")

        user = db.query(User).filter(User.email == DEMO_STUDENT_EMAIL).first()
        if user is None:
            user = User(email=DEMO_STUDENT_EMAIL)
        user.password_hash = hash_password(PASSWORD)
        user.role_id = role.id
        user.institute_id = None  # direct student: no institute, no plan
        user.first_name = "Demo"
        user.last_name = "Student"
        user.is_active = True
        user.deleted_at = None
        user.force_password_reset = False
        db.add(user)

        db.commit()
        print(f"Demo experience seeded: {flagged} module(s) flagged as demo.")
        print(f"Demo student: {DEMO_STUDENT_EMAIL} / {PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
