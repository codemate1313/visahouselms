import asyncio
import io
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi import HTTPException, UploadFile
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.datastructures import Headers

from app.config import settings
from app.core.uploads import read_compressed_profile_image
from app.core.security import hash_password
from app.models import Base
from app.models.role import SUPER_ADMIN, Role
from app.models.user import User
from app.models.user_session import UserSession
from app.models.institute import Institute
from app.services import account_service


def _upload(content: bytes, content_type: str = "image/png") -> UploadFile:
    return UploadFile(
        io.BytesIO(content),
        filename="profile.png",
        headers=Headers({"content-type": content_type}),
    )


class ProfileImageCompressionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.storage = tempfile.TemporaryDirectory()
        self.original_storage_dir = settings.storage_dir
        settings.storage_dir = self.storage.name

    def tearDown(self) -> None:
        settings.storage_dir = self.original_storage_dir
        self.storage.cleanup()

    def test_large_source_is_resized_and_compressed_to_webp(self) -> None:
        image = Image.frombytes("RGB", (2200, 1400), os.urandom(2200 * 1400 * 3))
        source = io.BytesIO()
        image.save(source, format="PNG")
        source_bytes = source.getvalue()
        self.assertGreater(len(source_bytes), 2 * 1024 * 1024)

        extension, compressed = asyncio.run(read_compressed_profile_image(_upload(source_bytes)))

        self.assertEqual(extension, ".webp")
        self.assertLess(len(compressed), len(source_bytes))
        with Image.open(io.BytesIO(compressed)) as result:
            self.assertEqual(result.format, "WEBP")
            self.assertLessEqual(max(result.size), 1600)

    def test_transparent_image_keeps_alpha_channel(self) -> None:
        source = io.BytesIO()
        Image.new("RGBA", (400, 300), (220, 30, 80, 96)).save(source, format="PNG")

        _, compressed = asyncio.run(read_compressed_profile_image(_upload(source.getvalue())))

        with Image.open(io.BytesIO(compressed)) as result:
            self.assertEqual(result.mode, "RGBA")

    def test_invalid_image_payload_is_rejected(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            asyncio.run(read_compressed_profile_image(_upload(b"not an image")))
        self.assertEqual(raised.exception.status_code, 400)

    def test_temporary_avatar_is_stored_as_compressed_webp(self) -> None:
        source = io.BytesIO()
        Image.new("RGB", (2400, 1800), "#e11d48").save(source, format="PNG")

        result = asyncio.run(account_service.save_temp_avatar(_upload(source.getvalue())))

        self.assertTrue(result["avatar_path"].endswith(".webp"))
        stored_path = settings.storage_path / result["avatar_path"]
        self.assertTrue(stored_path.is_file())
        with Image.open(stored_path) as stored:
            self.assertLessEqual(max(stored.size), 1600)


class AccountSessionLocationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        role = Role(name=SUPER_ADMIN)
        self.db.add(role)
        self.db.flush()
        self.actor = User(
            email="session-owner@example.test",
            password_hash=hash_password("SessionPassword!1"),
            role_id=role.id,
            first_name="Session",
            last_name="Owner",
            is_active=True,
        )
        self.db.add(self.actor)
        self.db.flush()

        now = datetime.now(timezone.utc)
        self.session = UserSession(
            user_id=self.actor.id,
            refresh_token_hash="refresh-hash",
            user_agent="Mozilla/5.0 Chrome",
            ip_address="8.8.8.8",
            created_at=now,
            expires_at=now + timedelta(days=1),
        )
        self.db.add(self.session)
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_list_sessions_includes_approximate_location(self) -> None:
        location = {
            "label": "Mountain View, United States",
            "city": "Mountain View",
            "country": "United States",
            "latitude": 37.386,
            "longitude": -122.0838,
            "resolved": True,
        }

        with patch("app.services.geoip_service.locate", return_value=location) as locate:
            sessions = account_service.list_sessions(self.db, self.actor, self.session.id)

        locate.assert_called_once_with("8.8.8.8")
        self.assertEqual(sessions[0]["location"], location)
        self.assertTrue(sessions[0]["is_current"])


class AccountCredentialsEmailTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        # Set up roles
        self.roles = {}
        for name in ("SA_INSTRUCTOR", "INST_INSTRUCTOR", "STUDENT"):
            role = Role(name=name)
            self.db.add(role)
            self.roles[name] = role

        self.institute = Institute(name="Visa House Test Academy", slug="vh-test-academy", is_active=True)
        self.db.add(self.institute)
        self.db.flush()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    @patch("app.services.smtp_service.send_email")
    def test_send_credentials_super_instructor(self, mock_send) -> None:
        user = User(
            email="super-inst@example.test",
            password_hash="hash",
            role_id=self.roles["SA_INSTRUCTOR"].id,
            first_name="Super",
            last_name="Instructor",
            is_active=True,
        )
        self.db.add(user)
        self.db.flush()

        account_service.send_account_credentials_email(self.db, user, "TempPassword123")

        self.assertTrue(mock_send.called)
        db_arg, email_arg, subject, plain = mock_send.call_args[0]
        html = mock_send.call_args[1].get("html_body")
        self.assertIn("Super Instructor Account is Ready", subject)
        self.assertIn("assigned as a Super Instructor of Visa House", plain)
        self.assertIn("assigned as a <strong style=\"color: #0f172a;\">Super Instructor</strong> of Visa House", html)

    @patch("app.services.smtp_service.send_email")
    def test_send_credentials_institute_instructor(self, mock_send) -> None:
        user = User(
            email="inst-inst@example.test",
            password_hash="hash",
            role_id=self.roles["INST_INSTRUCTOR"].id,
            institute_id=self.institute.id,
            first_name="Regular",
            last_name="Instructor",
            is_active=True,
        )
        self.db.add(user)
        self.db.flush()

        # Refresh to populate user.institute relation
        self.db.refresh(user)

        account_service.send_account_credentials_email(self.db, user, "TempPassword123")

        self.assertTrue(mock_send.called)
        db_arg, email_arg, subject, plain = mock_send.call_args[0]
        html = mock_send.call_args[1].get("html_body")
        self.assertIn("Instructor Account is Ready", subject)
        self.assertIn("become an instructor of Visa House Test Academy", plain)
        self.assertIn("become an instructor of <strong style=\"color: #0f172a;\">Visa House Test Academy</strong>", html)


if __name__ == "__main__":
    unittest.main()
