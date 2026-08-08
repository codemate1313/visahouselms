"""Directory-level suspension of platform-wide students.

Institute members are managed through their own institute's endpoints, which own
the tenant rules. A direct student belongs to no institute, so the Super Admin
directory is the only place they can be suspended from.
"""
import unittest
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.requests import Request

from app.core.security import hash_password
from app.models import Base
from app.models.audit_log import AuditLog
from app.models.institute import Institute
from app.models.role import INSTITUTE_ADMIN, INST_INSTRUCTOR, STUDENT, SUPER_ADMIN, Role
from app.models.user import User
from app.models.user_session import UserSession
from app.routers.super_admin import get_user_linked_details, revoke_user_session
from app.services import super_admin_service


class DirectoryUserManagementTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        roles = [Role(name=name) for name in (SUPER_ADMIN, INSTITUTE_ADMIN, INST_INSTRUCTOR, STUDENT)]
        self.db.add_all(roles)
        self.db.flush()
        self.role_ids = {role.name: role.id for role in roles}

        self.institute = Institute(name="North Academy", slug="north")
        self.db.add(self.institute)
        self.db.flush()

        self.actor = self._user("super@directory.test", SUPER_ADMIN)
        self.direct_student = self._user("direct@directory.test", STUDENT)
        self.institute_student = self._user("member@directory.test", STUDENT, institute=True)
        self.institute_admin = self._user("admin@directory.test", INSTITUTE_ADMIN, institute=True)
        self.owner = self._user("owner@directory.test", STUDENT)
        self.owner.is_owner = True
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _user(self, email: str, role_name: str, institute: bool = False) -> User:
        user = User(
            email=email, password_hash=hash_password("Password!1"), role_id=self.role_ids[role_name],
            first_name="Test", last_name="User", is_active=True,
            institute_id=self.institute.id if institute else None,
        )
        self.db.add(user)
        self.db.flush()
        return user

    def _request(self, host: str = "127.0.0.1") -> Request:
        return Request({"type": "http", "method": "POST", "path": "/", "client": (host, 5000), "headers": []})

    def test_direct_student_can_be_suspended_and_restored(self) -> None:
        suspended = super_admin_service.set_directory_user_active(self.db, self.actor, self.direct_student.id, False)
        self.assertFalse(suspended["is_active"])
        self.db.refresh(self.direct_student)
        self.assertFalse(self.direct_student.is_active)

        restored = super_admin_service.set_directory_user_active(self.db, self.actor, self.direct_student.id, True)
        self.assertTrue(restored["is_active"])

    def test_institute_member_is_handed_off_to_their_institute(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            super_admin_service.set_directory_user_active(self.db, self.actor, self.institute_student.id, False)
        self.assertEqual(raised.exception.status_code, 400)
        self.db.rollback()
        self.db.refresh(self.institute_student)
        self.assertTrue(self.institute_student.is_active)

    def test_non_student_roles_are_refused(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            super_admin_service.set_directory_user_active(self.db, self.actor, self.institute_admin.id, False)
        self.assertEqual(raised.exception.status_code, 400)
        self.db.rollback()

    def test_owner_cannot_be_suspended(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            super_admin_service.set_directory_user_active(self.db, self.actor, self.owner.id, False)
        self.assertEqual(raised.exception.status_code, 400)
        self.db.rollback()
        self.db.refresh(self.owner)
        self.assertTrue(self.owner.is_active)

    def test_unknown_user_is_a_404(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            super_admin_service.set_directory_user_active(self.db, self.actor, 99999, False)
        self.assertEqual(raised.exception.status_code, 404)

    def test_delete_moves_direct_student_to_deleted_directory_segment(self) -> None:
        now = datetime.utcnow()
        self.db.add(
            UserSession(
                user_id=self.direct_student.id,
                refresh_token_hash="direct-student-session",
                user_agent="Chrome",
                ip_address="127.0.0.1",
                created_at=now,
                expires_at=now + timedelta(days=1),
            )
        )
        self.db.commit()

        original_id = self.direct_student.id
        original_email = self.direct_student.email
        super_admin_service.delete_direct_student(self.db, self.actor, original_id)

        archived = self.db.get(User, original_id)
        self.assertIsNotNone(archived)
        self.assertIsNotNone(archived.deleted_at)
        self.assertFalse(archived.is_active)
        self.assertNotEqual(archived.email, original_email)
        self.assertEqual(
            self.db.query(UserSession).filter(UserSession.user_id == original_id).count(),
            0,
        )

        live_page = super_admin_service.list_directory_users(self.db, role=STUDENT)
        self.assertNotIn(original_id, [row["id"] for row in live_page["items"]])

        deleted_page = super_admin_service.list_directory_users(
            self.db,
            role=STUDENT,
            status_filter="deleted",
        )
        self.assertEqual([row["id"] for row in deleted_page["items"]], [original_id])
        self.assertIsNotNone(deleted_page["items"][0]["deleted_at"])

    def test_linked_details_can_inspect_deleted_user_history(self) -> None:
        user_id = self.direct_student.id
        super_admin_service.delete_direct_student(self.db, self.actor, user_id)

        details = get_user_linked_details(user_id, self.db)

        self.assertEqual(details["user"]["id"], user_id)
        self.assertIsNotNone(details["user"]["deleted_at"])
        self.assertEqual(details["audit_logs"][0]["action"], "student.direct.delete")

    def test_linked_details_supports_directory_visible_non_student_users(self) -> None:
        now = datetime.utcnow()
        self.db.add(
            UserSession(
                user_id=self.institute_admin.id,
                refresh_token_hash="session-hash",
                user_agent="Chrome",
                ip_address="127.0.0.1",
                created_at=now,
                expires_at=now + timedelta(days=1),
            )
        )
        self.db.add(
            AuditLog(
                user_id=self.institute_admin.id,
                action="institute_admin.inspect_test",
                entity_type="user",
                entity_id=self.institute_admin.id,
                details={"field": "value", "count": 2},
                ip_address="127.0.0.1",
            )
        )
        self.db.commit()

        details = get_user_linked_details(self.institute_admin.id, self.db)

        self.assertEqual(details["user"]["id"], self.institute_admin.id)
        self.assertEqual(details["user"]["role_name"], INSTITUTE_ADMIN)
        self.assertEqual(len(details["sessions"]), 1)
        self.assertTrue(details["sessions"][0]["is_active"])
        self.assertIn("created_at", details["sessions"][0])
        self.assertEqual(details["audit_logs"][0]["entity_id"], self.institute_admin.id)
        self.assertEqual(details["audit_logs"][0]["details"], {"field": "value", "count": 2})
        self.assertEqual(details["audit_logs"][0]["actor"]["email"], self.institute_admin.email)

    def test_super_admin_can_revoke_linked_user_session(self) -> None:
        now = datetime.utcnow()
        session = UserSession(
            user_id=self.institute_admin.id,
            refresh_token_hash="target-session-hash",
            user_agent="Safari",
            ip_address="10.0.0.2",
            created_at=now,
            expires_at=now + timedelta(days=1),
        )
        self.db.add(session)
        self.db.commit()

        payload = revoke_user_session(self.institute_admin.id, session.id, self._request(), self.db, self.actor)

        self.assertEqual(payload["id"], session.id)
        self.assertFalse(payload["is_active"])
        self.assertIsNotNone(payload["revoked_at"])
        self.db.refresh(session)
        self.assertIsNotNone(session.revoked_at)
        audit = (
            self.db.query(AuditLog)
            .filter(
                AuditLog.action == "super_admin.revoke_user_session",
                AuditLog.entity_id == self.institute_admin.id,
            )
            .one()
        )
        self.assertEqual(audit.user_id, self.actor.id)
        self.assertEqual(audit.details["session_id"], session.id)


if __name__ == "__main__":
    unittest.main()
