"""Tests for the cross-institute Super Admin user directory (/super-admin/users).

Covers the behaviour the per-role endpoints never had to handle: mixing roles in
one result set, paginating past the first page, and staying out of reach of
non-super-admin callers.
"""

import unittest
from unittest import mock

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import hash_password
from app.database import get_db
from app.main import app
from app.middleware import request_logging
from app.models import Base
from app.models.institute import Institute
from app.models.role import (
    INST_INSTRUCTOR,
    INSTITUTE_ADMIN,
    SA_INSTRUCTOR,
    STUDENT,
    SUPER_ADMIN,
    Role,
)
from app.models.user import User
from app.services import auth_service, super_admin_service

PASSWORD = "CorrectHorse!1"


class UserDirectoryTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        self.roles = {}
        for name in (SUPER_ADMIN, SA_INSTRUCTOR, INSTITUTE_ADMIN, INST_INSTRUCTOR, STUDENT):
            role = Role(name=name)
            self.db.add(role)
            self.roles[name] = role
        self.institute = Institute(name="North Academy", slug="north-academy", is_active=True)
        self.db.add(self.institute)
        self.db.commit()

        self.admin = self._user("boss@example.com", SUPER_ADMIN)
        self._user("author@example.com", SA_INSTRUCTOR)
        self._user("principal@example.com", INSTITUTE_ADMIN, institute=True)
        self._user("marker@example.com", INST_INSTRUCTOR, institute=True)
        for index in range(5):
            self._user(f"student{index}@example.com", STUDENT, institute=True)

        app.dependency_overrides[get_db] = self._override_get_db
        # The request-logging middleware opens its own session straight from
        # app.database, so without this it would write to the real database.
        self._logging_patch = mock.patch.object(
            request_logging, "SessionLocal", self.Session
        )
        self._logging_patch.start()
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self._logging_patch.stop()
        app.dependency_overrides.clear()
        self.db.close()
        self.engine.dispose()

    def _override_get_db(self):
        db = self.Session()
        try:
            yield db
        finally:
            db.close()

    def _user(self, email: str, role_name: str, institute: bool = False) -> User:
        user = User(
            email=email,
            password_hash=hash_password(PASSWORD),
            role_id=self.roles[role_name].id,
            institute_id=self.institute.id if institute else None,
            first_name=email.split("@")[0].capitalize(),
            last_name="Person",
            is_active=True,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def _headers(self, user: User) -> dict:
        token, _refresh = auth_service.issue_login_session(
            self.db, user, "pytest", "127.0.0.1",
            device_identifier=f"dev-{user.id:016d}", device_name="Test",
        )
        self.db.commit()
        return {"Authorization": f"Bearer {token}"}

    # --- access control --------------------------------------------------

    def test_directory_requires_authentication(self):
        self.assertEqual(self.client.get("/super-admin/users").status_code, 403)

    def test_directory_is_refused_to_a_student(self):
        student = self.db.query(User).filter(User.email == "student0@example.com").one()
        response = self.client.get("/super-admin/users", headers=self._headers(student))
        self.assertEqual(response.status_code, 403)

    def test_directory_is_refused_to_an_institute_admin(self):
        principal = self.db.query(User).filter(User.email == "principal@example.com").one()
        response = self.client.get("/super-admin/users", headers=self._headers(principal))
        self.assertEqual(response.status_code, 403)

    # --- listing ---------------------------------------------------------

    def test_lists_every_role_in_one_result_set(self):
        response = self.client.get("/super-admin/users", headers=self._headers(self.admin))
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["total"], 9)
        self.assertEqual(
            body["role_counts"],
            {
                SUPER_ADMIN: 1,
                SA_INSTRUCTOR: 1,
                INSTITUTE_ADMIN: 1,
                INST_INSTRUCTOR: 1,
                STUDENT: 5,
            },
        )

    def test_role_filter_narrows_rows_but_not_the_tab_counts(self):
        response = self.client.get(
            "/super-admin/users", params={"role": STUDENT}, headers=self._headers(self.admin)
        )
        body = response.json()
        self.assertEqual(body["total"], 5)
        self.assertTrue(all(row["role_name"] == STUDENT for row in body["items"]))
        # Counts stay global so every tab keeps showing its real total.
        self.assertEqual(body["role_counts"][SUPER_ADMIN], 1)

    def test_rows_carry_institute_identity_only_for_tenant_roles(self):
        body = self.client.get(
            "/super-admin/users", headers=self._headers(self.admin)
        ).json()
        by_email = {row["email"]: row for row in body["items"]}
        self.assertEqual(by_email["student0@example.com"]["institute_name"], "North Academy")
        self.assertIsNone(by_email["boss@example.com"]["institute_id"])
        self.assertIsNone(by_email["author@example.com"]["institute_name"])

    def test_search_matches_email_and_name(self):
        headers = self._headers(self.admin)
        by_email = self.client.get(
            "/super-admin/users", params={"q": "marker@"}, headers=headers
        ).json()
        self.assertEqual([r["email"] for r in by_email["items"]], ["marker@example.com"])

        by_name = self.client.get(
            "/super-admin/users", params={"q": "Principal"}, headers=headers
        ).json()
        self.assertEqual([r["email"] for r in by_name["items"]], ["principal@example.com"])

    def test_status_filter_splits_active_and_inactive(self):
        student = self.db.query(User).filter(User.email == "student1@example.com").one()
        student.is_active = False
        self.db.commit()

        headers = self._headers(self.admin)
        inactive = self.client.get(
            "/super-admin/users", params={"status": "inactive"}, headers=headers
        ).json()
        self.assertEqual([r["email"] for r in inactive["items"]], ["student1@example.com"])

        active = self.client.get(
            "/super-admin/users", params={"status": "active"}, headers=headers
        ).json()
        self.assertEqual(active["total"], 8)

    def test_institute_filter_scopes_to_one_tenant(self):
        other = Institute(name="South College", slug="south-college", is_active=True)
        self.db.add(other)
        self.db.commit()
        outsider = User(
            email="outsider@example.com",
            password_hash=hash_password(PASSWORD),
            role_id=self.roles[STUDENT].id,
            institute_id=other.id,
            first_name="Out",
            last_name="Sider",
            is_active=True,
        )
        self.db.add(outsider)
        self.db.commit()

        body = self.client.get(
            "/super-admin/users",
            params={"institute_id": other.id},
            headers=self._headers(self.admin),
        ).json()
        self.assertEqual([r["email"] for r in body["items"]], ["outsider@example.com"])

    def test_pagination_splits_results_without_overlap(self):
        headers = self._headers(self.admin)
        first = self.client.get(
            "/super-admin/users",
            params={"role": STUDENT, "page": 1, "page_size": 2},
            headers=headers,
        ).json()
        second = self.client.get(
            "/super-admin/users",
            params={"role": STUDENT, "page": 2, "page_size": 2},
            headers=headers,
        ).json()

        self.assertEqual(len(first["items"]), 2)
        self.assertEqual(len(second["items"]), 2)
        self.assertEqual(first["total"], 5)
        self.assertFalse(
            {r["id"] for r in first["items"]} & {r["id"] for r in second["items"]}
        )

    def test_soft_deleted_users_are_hidden(self):
        student = self.db.query(User).filter(User.email == "student2@example.com").one()
        from datetime import datetime

        student.deleted_at = datetime.utcnow()
        self.db.commit()

        body = self.client.get(
            "/super-admin/users", headers=self._headers(self.admin)
        ).json()
        self.assertEqual(body["total"], 8)
        self.assertNotIn("student2@example.com", [r["email"] for r in body["items"]])

    def test_unknown_role_is_rejected(self):
        response = self.client.get(
            "/super-admin/users", params={"role": "WIZARD"}, headers=self._headers(self.admin)
        )
        self.assertEqual(response.status_code, 400)

    def test_page_size_is_capped(self):
        result = super_admin_service.list_directory_users(self.db, page_size=10_000)
        self.assertEqual(result["page_size"], super_admin_service.MAX_PAGE_SIZE)


if __name__ == "__main__":
    unittest.main()
