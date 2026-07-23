import asyncio
import io
import unittest

from fastapi import HTTPException, UploadFile
from cryptography.fernet import Fernet
from starlette.datastructures import Headers

from app.config import Settings
from app.core.rate_limit import enforce_rate_limit, reset_rate_limits
from app.core.uploads import read_validated_speaking_answer


def _upload(content_type: str, content: bytes) -> UploadFile:
    return UploadFile(
        io.BytesIO(content),
        filename="recording",
        headers=Headers({"content-type": content_type}),
    )


class RegistrationRateLimitTests(unittest.TestCase):
    def tearDown(self) -> None:
        reset_rate_limits()

    def test_rejects_requests_over_limit(self) -> None:
        enforce_rate_limit("register:test", 2, 60)
        enforce_rate_limit("register:test", 2, 60)
        with self.assertRaises(HTTPException) as caught:
            enforce_rate_limit("register:test", 2, 60)
        self.assertEqual(caught.exception.status_code, 429)
        self.assertIn("Retry-After", caught.exception.headers)


class ProductionConfigurationTests(unittest.TestCase):
    def test_encryption_key_is_required_in_production(self) -> None:
        with self.assertRaises(ValueError):
            Settings(
                _env_file=None,
                database_url="sqlite://",
                jwt_secret_key="test-secret",
                app_environment="production",
                settings_encryption_key=None,
            )

    def test_production_does_not_add_local_cors_origins(self) -> None:
        configured = Settings(
            _env_file=None,
            database_url="sqlite://",
            jwt_secret_key="test-secret",
            app_environment="production",
            settings_encryption_key=Fernet.generate_key().decode("utf-8"),
            cors_origins="https://app.example.com",
        )
        self.assertEqual(configured.cors_origin_list, ["https://app.example.com"])
        self.assertIsNone(configured.cors_origin_regex)

    def test_wildcard_cors_is_rejected_for_credentialed_requests(self) -> None:
        with self.assertRaises(ValueError):
            Settings(
                _env_file=None,
                database_url="sqlite://",
                jwt_secret_key="test-secret",
                cors_origins="*",
            )


class SpeakingUploadValidationTests(unittest.TestCase):
    def test_accepts_supported_container_signature(self) -> None:
        content, extension = asyncio.run(
            read_validated_speaking_answer(
                _upload("audio/webm", b"\x1a\x45\xdf\xa3" + b"\x00" * 24)
            )
        )
        self.assertEqual(extension, ".webm")
        self.assertTrue(content.startswith(b"\x1a\x45\xdf\xa3"))

    def test_rejects_declared_audio_with_arbitrary_content(self) -> None:
        with self.assertRaises(HTTPException) as caught:
            asyncio.run(
                read_validated_speaking_answer(
                    _upload("audio/webm", b"<script>not audio</script>")
                )
            )
        self.assertEqual(caught.exception.status_code, 400)

    def test_rejects_mismatched_audio_container(self) -> None:
        with self.assertRaises(HTTPException):
            asyncio.run(
                read_validated_speaking_answer(
                    _upload("audio/wav", b"OggS" + b"\x00" * 24)
                )
            )


if __name__ == "__main__":
    unittest.main()
