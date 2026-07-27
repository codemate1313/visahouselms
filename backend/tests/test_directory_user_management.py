"""Directory-level suspension of platform-wide students.

Institute members are managed through their own institute's endpoints, which own
the tenant rules. A direct student belongs to no institute, so the Super Admin
directory is the only place they can be suspended from.
"""
import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.models import Base
from app.models.institute import Institute
from app.models.role import INSTITUTE_ADMIN, INST_INSTRUCTOR, STUDENT, SUPER_ADMIN, Role
from app.models.user import User
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


if __name__ == "__main__":
    unittest.main()
