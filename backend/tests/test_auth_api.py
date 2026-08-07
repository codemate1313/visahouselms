"""Router-level tests driving the real ASGI app through TestClient.

Unlike the service tests, these exercise dependency wiring: that role guards are
actually attached to the endpoints, and that the unauthenticated auth routes are
rate limited. A missing `Depends(require_role(...))` on an endpoint is invisible
to service-level tests but fails here.
"""

import unittest
from unittest import mock

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.rate_limit import reset_rate_limits
from app.core.security import create_login_otp_token, hash_login_otp_code, hash_password
from app.config import settings
from app.database import get_db
from app.main import app
from app.middleware import request_logging
from app.models import Base
from app.models.role import INSTITUTE_ADMIN, STUDENT, SUPER_ADMIN, Role
from app.models.user import User
from app.models.user_session import UserSession
from app.services import account_service, auth_service

PASSWORD = "CorrectHorse!1"


class AuthApiTestCase(unittest.TestCase):
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
        for name in (STUDENT, INSTITUTE_ADMIN, SUPER_ADMIN):
            role = Role(name=name)
            self.db.add(role)
            self.roles[name] = role
        self.db.commit()

        app.dependency_overrides[get_db] = self._override_get_db
        # The request-logging middleware opens its own session straight from
        # app.database, so without this it would write to the real database.
        self._logging_patch = mock.patch.object(
            request_logging, "SessionLocal", self.Session
        )
        self._logging_patch.start()
        self.client = TestClient(app)
        reset_rate_limits()

    def tearDown(self) -> None:
        self._logging_patch.stop()
        app.dependency_overrides.clear()
        reset_rate_limits()
        self.db.close()
        self.engine.dispose()

    def _override_get_db(self):
        db = self.Session()
        try:
            yield db
        finally:
            db.close()

    def _make_user(self, email: str, role_name: str) -> User:
        user = User(
            email=email,
            password_hash=hash_password(PASSWORD),
            role_id=self.roles[role_name].id,
            institute_id=None,
            first_name="Test",
            last_name="User",
            is_active=True,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def _auth_header(self, user: User) -> dict:
        access_token, _refresh = auth_service.issue_login_session(
            self.db,
            user,
            "pytest",
            "127.0.0.1",
            device_identifier=f"test-device-{user.id:016d}",
            device_name="Test Device",
        )
        self.db.commit()
        return {"Authorization": f"Bearer {access_token}"}

    # --- role guards -----------------------------------------------------

    def test_student_endpoint_rejects_anonymous_request(self):
        response = self.client.get("/student/me/profile")
        self.assertEqual(response.status_code, 403)

    def test_student_endpoint_rejects_non_student_role(self):
        admin = self._make_user("admin@example.com", INSTITUTE_ADMIN)
        response = self.client.get("/student/me/profile", headers=self._auth_header(admin))
        self.assertEqual(response.status_code, 403)

    def test_student_endpoint_allows_student_role(self):
        student = self._make_user("student@example.com", STUDENT)
        response = self.client.get("/student/me/profile", headers=self._auth_header(student))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], "student@example.com")

    def test_super_admin_router_rejects_student_role(self):
        student = self._make_user("student2@example.com", STUDENT)
        response = self.client.get("/super-admin/institutes", headers=self._auth_header(student))
        self.assertEqual(response.status_code, 403)

    def test_access_token_is_rejected_after_its_session_is_revoked(self):
        student = self._make_user("student3@example.com", STUDENT)
        headers = self._auth_header(student)
        self.assertEqual(
            self.client.get("/student/me/profile", headers=headers).status_code, 200
        )

        account_service.revoke_all_sessions(self.db, student.id)
        self.db.commit()

        self.assertEqual(
            self.client.get("/student/me/profile", headers=headers).status_code, 401
        )

    def test_revoke_others_uses_current_access_session(self):
        admin = self._make_user("owner@example.com", SUPER_ADMIN)
        access_a, _ = auth_service.issue_login_session(
            self.db,
            admin,
            "Chrome A",
            "127.0.0.1",
            device_identifier="admin-device-a",
            device_name="Chrome A",
        )
        access_b, _ = auth_service.issue_login_session(
            self.db,
            admin,
            "Chrome B",
            "127.0.0.1",
            device_identifier="admin-device-b",
            device_name="Chrome B",
        )
        access_c, _ = auth_service.issue_login_session(
            self.db,
            admin,
            "Chrome C",
            "127.0.0.1",
            device_identifier="admin-device-c",
            device_name="Chrome C",
        )

        response = self.client.post(
            "/super-admin/me/sessions/revoke-others",
            headers={"Authorization": f"Bearer {access_b}"},
            json={},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"revoked": 2})
        active_sessions = (
            self.db.query(UserSession)
            .filter(UserSession.user_id == admin.id, UserSession.revoked_at.is_(None))
            .all()
        )
        self.assertEqual(len(active_sessions), 1)
        self.assertEqual(active_sessions[0].user_agent, "Chrome B")
        self.assertEqual(
            self.client.get(
                "/super-admin/me/sessions",
                headers={"Authorization": f"Bearer {access_a}"},
            ).status_code,
            401,
        )
        self.assertEqual(
            self.client.get(
                "/super-admin/me/sessions",
                headers={"Authorization": f"Bearer {access_c}"},
            ).status_code,
            401,
        )
        self.assertEqual(
            self.client.get(
                "/super-admin/me/sessions",
                headers={"Authorization": f"Bearer {access_b}"},
            ).status_code,
            200,
        )

    # --- rate limiting ---------------------------------------------------

    def test_login_is_rate_limited_per_account(self):
        self._make_user("victim@example.com", STUDENT)
        body = {"email": "victim@example.com", "password": "WrongPassword!1"}

        statuses = [
            self.client.post("/auth/login", json=body).status_code
            for _ in range(settings.login_rate_limit + 1)
        ]

        self.assertNotIn(429, statuses[: settings.login_rate_limit])
        self.assertEqual(statuses[-1], 429)

    def test_correct_password_is_still_refused_once_login_limit_is_reached(self):
        self._make_user("victim2@example.com", STUDENT)
        for _ in range(settings.login_rate_limit):
            self.client.post(
                "/auth/login",
                json={"email": "victim2@example.com", "password": "WrongPassword!1"},
            )

        response = self.client.post(
            "/auth/login", json={"email": "victim2@example.com", "password": PASSWORD}
        )
        self.assertEqual(response.status_code, 429)

    def test_otp_challenge_cannot_be_brute_forced(self):
        user = self._make_user("otp@example.com", STUDENT)
        challenge_token = create_login_otp_token(
            user.id, STUDENT, None, "password", False, None, None, hash_login_otp_code("123456")
        )

        statuses = []
        for _ in range(settings.otp_attempt_limit + 1):
            statuses.append(
                self.client.post(
                    "/auth/verify-otp",
                    json={"challenge_id": challenge_token, "otp_code": "000000"},
                ).status_code
            )

        self.assertTrue(all(code == 401 for code in statuses[: settings.otp_attempt_limit]))
        self.assertEqual(statuses[-1], 429)

        # The cap must hold even when the caller then supplies the correct code.
        blocked = self.client.post(
            "/auth/verify-otp",
            json={"challenge_id": challenge_token, "otp_code": "123456"},
        )
        self.assertEqual(blocked.status_code, 429)

    def test_forgot_password_is_rate_limited_per_email(self):
        self._make_user("reset@example.com", STUDENT)
        body = {"email": "reset@example.com"}

        statuses = [
            self.client.post("/auth/forgot-password", json=body).status_code
            for _ in range(settings.password_reset_rate_limit + 1)
        ]

        self.assertEqual(statuses[-1], 429)

    def test_login_fails_without_otp_when_role_mismatches(self):
        self._make_user("student_user@example.com", STUDENT)

        # Correct email and password, but wrong role passed
        res = self.client.post(
            "/auth/login",
            json={
                "email": "student_user@example.com",
                "password": PASSWORD,
                "role": INSTITUTE_ADMIN,
            },
        )
        self.assertEqual(res.status_code, 401)
        data = res.json()
        self.assertEqual(data.get("detail"), "Invalid email or password")
        self.assertNotIn("otp_required", data)

    def test_login_succeeds_with_otp_challenge_when_role_matches(self):
        self._make_user("student_user2@example.com", STUDENT)

        res = self.client.post(
            "/auth/login",
            json={
                "email": "student_user2@example.com",
                "password": PASSWORD,
                "role": STUDENT,
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("otp_required"))
        self.assertIsNotNone(data.get("otp_challenge_id"))


if __name__ == "__main__":
    unittest.main()
