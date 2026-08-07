import asyncio
import io
import unittest
from unittest import mock

from fastapi import HTTPException, UploadFile
from cryptography.fernet import Fernet
from starlette.datastructures import Headers

from app.config import Settings, settings
from app.middleware.security_headers import CONTENT_SECURITY_POLICY
from app.core.rate_limit import enforce_rate_limit, reset_rate_limits
from app.core.security import (
    generate_login_otp_code,
    hash_login_otp_code,
    verify_login_otp_code,
)
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
            allowed_hosts="api.example.com",
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

    def test_production_requires_explicit_allowed_hosts(self) -> None:
        with self.assertRaises(ValueError):
            Settings(
                _env_file=None,
                database_url="sqlite://",
                jwt_secret_key="test-secret",
                app_environment="production",
                settings_encryption_key=Fernet.generate_key().decode("utf-8"),
                cors_origins="https://app.example.com",
            )

    def test_development_allows_temporary_demo_hosts(self) -> None:
        configured = Settings(
            _env_file=None,
            database_url="sqlite://",
            jwt_secret_key="test-secret",
        )
        self.assertEqual(configured.allowed_host_list, ["*"])


class SecurityHeadersTests(unittest.TestCase):
    def test_csp_blocks_inline_scripts_and_embedding(self) -> None:
        self.assertIn("script-src 'self'", CONTENT_SECURITY_POLICY)
        self.assertIn("object-src 'none'", CONTENT_SECURITY_POLICY)
        self.assertIn("frame-ancestors 'none'", CONTENT_SECURITY_POLICY)


class LoginOtpSecurityTests(unittest.TestCase):
    def test_generated_otp_is_six_digits_and_verified_by_hash(self) -> None:
        with mock.patch.object(settings, "dev_static_otp_code", None):
            otp = generate_login_otp_code()
        self.assertRegex(otp, r"^\d{6}$")
        otp_hash = hash_login_otp_code(otp)
        self.assertNotIn(otp, otp_hash)
        self.assertTrue(verify_login_otp_code(otp, otp_hash))
        self.assertFalse(verify_login_otp_code("000000" if otp != "000000" else "000001", otp_hash))

    def test_static_dev_otp_still_goes_through_real_hash_verification(self) -> None:
        with mock.patch.object(settings, "dev_static_otp_code", "123456"), \
                mock.patch.object(settings, "app_environment", "development"):
            otp = generate_login_otp_code()
        self.assertEqual(otp, "123456")
        otp_hash = hash_login_otp_code(otp)
        self.assertNotIn(otp, otp_hash)
        self.assertTrue(verify_login_otp_code(otp, otp_hash))
        # A fixed code must not turn into an "any code works" bypass.
        self.assertFalse(verify_login_otp_code("654321", otp_hash))

    def test_static_dev_otp_is_ignored_outside_development(self) -> None:
        with mock.patch.object(settings, "dev_static_otp_code", "123456"), \
                mock.patch.object(settings, "app_environment", "production"):
            otp = generate_login_otp_code()
        self.assertRegex(otp, r"^\d{6}$")
        self.assertNotEqual(otp, "123456")

    def test_production_settings_reject_a_static_otp_code(self) -> None:
        with self.assertRaises(ValueError):
            Settings(
                _env_file=None,
                database_url="sqlite://",
                jwt_secret_key="test-secret",
                app_environment="production",
                settings_encryption_key=Fernet.generate_key().decode("utf-8"),
                allowed_hosts="api.example.com",
                dev_static_otp_code="123456",
            )


class SpeakingUploadValidationTests(unittest.TestCase):
    def test_accepts_supported_container_signature(self) -> None:
        content, extension = asyncio.run(
            read_validated_speaking_answer(
                _upload("audio/webm", b"\x1a\x45\xdf\xa3" + b"\x00" * 4092)
            )
        )
        self.assertEqual(extension, ".webm")
        self.assertTrue(content.startswith(b"\x1a\x45\xdf\xa3"))

    def test_rejects_header_only_recording(self) -> None:
        with self.assertRaises(HTTPException) as caught:
            asyncio.run(
                read_validated_speaking_answer(
                    _upload("audio/webm", b"\x1a\x45\xdf\xa3" + b"\x00" * 128)
                )
            )
        self.assertIn("too short", caught.exception.detail)

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
