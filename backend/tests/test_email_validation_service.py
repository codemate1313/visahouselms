import unittest
from types import SimpleNamespace
from unittest import mock

from email_validator import EmailUndeliverableError
from fastapi import HTTPException

from app.services import account_service, email_validation_service


class EmailValidationServiceTests(unittest.TestCase):
    def test_valid_email_is_normalized(self) -> None:
        with mock.patch.object(
            email_validation_service,
            "validate_email",
            return_value=SimpleNamespace(normalized="Person@Gmail.com"),
        ):
            result = email_validation_service.validate_account_email(" Person@Gmail.com ")

        self.assertEqual(result, "person@gmail.com")

    def test_domain_that_cannot_receive_email_is_rejected(self) -> None:
        with mock.patch.object(
            email_validation_service,
            "validate_email",
            side_effect=EmailUndeliverableError("The domain does not accept email."),
        ):
            with self.assertRaises(HTTPException) as raised:
                email_validation_service.validate_account_email("person@missing.example")

        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(raised.exception.detail, account_service.INVALID_ACCOUNT_EMAIL_DETAIL)


if __name__ == "__main__":
    unittest.main()
