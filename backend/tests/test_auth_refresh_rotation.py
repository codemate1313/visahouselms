"""Rotation of refresh tokens, and the grace window that keeps reloads working.

/auth/refresh rotates: it issues a replacement and retires the token presented.
Because the access token lives only in memory, every page load has to make that
call, and a load that is abandoned part-way - a reload during the request, two
refreshes racing on one cookie - can leave the browser holding the token the
server just retired. These tests pin down that such a token is still honoured
for a short window, while a genuinely stale one is treated as theft.
"""

from datetime import datetime, timedelta, timezone
import unittest
from unittest import mock

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.core.security import hash_password, hash_refresh_token
from app.models import Base
from app.models.role import STUDENT, Role
from app.models.user import User
from app.models.user_session import UserSession
from app.services import auth_service


class RefreshRotationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        role = Role(name=STUDENT)
        self.db.add(role)
        self.db.flush()
        self.user = User(
            email="rotation.student@example.com",
            password_hash=hash_password("StudentPassword!1"),
            role_id=role.id,
            institute_id=None,
            first_name="Rotation",
            last_name="Student",
            is_active=True,
        )
        self.db.add(self.user)
        self.db.commit()
        self.db.refresh(self.user)

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _login(self, device_id: str = "device-rotation-000000001"):
        return auth_service.login(
            self.db,
            self.user.email,
            "StudentPassword!1",
            "Test Browser",
            "127.0.0.1",
            device_id,
            "Chrome on macOS",
        )

    def _refresh(self, token: str):
        return auth_service.refresh(self.db, token, "Test Browser", "127.0.0.1")

    def _session_for(self, token: str) -> UserSession:
        return (
            self.db.query(UserSession)
            .filter(UserSession.refresh_token_hash == hash_refresh_token(token))
            .one()
        )

    def _age_rotation(self, token: str, seconds: int) -> None:
        """Backdate a token's rotation so the grace window has passed."""
        session = self._session_for(token)
        session.rotated_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(
            seconds=seconds
        )
        self.db.add(session)
        self.db.commit()

    def test_rotation_issues_a_new_pair_and_links_the_replacement(self):
        _access, first_refresh = self._login()

        _new_access, second_refresh = self._refresh(first_refresh)

        self.assertNotEqual(first_refresh, second_refresh)
        retired = self._session_for(first_refresh)
        self.assertIsNotNone(retired.revoked_at)
        self.assertIsNotNone(retired.rotated_at)
        self.assertEqual(self._session_for(second_refresh).rotated_from_id, retired.id)

    def test_the_replacement_token_works(self):
        _access, first_refresh = self._login()
        _a, second_refresh = self._refresh(first_refresh)

        _b, third_refresh = self._refresh(second_refresh)

        self.assertNotEqual(second_refresh, third_refresh)

    def test_reload_that_lost_the_new_cookie_still_refreshes(self):
        """The reload case: the browser never received the rotated cookie."""
        _access, first_refresh = self._login()
        self._refresh(first_refresh)

        # Same token again, immediately - the response carrying its replacement
        # never made it back to the browser.
        access, replayed_refresh = self._refresh(first_refresh)

        self.assertTrue(access)
        self.assertIsNone(self._session_for(replayed_refresh).revoked_at)

    def test_replay_keeps_the_racing_pair_alive_as_a_sibling(self):
        """Two tabs reloading at once: whichever cookie the jar kept must work."""
        _access, first_refresh = self._login()
        _a, sibling_refresh = self._refresh(first_refresh)
        _b, replayed_refresh = self._refresh(first_refresh)

        self.assertNotEqual(sibling_refresh, replayed_refresh)
        parent_id = self._session_for(first_refresh).id
        self.assertEqual(self._session_for(sibling_refresh).rotated_from_id, parent_id)
        self.assertEqual(self._session_for(replayed_refresh).rotated_from_id, parent_id)
        # Either one can still carry the session forward.
        self.assertTrue(self._refresh(sibling_refresh))
        self.assertTrue(self._refresh(replayed_refresh))

    def test_reuse_detection_revokes_every_sibling(self):
        _access, first_refresh = self._login()
        _a, sibling_refresh = self._refresh(first_refresh)
        _b, replayed_refresh = self._refresh(first_refresh)
        self._age_rotation(first_refresh, settings.refresh_rotation_grace_seconds + 60)

        with self.assertRaises(HTTPException):
            self._refresh(first_refresh)

        self.assertIsNotNone(self._session_for(sibling_refresh).revoked_at)
        self.assertIsNotNone(self._session_for(replayed_refresh).revoked_at)

    def test_logout_ends_every_sibling(self):
        _access, first_refresh = self._login()
        _a, sibling_refresh = self._refresh(first_refresh)
        _b, replayed_refresh = self._refresh(first_refresh)

        auth_service.logout(self.db, first_refresh)

        self.assertIsNotNone(self._session_for(sibling_refresh).revoked_at)
        self.assertIsNotNone(self._session_for(replayed_refresh).revoked_at)

    def test_replay_after_the_grace_window_is_refused(self):
        _access, first_refresh = self._login()
        self._refresh(first_refresh)
        self._age_rotation(first_refresh, settings.refresh_rotation_grace_seconds + 60)

        with self.assertRaises(HTTPException) as caught:
            self._refresh(first_refresh)
        self.assertEqual(caught.exception.status_code, 401)

    def test_replay_after_the_grace_window_revokes_the_live_token(self):
        """A stale token resurfacing reads as theft, so the lineage is killed."""
        _access, first_refresh = self._login()
        _a, second_refresh = self._refresh(first_refresh)
        self._age_rotation(first_refresh, settings.refresh_rotation_grace_seconds + 60)

        with self.assertRaises(HTTPException):
            self._refresh(first_refresh)

        self.assertIsNotNone(self._session_for(second_refresh).revoked_at)
        with self.assertRaises(HTTPException):
            self._refresh(second_refresh)

    def test_logout_is_not_undone_by_an_in_flight_refresh(self):
        """A refresh sent before logout must not resurrect the session."""
        _access, first_refresh = self._login()
        _a, second_refresh = self._refresh(first_refresh)

        auth_service.logout(self.db, second_refresh)

        # Still inside the grace window, but the chain has been ended.
        with self.assertRaises(HTTPException) as caught:
            self._refresh(first_refresh)
        self.assertEqual(caught.exception.status_code, 401)

    def test_logout_with_a_stale_cookie_ends_the_live_token(self):
        _access, first_refresh = self._login()
        _a, second_refresh = self._refresh(first_refresh)

        # The tab logging out is one rotation behind.
        auth_service.logout(self.db, first_refresh)

        self.assertIsNotNone(self._session_for(second_refresh).revoked_at)

    def test_a_token_revoked_by_logout_never_gets_the_grace_window(self):
        _access, first_refresh = self._login()

        auth_service.logout(self.db, first_refresh)

        with self.assertRaises(HTTPException):
            self._refresh(first_refresh)

    def test_grace_window_of_zero_restores_strict_single_use(self):
        _access, first_refresh = self._login()
        self._refresh(first_refresh)

        with mock.patch.object(settings, "refresh_rotation_grace_seconds", 0):
            # rotated_at is "now", so only an exactly-simultaneous replay would
            # pass; backdate by a second to make the boundary unambiguous.
            self._age_rotation(first_refresh, 1)
            with self.assertRaises(HTTPException):
                self._refresh(first_refresh)

    def test_expired_session_is_refused_regardless_of_rotation(self):
        _access, first_refresh = self._login()
        session = self._session_for(first_refresh)
        session.expires_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=1)
        self.db.add(session)
        self.db.commit()

        with self.assertRaises(HTTPException):
            self._refresh(first_refresh)

    def test_rotation_does_not_extend_the_absolute_session_expiry(self):
        _access, first_refresh = self._login()
        original_expiry = self._session_for(first_refresh).expires_at

        _a, second_refresh = self._refresh(first_refresh)

        self.assertEqual(self._session_for(second_refresh).expires_at, original_expiry)


if __name__ == "__main__":
    unittest.main()
