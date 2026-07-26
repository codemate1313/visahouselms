import unittest
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password, verify_password
from app.models import Base
from app.models.audit_log import AuditLog
from app.models.institute import Institute
from app.models.role import INSTITUTE_ADMIN, STUDENT, SUPER_ADMIN, Role
from app.models.user import User
from app.models.user_session import UserSession
from app.services import account_service, institute_service, super_admin_service


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class InstituteAdminPasswordResetTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        roles = [Role(name=name) for name in (INSTITUTE_ADMIN, STUDENT, SUPER_ADMIN)]
        self.db.add_all(roles)
        self.db.flush()
        self.roles = {role.name: role.id for role in roles}

        self.institute = Institute(name="North Academy", slug="north")
        self.other_institute = Institute(name="South Academy", slug="south")
        self.db.add_all([self.institute, self.other_institute])
        self.db.flush()

        self.admin = User(
            email="admin@north.test",
            password_hash=hash_password("AdminPassword!1"),
            role_id=self.roles[INSTITUTE_ADMIN],
            institute_id=self.institute.id,
            first_name="Nora",
            last_name="Admin",
            is_active=True,
        )
        self.student = User(
            email="sam@north.test",
            password_hash=hash_password("StudentPassword!1"),
            role_id=self.roles[STUDENT],
            institute_id=self.institute.id,
            first_name="Sam",
            last_name="Student",
            is_active=True,
        )
        self.super_admin = User(
            email="super@example.com",
            password_hash=hash_password("SuperPassword!1"),
            role_id=self.roles[SUPER_ADMIN],
            first_name="Super",
            last_name="Admin",
            is_active=True,
        )
        self.db.add_all([self.admin, self.student, self.super_admin])
        self.db.flush()

        self.db.add(
            UserSession(
                user_id=self.admin.id,
                session_key="key-admin",
                refresh_token_hash="hash-admin",
                created_at=_now(),
                expires_at=_now() + timedelta(days=1),
            )
        )
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_reset_issues_a_working_temporary_password_and_kills_sessions(self):
        result = institute_service.reset_admin_password(
            self.db, self.super_admin, self.institute.id, self.admin.id, "127.0.0.1"
        )

        self.db.refresh(self.admin)
        self.assertTrue(verify_password(result["temporary_password"], self.admin.password_hash))
        self.assertTrue(self.admin.force_password_reset)
        self.assertIsNotNone(self.admin.password_changed_at)
        self.assertEqual(result["sessions_revoked"], 1)
        self.assertEqual(
            self.db.query(UserSession).filter(UserSession.revoked_at.is_(None)).count(), 0
        )

        audit = self.db.query(AuditLog).filter(AuditLog.action == "institute_admin.reset_password").one()
        self.assertEqual(audit.user_id, self.super_admin.id)
        self.assertEqual(audit.entity_id, self.admin.id)
        self.assertEqual(audit.details["institute_id"], self.institute.id)

    def test_reset_is_scoped_to_the_institute_in_the_url(self):
        with self.assertRaises(HTTPException) as caught:
            institute_service.reset_admin_password(
                self.db, self.super_admin, self.other_institute.id, self.admin.id, None
            )
        self.assertEqual(caught.exception.status_code, 404)

    def test_only_admin_accounts_are_resettable_here(self):
        with self.assertRaises(HTTPException) as caught:
            institute_service.reset_admin_password(
                self.db, self.super_admin, self.institute.id, self.student.id, None
            )
        self.assertEqual(caught.exception.status_code, 404)

    def test_owner_account_is_refused(self):
        self.admin.is_owner = True
        self.db.commit()

        with self.assertRaises(HTTPException) as caught:
            institute_service.reset_admin_password(
                self.db, self.super_admin, self.institute.id, self.admin.id, None
            )
        self.assertEqual(caught.exception.status_code, 403)

    def test_directory_reports_never_changed_until_a_change_happens(self):
        row = self._directory_row(self.admin.id)
        self.assertIsNone(row["password_changed_at"])
        self.assertIsNone(row["last_password_change"])

        institute_service.reset_admin_password(
            self.db, self.super_admin, self.institute.id, self.admin.id, "10.0.0.9"
        )

        row = self._directory_row(self.admin.id)
        self.assertIsNotNone(row["password_changed_at"])
        self.assertEqual(row["last_password_change"]["by_name"], "Super Admin")
        self.assertFalse(row["last_password_change"]["by_self"])
        self.assertEqual(row["last_password_change"]["ip_address"], "10.0.0.9")

    def test_self_service_change_is_attributed_to_the_account_holder(self):
        account_service.change_password(
            self.db, self.admin, "AdminPassword!1", "BrandNewPassword!9", "127.0.0.1"
        )

        row = self._directory_row(self.admin.id)
        self.assertIsNotNone(row["password_changed_at"])
        self.assertTrue(row["last_password_change"]["by_self"])
        self.assertEqual(row["last_password_change"]["action"], "account.change_password")

    def test_trail_reports_only_the_newest_event(self):
        account_service.change_password(
            self.db, self.admin, "AdminPassword!1", "BrandNewPassword!9", None
        )
        institute_service.reset_admin_password(
            self.db, self.super_admin, self.institute.id, self.admin.id, None
        )

        row = self._directory_row(self.admin.id)
        self.assertEqual(row["last_password_change"]["action"], "institute_admin.reset_password")

    def _directory_row(self, user_id: int) -> dict:
        page = super_admin_service.list_directory_users(self.db)
        return next(item for item in page["items"] if item["id"] == user_id)


if __name__ == "__main__":
    unittest.main()
