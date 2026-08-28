from datetime import datetime, timedelta, timezone
import unittest

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.dependencies.auth import get_current_user
from app.models import Base
from app.models.institute import Institute
from app.models.role import INSTITUTE_ADMIN, STUDENT, Role
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

    def test_student_login_on_new_device_revokes_previous_session_and_retains_history(self):
        first_access, _ = self._login("device-a-identifier-0001")
        self.assertEqual(self.db.query(UserDevice).count(), 1)

        replacement_access, _ = self._login("device-b-identifier-0002", "Firefox on Windows")

        self.assertEqual(self.db.query(UserDevice).count(), 2)
        active = self.db.query(UserSession).filter(UserSession.revoked_at.is_(None)).all()
        self.assertEqual(len(active), 1)
        self.assertEqual(active[0].device.name, "Firefox on Windows")

        with self.assertRaises(HTTPException):
            get_current_user(
                credentials=HTTPAuthorizationCredentials(scheme="Bearer", credentials=first_access),
                db=self.db,
            )
        current = get_current_user(
            credentials=HTTPAuthorizationCredentials(scheme="Bearer", credentials=replacement_access),
            db=self.db,
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

    def test_logout_revokes_a_rotated_session_on_the_same_device(self):
        _, original_refresh = self._login("device-a-identifier-0001")
        auth_service.refresh(self.db, original_refresh, "Test Browser", "127.0.0.1")

        auth_service.logout(self.db, original_refresh)

        active = self.db.query(UserSession).filter(UserSession.revoked_at.is_(None)).all()
        self.assertEqual(active, [])
        self._login("device-b-identifier-0002", "Firefox on Windows")

    def test_unidentified_legacy_session_does_not_lock_student_out(self):
        legacy_session = UserSession(
            user_id=self.student.id,
            device_id=None,
            session_key="legacy-unidentified-session",
            refresh_token_hash="legacy-unidentified-refresh-token",
            user_agent=None,
            ip_address=None,
            created_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        self.db.add(legacy_session)
        self.db.commit()

        self._login("device-a-identifier-0001")

        self.db.refresh(legacy_session)
        self.assertIsNotNone(legacy_session.revoked_at)
        active = self.db.query(UserSession).filter(UserSession.revoked_at.is_(None)).all()
        self.assertEqual(len(active), 1)
        self.assertIsNotNone(active[0].device_id)


class InstituteSessionPolicyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()
        role = Role(name=INSTITUTE_ADMIN)
        institute = Institute(
            name="Policy Institute",
            slug="policy-institute",
            session_duration_hours=2,
        )
        self.db.add_all([role, institute])
        self.db.flush()
        self.admin = User(
            email="policy.admin@example.com",
            password_hash=hash_password("AdminPassword!1"),
            role_id=role.id,
            institute_id=institute.id,
            first_name="Policy",
            last_name="Admin",
            is_active=True,
        )
        self.db.add(self.admin)
        self.db.commit()
        self.db.refresh(self.admin)

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _login(self, device_id: str, name: str):
        return auth_service.login(
            self.db,
            self.admin.email,
            "AdminPassword!1",
            "Test Browser",
            "127.0.0.1",
            device_id,
            name,
        )

    def test_institute_policy_sets_absolute_expiry_and_new_login_revokes_old_session(self):
        _, refresh = self._login("admin-device-a-0001", "Chrome on macOS")
        session = self.db.query(UserSession).filter(UserSession.revoked_at.is_(None)).one()
        expires_at = session.expires_at.replace(tzinfo=timezone.utc)
        self.assertLess(abs(expires_at - (datetime.now(timezone.utc) + timedelta(hours=2))), timedelta(seconds=5))

        previous_access, previous_refresh = auth_service.refresh(
            self.db, refresh, "Test Browser", "127.0.0.1"
        )
        replacement = self.db.query(UserSession).filter(UserSession.revoked_at.is_(None)).one()
        replacement_expiry = replacement.expires_at.replace(tzinfo=timezone.utc)
        self.assertLess(abs(replacement_expiry - expires_at), timedelta(seconds=1))

        replacement_access, _ = self._login("admin-device-b-0002", "Firefox on Windows")
        active_sessions = self.db.query(UserSession).filter(UserSession.revoked_at.is_(None)).all()
        self.assertEqual(len(active_sessions), 1)
        self.assertEqual(active_sessions[0].device.name, "Firefox on Windows")

        with self.assertRaises(HTTPException):
            get_current_user(
                credentials=HTTPAuthorizationCredentials(
                    scheme="Bearer", credentials=previous_access
                ),
                db=self.db,
            )
        with self.assertRaises(HTTPException):
            auth_service.refresh(
                self.db, previous_refresh, "Test Browser", "127.0.0.1"
            )

        current = get_current_user(
            credentials=HTTPAuthorizationCredentials(
                scheme="Bearer", credentials=replacement_access
            ),
            db=self.db,
        )
        self.assertEqual(current.id, self.admin.id)


class OtpBypassWindowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()
        role = Role(name=STUDENT)
        self.db.add(role)
        self.db.flush()
        self.student = User(
            email="otp.student@example.com",
            password_hash=hash_password("StudentPassword!1"),
            role_id=role.id,
            institute_id=None,
            first_name="Otp",
            last_name="Student",
            is_active=True,
        )
        self.db.add(self.student)
        self.db.commit()
        self.db.refresh(self.student)

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_verified_device_is_trusted_until_the_window_elapses(self):
        device_id = "otp-device-identifier-0001"
        self.assertFalse(auth_service.device_otp_bypass_active(self.db, self.student, device_id))

        auth_service.issue_login_session(
            self.db,
            self.student,
            "Test Browser",
            "127.0.0.1",
            device_id,
            "Chrome on macOS",
            otp_verified=True,
        )
        self.assertTrue(auth_service.device_otp_bypass_active(self.db, self.student, device_id))

        device = self.db.query(UserDevice).filter(UserDevice.user_id == self.student.id).one()
        device.otp_verified_until = datetime.now(timezone.utc) - timedelta(seconds=1)
        self.db.commit()
        self.assertFalse(auth_service.device_otp_bypass_active(self.db, self.student, device_id))

    def test_bypass_does_not_extend_the_original_window(self):
        device_id = "otp-device-identifier-0002"
        auth_service.issue_login_session(
            self.db,
            self.student,
            "Test Browser",
            "127.0.0.1",
            device_id,
            "Chrome on macOS",
            otp_verified=True,
        )
        device = self.db.query(UserDevice).filter(UserDevice.user_id == self.student.id).one()
        original_expiry = device.otp_verified_until

        # A later login that rides the bypass (otp_verified left at its default
        # of False, matching a real login that skipped the OTP step) must not
        # push the trust window back out.
        auth_service.issue_login_session(
            self.db,
            self.student,
            "Test Browser",
            "127.0.0.1",
            device_id,
            "Chrome on macOS",
        )
        self.db.refresh(device)
        self.assertEqual(device.otp_verified_until, original_expiry)

    def test_a_different_device_is_never_trusted_by_another_devices_verification(self):
        auth_service.issue_login_session(
            self.db,
            self.student,
            "Test Browser",
            "127.0.0.1",
            "otp-device-identifier-0003",
            "Chrome on macOS",
            otp_verified=True,
        )
        self.assertFalse(
            auth_service.device_otp_bypass_active(self.db, self.student, "otp-device-identifier-0004")
        )

    def test_no_device_identifier_is_never_trusted(self):
        self.assertFalse(auth_service.device_otp_bypass_active(self.db, self.student, None))


if __name__ == "__main__":
    unittest.main()
