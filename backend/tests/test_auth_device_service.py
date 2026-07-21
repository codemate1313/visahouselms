import unittest

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.dependencies.auth import get_current_user
from app.models import Base
from app.models.role import STUDENT, Role
from app.models.user import User
from app.models.user_device import UserDevice
from app.models.user_session import UserSession
from app.services import auth_service


class StudentDeviceLoginTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()
        role = Role(name=STUDENT)
        self.db.add(role)
        self.db.flush()
        self.student = User(
            email="device.student@example.com",
            password_hash=hash_password("StudentPassword!1"),
            role_id=role.id,
            institute_id=None,
            first_name="Device",
            last_name="Student",
            is_active=True,
        )
        self.db.add(self.student)
        self.db.commit()
        self.db.refresh(self.student)

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _login(self, device_id: str, name: str = "Chrome on macOS"):
        return auth_service.login(
            self.db,
            self.student.email,
            "StudentPassword!1",
            "Test Browser",
            "127.0.0.1",
            device_id,
            name,
        )

    def test_student_is_limited_to_one_device_and_history_is_retained(self):
        first_access, _ = self._login("device-a-identifier-0001")
        self.assertEqual(self.db.query(UserDevice).count(), 1)

        with self.assertRaises(HTTPException) as raised:
            self._login("device-b-identifier-0002", "Firefox on Windows")
        self.assertEqual(raised.exception.status_code, 409)
        self.db.rollback()

        replacement_access, _ = self._login("device-a-identifier-0001")
        active = self.db.query(UserSession).filter(UserSession.revoked_at.is_(None)).all()
        self.assertEqual(len(active), 1)

        with self.assertRaises(HTTPException):
            get_current_user(
                HTTPAuthorizationCredentials(scheme="Bearer", credentials=first_access),
                self.db,
            )
        current = get_current_user(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials=replacement_access),
            self.db,
        )
        self.assertEqual(current.id, self.student.id)

    def test_new_device_can_login_after_current_session_is_revoked(self):
        _, refresh = self._login("device-a-identifier-0001")
        auth_service.logout(self.db, refresh)
        self._login("device-b-identifier-0002", "Firefox on Windows")

        self.assertEqual(self.db.query(UserDevice).count(), 2)
        active = self.db.query(UserSession).filter(UserSession.revoked_at.is_(None)).all()
        self.assertEqual(len(active), 1)
        self.assertEqual(active[0].device.name, "Firefox on Windows")


if __name__ == "__main__":
    unittest.main()
