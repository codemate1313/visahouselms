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

    def test_database_health_endpoint_checks_db_round_trip(self):
        with mock.patch("app.database.SessionLocal", self.Session):
            response = self.client.get("/health/db")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "database": "ok"})

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
        # Create three sessions directly so this endpoint test can exercise its
        # cleanup behavior independently of the login-time single-session rule.
        access_a, _ = auth_service.issue_token_pair(
            self.db,
            admin,
            "Chrome A",
            "127.0.0.1",
        )
        access_b, _ = auth_service.issue_token_pair(
            self.db,
            admin,
            "Chrome B",
            "127.0.0.1",
        )
        access_c, _ = auth_service.issue_token_pair(
            self.db,
            admin,
            "Chrome C",
            "127.0.0.1",
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

    def test_password_reset_token_expires_after_10_minutes(self):
        import jwt
        from datetime import datetime, timezone, timedelta

        user = self._make_user("reset_expiry_test@example.com", STUDENT)

        # 1. Valid token (generated now, expires in 10 minutes)
        valid_payload = {
            "sub": str(user.id),
            "email": user.email,
            "type": "password_reset",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
        }
        valid_token = jwt.encode(valid_payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

        res_valid = self.client.post(
            "/auth/reset-password",
            json={"token": valid_token, "new_password": "NewSecretPassword123!"},
        )
        self.assertEqual(res_valid.status_code, 200)

        # 2. Expired token (11 minutes old / expired in past)
        expired_payload = {
            "sub": str(user.id),
            "email": user.email,
            "type": "password_reset",
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
        }
        expired_token = jwt.encode(expired_payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

        res_expired = self.client.post(
            "/auth/reset-password",
            json={"token": expired_token, "new_password": "AnotherNewPassword123!"},
        )
        self.assertEqual(res_expired.status_code, 400)
        self.assertIn("Invalid or expired reset link", res_expired.json().get("detail", ""))

    def test_resend_otp_generates_new_challenge(self):
        user = self._make_user("resend_otp_user@example.com", STUDENT)
        login_res = self.client.post(
            "/auth/login",
            json={"email": "resend_otp_user@example.com", "password": PASSWORD, "role": STUDENT},
        )
        self.assertEqual(login_res.status_code, 200)
        orig_challenge = login_res.json().get("otp_challenge_id")
        self.assertIsNotNone(orig_challenge)

        resend_res = self.client.post(
            "/auth/resend-otp",
            json={"challenge_id": orig_challenge},
        )
        self.assertEqual(resend_res.status_code, 200)
        resend_data = resend_res.json()
        self.assertTrue(resend_data.get("otp_required"))
        self.assertIsNotNone(resend_data.get("otp_challenge_id"))

    def test_login_otp_challenge_expires_after_10_minutes(self):
        import jwt
        from datetime import datetime, timezone, timedelta

        user = self._make_user("otp_expired_user@example.com", STUDENT)
        expired_payload = {
            "sub": str(user.id),
            "role": user.role.name,
            "institute_id": None,
            "type": "login_otp",
            "iat": datetime.now(timezone.utc) - timedelta(minutes=11),
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
            "jti": "test-expired-jti-123",
            "auth_method": "password",
            "remember_me": True,
            "otp_hash": "dummy_hash",
        }
        expired_token = jwt.encode(expired_payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

        verify_res = self.client.post(
            "/auth/verify-otp",
            json={"challenge_id": expired_token, "otp_code": "123456"},
        )
        self.assertEqual(verify_res.status_code, 401)
        self.assertIn("expired", verify_res.json().get("detail", "").lower())


if __name__ == "__main__":
    unittest.main()
