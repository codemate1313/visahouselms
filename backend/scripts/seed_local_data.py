"""Seed a complete local QA dataset.

This is the one command other developers/Super Admin testers should run after
setting up `.env`. It applies migrations and then runs the existing idempotent
seeders in dependency order.

Usage:
    python scripts/seed_local_data.py
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent.parent
PYTHON = sys.executable


def _run(label: str, command: list[str]) -> None:
    print(f"\n==> {label}", flush=True)
    subprocess.run(command, cwd=BACKEND_DIR, check=True)


def main() -> None:
    _run("Applying migrations", [PYTHON, "-m", "alembic", "upgrade", "head"])
    _run("Seeding .env super admin", [PYTHON, "scripts/seed_super_admin.py"])
    _run("Seeding sample assessment modules", [PYTHON, "scripts/seed_dummy_modules.py"])
    _run("Seeding QA accounts, institute, access, and plan", [PYTHON, "scripts/seed_test_credentials.py"])

    print(
        "\nLocal seed complete.\n"
        "QA password: Test@12345\n"
        "Super Admin: qa.superadmin@example.com\n"
        "SA Instructor: sample.instructor@example.com\n"
        "Institute Admin: qa.institute.admin@example.com\n"
        "Institute Instructor: qa.institute.instructor@example.com\n"
        "Institute Student: qa.student@example.com"
    )


if __name__ == "__main__":
    main()
