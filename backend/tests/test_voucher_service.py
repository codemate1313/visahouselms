"""Payment-integrity tests for the exam voucher purchase flow.

A voucher code is money. `create_voucher_order` deliberately *reserves* a code
against a pending purchase before the buyer pays, so every read path has to be
careful to treat a pending purchase as a checkout attempt rather than a
delivered voucher, and `verify_voucher_payment` has to prove the receipt belongs
to this purchase's own order.
"""

import hashlib
import hmac
import unittest
from decimal import Decimal
from unittest import mock

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.models import Base
from app.models.role import STUDENT, Role
from app.models.user import User
from app.models.voucher import VoucherCode, VoucherOffering, VoucherPurchase, VoucherType
from app.services import settings_service, voucher_service

KEY_ID = "rzp_test_key"
KEY_SECRET = "rzp_test_secret"
ORDER_ID = "order_TESTORDER001"


def _signature(order_id: str, payment_id: str, secret: str = KEY_SECRET) -> str:
    return hmac.new(
        secret.encode("utf-8"), f"{order_id}|{payment_id}".encode("utf-8"), hashlib.sha256
    ).hexdigest()


class VoucherPurchaseTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        role = Role(name=STUDENT)
        self.db.add(role)
        self.db.flush()
        self.student = User(
            email="buyer@example.com",
            password_hash=hash_password("StudentPass!1"),
            role_id=role.id,
            first_name="Bea",
            last_name="Buyer",
            is_active=True,
        )
        self.db.add(self.student)

        self.voucher_type = VoucherType(name="LanguageCert Academic", code="languagecert-academic")
        self.db.add(self.voucher_type)
        self.db.flush()
        self.offering = VoucherOffering(
            voucher_type_id=self.voucher_type.id,
            title="Academic Exam Voucher",
            price=Decimal("5000.00"),
            validity_days=180,
            is_active=True,
        )
        self.db.add(self.offering)
        self.db.flush()
        self.db.add_all(
            [
                VoucherCode(voucher_type_id=self.voucher_type.id, code=f"CODE{i:012d}", status="available")
                for i in range(3)
            ]
        )
        self.db.commit()

        settings_service.set_setting(self.db, "payment_gateways.razorpay_enabled", "true")
        settings_service.set_setting(self.db, "payment_gateways.razorpay_key_id", KEY_ID)
        settings_service.set_setting(self.db, "payment_gateways.razorpay_key_secret", KEY_SECRET)
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _place_order(self, order_id: str = ORDER_ID) -> dict:
        response = mock.Mock(status_code=200)
        response.json.return_value = {"id": order_id}
        with mock.patch("app.services.voucher_service.requests.post", return_value=response):
            return voucher_service.create_voucher_order(
                db=self.db,
                offering_id=self.offering.id,
                buyer_name="Bea Buyer",
                buyer_email=self.student.email,
                buyer_phone="9999999999",
                student_user_id=self.student.id,
            )

    def _my_vouchers(self) -> list:
        return voucher_service.get_student_purchased_vouchers(
            self.db, self.student.id, self.student.email
        )

    # --- the reported bug ------------------------------------------------

    def test_placing_an_order_does_not_hand_the_student_a_voucher(self) -> None:
        self._place_order()

        self.assertEqual(self._my_vouchers(), [])

    def test_order_reserves_a_code_without_completing_the_purchase(self) -> None:
        order = self._place_order()

        purchase = self.db.get(VoucherPurchase, order["purchase_id"])
        self.assertEqual(purchase.status, "pending")
        code = self.db.get(VoucherCode, purchase.voucher_code_id)
        self.assertEqual(code.status, "reserved")
        self.assertIsNone(code.purchased_at)

    def test_voucher_appears_only_after_the_payment_is_verified(self) -> None:
        order = self._place_order()
        self.assertEqual(self._my_vouchers(), [])

        with mock.patch.object(voucher_service.smtp_service, "send_voucher_purchase_email"):
            voucher_service.verify_voucher_payment(
                db=self.db,
                purchase_id=order["purchase_id"],
                razorpay_payment_id="pay_123",
                razorpay_order_id=ORDER_ID,
                razorpay_signature=_signature(ORDER_ID, "pay_123"),
            )

        vouchers = self._my_vouchers()
        self.assertEqual(len(vouchers), 1)
        self.assertEqual(vouchers[0]["status"], "completed")
        self.assertTrue(vouchers[0]["raw_code"])

    def test_admin_deleting_the_reserved_code_fails_a_later_verify(self) -> None:
        """An admin's delete_voucher_codes call is expected to skip a reserved
        code (see test_bulk_delete_removes_only_unused_codes), but this is the
        backstop for any path that still marks one deleted mid-checkout - the
        purchase must fail cleanly rather than hand over a code the platform
        considers gone."""
        order = self._place_order()
        purchase = self.db.get(VoucherPurchase, order["purchase_id"])
        code = self.db.get(VoucherCode, purchase.voucher_code_id)
        code.deleted_at = voucher_service._now()
        code.status = "disabled"
        self.db.commit()

        with self.assertRaises(HTTPException) as ctx:
            voucher_service.verify_voucher_payment(
                db=self.db,
                purchase_id=order["purchase_id"],
                razorpay_payment_id="pay_123",
                razorpay_order_id=ORDER_ID,
                razorpay_signature=_signature(ORDER_ID, "pay_123"),
            )
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(self._my_vouchers(), [])

    def test_failed_purchase_is_not_listed_as_a_voucher(self) -> None:
        order = self._place_order()
        with self.assertRaises(HTTPException):
            voucher_service.verify_voucher_payment(
                db=self.db,
                purchase_id=order["purchase_id"],
                razorpay_payment_id="pay_123",
                razorpay_order_id=ORDER_ID,
                razorpay_signature="forged",
            )

        self.assertEqual(self._my_vouchers(), [])

    # --- receipt binding --------------------------------------------------

    def test_a_valid_receipt_for_another_order_cannot_unlock_the_voucher(self) -> None:
        order = self._place_order()
        # Correctly signed, but for an order this purchase never opened.
        other_order_id = "order_SOMEONEELSE"

        with self.assertRaises(HTTPException) as context:
            voucher_service.verify_voucher_payment(
                db=self.db,
                purchase_id=order["purchase_id"],
                razorpay_payment_id="pay_999",
                razorpay_order_id=other_order_id,
                razorpay_signature=_signature(other_order_id, "pay_999"),
            )

        self.assertEqual(context.exception.status_code, 400)
        purchase = self.db.get(VoucherPurchase, order["purchase_id"])
        self.assertEqual(purchase.status, "failed")
        self.assertEqual(self._my_vouchers(), [])

    def test_a_forged_signature_releases_the_reserved_code(self) -> None:
        order = self._place_order()
        purchase = self.db.get(VoucherPurchase, order["purchase_id"])
        reserved_code_id = purchase.voucher_code_id

        with self.assertRaises(HTTPException):
            voucher_service.verify_voucher_payment(
                db=self.db,
                purchase_id=order["purchase_id"],
                razorpay_payment_id="pay_123",
                razorpay_order_id=ORDER_ID,
                razorpay_signature=_signature(ORDER_ID, "pay_123", secret="wrong_secret"),
            )

        code = self.db.get(VoucherCode, reserved_code_id)
        self.assertEqual(code.status, "available")
        self.assertIsNone(code.purchase_id)

    def test_verifying_twice_does_not_issue_a_second_code(self) -> None:
        order = self._place_order()
        signature = _signature(ORDER_ID, "pay_123")
        with mock.patch.object(voucher_service.smtp_service, "send_voucher_purchase_email") as send_mail:
            for _ in range(2):
                voucher_service.verify_voucher_payment(
                    db=self.db,
                    purchase_id=order["purchase_id"],
                    razorpay_payment_id="pay_123",
                    razorpay_order_id=ORDER_ID,
                    razorpay_signature=signature,
                )

        self.assertEqual(send_mail.call_count, 1)
        self.assertEqual(len(self._my_vouchers()), 1)

    # --- webhook completion ----------------------------------------------

    def test_webhook_completes_a_purchase_whose_browser_never_returned(self) -> None:
        order = self._place_order()

        with mock.patch.object(voucher_service.smtp_service, "send_voucher_purchase_email"):
            result = voucher_service.complete_voucher_purchase_from_webhook(
                self.db, order["purchase_id"], ORDER_ID, "pay_hook"
            )

        self.assertIsNotNone(result)
        self.assertEqual(len(self._my_vouchers()), 1)

    def test_webhook_ignores_a_capture_for_a_different_order(self) -> None:
        order = self._place_order()

        result = voucher_service.complete_voucher_purchase_from_webhook(
            self.db, order["purchase_id"], "order_UNRELATED", "pay_hook"
        )

        self.assertIsNone(result)
        self.assertEqual(self._my_vouchers(), [])

    def test_webhook_after_client_verify_does_not_resend_the_code(self) -> None:
        order = self._place_order()
        with mock.patch.object(voucher_service.smtp_service, "send_voucher_purchase_email") as send_mail:
            voucher_service.verify_voucher_payment(
                db=self.db,
                purchase_id=order["purchase_id"],
                razorpay_payment_id="pay_123",
                razorpay_order_id=ORDER_ID,
                razorpay_signature=_signature(ORDER_ID, "pay_123"),
            )
            voucher_service.complete_voucher_purchase_from_webhook(
                self.db, order["purchase_id"], ORDER_ID, "pay_123"
            )

        self.assertEqual(send_mail.call_count, 1)
        self.assertEqual(len(self._my_vouchers()), 1)

    # --- stock ------------------------------------------------------------

    def test_no_order_is_possible_when_the_gateway_is_not_configured(self) -> None:
        settings_service.set_setting(self.db, "payment_gateways.razorpay_enabled", "false")
        self.db.commit()

        with self.assertRaises(HTTPException) as context:
            self._place_order()

        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(self._my_vouchers(), [])

    def test_cancel_pending_purchase_releases_reserved_code(self) -> None:
        order = self._place_order()
        purchase = self.db.get(VoucherPurchase, order["purchase_id"])
        reserved_code_id = purchase.voucher_code_id

        result = voucher_service.cancel_pending_voucher_purchase(
            self.db,
            purchase_id=order["purchase_id"],
            razorpay_order_id=ORDER_ID,
            student_user_id=self.student.id,
        )

        self.assertTrue(result["cancelled"])
        self.assertEqual(purchase.status, "failed")
        self.assertIsNone(purchase.voucher_code_id)
        code = self.db.get(VoucherCode, reserved_code_id)
        self.assertEqual(code.status, "available")
        self.assertIsNone(code.purchase_id)

    def test_student_cannot_cancel_another_students_pending_purchase(self) -> None:
        order = self._place_order()
        other_student = User(
            email="other-buyer@example.com",
            password_hash=hash_password("StudentPass!1"),
            role_id=self.student.role_id,
            first_name="Other",
            last_name="Buyer",
            is_active=True,
        )
        self.db.add(other_student)
        self.db.commit()

        with self.assertRaises(HTTPException) as context:
            voucher_service.cancel_pending_voucher_purchase(
                self.db,
                purchase_id=order["purchase_id"],
                razorpay_order_id=ORDER_ID,
                student_user_id=other_student.id,
            )

        self.assertEqual(context.exception.status_code, 404)
        purchase = self.db.get(VoucherPurchase, order["purchase_id"])
        code = self.db.get(VoucherCode, purchase.voucher_code_id)
        self.assertEqual(purchase.status, "pending")
        self.assertEqual(code.status, "reserved")

    def test_bulk_delete_removes_only_unused_codes(self) -> None:
        order = self._place_order()
        reserved_purchase = self.db.get(VoucherPurchase, order["purchase_id"])
        reserved_code_id = reserved_purchase.voucher_code_id
        unused_codes = (
            self.db.query(VoucherCode)
            .filter(VoucherCode.id != reserved_code_id)
            .order_by(VoucherCode.id.asc())
            .all()
        )
        unused_codes[1].status = "disabled"
        self.db.commit()

        result = voucher_service.delete_voucher_codes(
            self.db,
            [reserved_code_id, unused_codes[0].id, unused_codes[1].id],
        )

        self.assertEqual(result["deleted"], 2)
        self.assertEqual(result["skipped"], 1)
        self.assertEqual(result["skipped_reserved"], 1)

        # The reserved code is a checkout in progress - it must be left
        # completely untouched, not soft-deleted, so a payment that verifies a
        # moment later still finds a live, "reserved" code to complete against.
        reserved_code = self.db.get(VoucherCode, reserved_code_id)
        self.assertIsNone(reserved_code.deleted_at)
        self.assertEqual(reserved_code.status, "reserved")

        # Deletion in this service is a soft delete everywhere else
        # (voucher types, offerings, single codes), so the bulk path is
        # expected to match: the row survives with `deleted_at` stamped and
        # `status` flipped to "disabled", not removed outright.
        for code in unused_codes[:2]:
            deleted_code = self.db.get(VoucherCode, code.id)
            self.assertIsNotNone(deleted_code)
            self.assertIsNotNone(deleted_code.deleted_at)
            self.assertEqual(deleted_code.status, "disabled")


if __name__ == "__main__":
    unittest.main()
