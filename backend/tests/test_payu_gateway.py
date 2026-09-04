import unittest
import unittest.mock
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core import payu_gateway
from app.core.security import hash_password
from app.models import Base
from app.models.payment import Payment
from app.models.plan import Plan
from app.models.role import STUDENT, Role
from app.models.user import User
from app.services import currency_conversion_service, payment_service
from app.services.settings_service import set_settings_group

SALT = "eCwWELxi"
KEY = "gtKFFx"


class PayuHashTests(unittest.TestCase):
    """The signature is the whole of the trust in a PayU integration.

    The candidate's own browser carries the result back, so a payload claiming
    `status=success` takes seconds to write by hand - and the only thing
    separating that from a real payment is the exact layout of the hashed
    string. These pin the layout itself, not just a round trip, because a hash
    function agreeing with itself proves nothing about agreeing with PayU.
    """

    def _checkout(self, **overrides):
        args = dict(
            merchant_key=KEY, salt=SALT, mode="test", txnid="vh42xabc",
            amount=Decimal("1499"), product_info="IELTS Plan", first_name="Sam",
            email="sam@example.com", phone="9876543210",
            success_url="https://lms.test/api/v1/payments/webhook/payu/return",
            failure_url="https://lms.test/api/v1/payments/webhook/payu/return",
            udf={"udf1": "42", "udf2": "7", "udf3": "3"},
        )
        args.update(overrides)
        return payu_gateway.build_checkout(**args)

    def test_request_hash_follows_payus_documented_field_order(self):
        fields = self._checkout()["fields"]
        # key|txnid|amount|productinfo|firstname|email|udf1..udf10|salt
        self.assertEqual(
            payu_gateway._request_hash_string(fields, SALT),
            "gtKFFx|vh42xabc|1499.00|IELTS Plan|Sam|sam@example.com|42|7|3||||||||eCwWELxi",
        )

    def test_amount_is_hashed_exactly_as_it_is_posted(self):
        # A hash over "1499.0" never matches one PayU builds over "1499.00",
        # and the failure looks like a declined card rather than a bug here.
        fields = self._checkout(amount=Decimal("1499.0"))["fields"]
        self.assertEqual(fields["amount"], "1499.00")
        self.assertIn("|1499.00|", payu_gateway._request_hash_string(fields, SALT))

    def test_live_and_test_modes_post_to_different_hosts(self):
        self.assertEqual(self._checkout(mode="live")["action"], "https://secure.payu.in/_payment")
        self.assertEqual(self._checkout(mode="test")["action"], "https://test.payu.in/_payment")
        # Anything unrecognised stays on test rather than taking real money.
        self.assertEqual(self._checkout(mode="")["action"], "https://test.payu.in/_payment")

    def test_response_hash_is_the_request_layout_reversed(self):
        fields = self._checkout()["fields"]
        reply = {**fields, "status": "success"}
        self.assertEqual(
            payu_gateway._response_hash_string(reply, SALT),
            "eCwWELxi|success||||||||3|7|42|sam@example.com|Sam|IELTS Plan|1499.00|vh42xabc|gtKFFx",
        )

    def test_a_genuine_reply_verifies_and_a_tampered_one_does_not(self):
        fields = self._checkout()["fields"]
        reply = {**fields, "status": "success"}
        reply["hash"] = payu_gateway._sha512(payu_gateway._response_hash_string(reply, SALT))

        self.assertTrue(payu_gateway.verify_response(reply, SALT))
        # Every one of these is what a forged return looks like.
        self.assertFalse(payu_gateway.verify_response({**reply, "amount": "1.00"}, SALT))
        self.assertFalse(payu_gateway.verify_response({**reply, "txnid": "vh43xabc"}, SALT))
        self.assertFalse(payu_gateway.verify_response({**reply, "status": "failure"}, SALT))
        self.assertFalse(payu_gateway.verify_response({k: v for k, v in reply.items() if k != "hash"}, SALT))
        self.assertFalse(payu_gateway.verify_response(reply, "wrong-salt"))

    def test_additional_charges_are_prepended_when_payu_applies_them(self):
        fields = self._checkout()["fields"]
        reply = {**fields, "status": "success", "additionalCharges": "10.00"}
        self.assertTrue(payu_gateway._response_hash_string(reply, SALT).startswith("10.00|eCwWELxi|success|"))


class PayuSettlementTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        role = Role(name=STUDENT)
        self.db.add(role)
        self.db.flush()
        self.student = User(
            email="buyer@payu.test",
            password_hash=hash_password("StudentPassword!1"),
            role_id=role.id,
            first_name="Sam",
            last_name="Student",
            is_active=True,
        )
        self.plan = Plan(
            name="PayU Plan", price=Decimal("1499.00"), duration_days=30,
            student_limit=1, staff_limit=0, grace_days=7, is_active=True, currency="INR",
        )
        self.db.add_all([self.student, self.plan])
        self.db.commit()
        set_settings_group(self.db, "payment_gateways", {
            "payu_enabled": "true", "payu_merchant_key": KEY, "payu_salt": SALT, "payu_mode": "test",
            "inr_gateway": "payu",
        })
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _pending_payment(self, txnid="vh1xabc", amount=Decimal("1499.00")) -> Payment:
        payment = Payment(
            source="b2c", user_id=self.student.id, plan_id=self.plan.id,
            amount=amount, final_amount=amount, amount_paid=Decimal("0.00"),
            currency="INR", gateway="payu", status="pending", gateway_reference=txnid,
        )
        self.db.add(payment)
        self.db.commit()
        return payment

    def _signed_reply(self, payment, status="success", **overrides):
        reply = {
            "key": KEY, "txnid": payment.gateway_reference,
            "amount": payu_gateway.format_amount(payment.final_amount),
            "productinfo": self.plan.name, "firstname": "Sam", "email": self.student.email,
            "udf1": str(payment.id), "udf2": str(self.student.id), "udf3": str(self.plan.id),
            "udf4": "", "udf5": "", "status": status, "mihpayid": "999",
        }
        reply.update(overrides)
        reply["hash"] = payu_gateway._sha512(payu_gateway._response_hash_string(reply, SALT))
        return reply

    def test_an_international_sale_carries_no_indian_gst(self):
        """The same plan must not cost more because PayU took the payment."""
        self.plan.usd_price = Decimal("59.00")
        self.plan.is_international_enabled = True
        self.db.commit()

        order = payment_service._create_payu_order(
            self.db, {"payu_merchant_key": KEY, "payu_salt": SALT, "payu_mode": "test"},
            self.plan, self.student, None, self.student.id, self.plan.id,
            currency="USD", base_price=Decimal("59.00"),
        )

        self.assertEqual(order["currency"], "USD")
        self.assertEqual(order["fields"]["currency"], "USD")
        self.assertEqual(order["fields"]["amount"], "59.00")
        payment = self.db.query(Payment).filter_by(id=order["payment_id"]).one()
        self.assertEqual(payment.currency, "USD")
        self.assertEqual(payment.gst_amount, Decimal("0.00"))
        self.assertEqual(payment.final_amount, Decimal("59.00"))

    def test_a_forged_success_does_not_pay_for_a_plan(self):
        payment = self._pending_payment()
        forged = self._signed_reply(payment)
        forged["hash"] = "0" * 128

        result = payment_service.settle_payu_return(self.db, forged)

        self.assertFalse(result["ok"])
        self.assertEqual(result["reason"], "invalid_signature")
        self.db.refresh(payment)
        self.assertEqual(payment.status, "failed")
        self.assertEqual(payment.amount_paid, Decimal("0.00"))

    def test_a_signed_reply_for_a_smaller_amount_is_refused(self):
        """A hash proves PayU sent it, not that it is the sale we started."""
        payment = self._pending_payment()
        cheap = self._signed_reply(payment, amount="1.00")

        result = payment_service.settle_payu_return(self.db, cheap)

        self.assertFalse(result["ok"])
        self.assertEqual(result["reason"], "amount_mismatch")
        self.db.refresh(payment)
        self.assertEqual(payment.status, "failed")

    def test_a_declined_payment_is_recorded_as_failed(self):
        payment = self._pending_payment()
        result = payment_service.settle_payu_return(self.db, self._signed_reply(payment, status="failure"))
        self.assertFalse(result["ok"])
        self.assertEqual(result["reason"], "declined")

    def test_an_unknown_transaction_is_ignored_rather_than_guessed_at(self):
        result = payment_service.settle_payu_return(self.db, {"txnid": "not-ours", "hash": "x"})
        self.assertFalse(result["ok"])
        self.assertEqual(result["reason"], "unknown_transaction")

    def test_the_same_result_arriving_twice_only_pays_once(self):
        """PayU sends this twice - the browser return and the webhook."""
        payment = self._pending_payment()
        reply = self._signed_reply(payment)

        first = payment_service.settle_payu_return(self.db, reply)
        second = payment_service.settle_payu_return(self.db, reply)

        self.assertTrue(first["ok"])
        self.assertEqual(first["reason"], "paid")
        self.assertTrue(second["ok"])
        self.assertEqual(second["reason"], "already_settled")
        self.db.refresh(payment)
        self.assertEqual(payment.status, "paid")
        self.assertEqual(payment.amount_paid, payment.final_amount)
        self.assertEqual(
            self.db.query(Payment).filter_by(status="paid").count(), 1
        )


class PayuInternationalTests(unittest.TestCase):
    def test_the_currency_is_posted_but_never_hashed(self):
        """PayU signs the amount, not the currency.

        Adding it to the hash string is the obvious mistake here, and it would
        make every international payment fail verification.
        """
        usd = payu_gateway.build_checkout(
            merchant_key=KEY, salt=SALT, mode="test", txnid="vh9xusd",
            amount=Decimal("59"), product_info="Plan", first_name="Sam",
            email="sam@example.com", phone="", success_url="https://x/s",
            failure_url="https://x/f", currency="usd",
        )
        self.assertEqual(usd["fields"]["currency"], "USD")
        self.assertNotIn("USD", payu_gateway._request_hash_string(usd["fields"], SALT))

        inr = payu_gateway.build_checkout(
            merchant_key=KEY, salt=SALT, mode="test", txnid="vh9xusd",
            amount=Decimal("59"), product_info="Plan", first_name="Sam",
            email="sam@example.com", phone="", success_url="https://x/s",
            failure_url="https://x/f",
        )
        # Same signature either way - the currency changes nothing about it.
        self.assertEqual(usd["fields"]["hash"], inr["fields"]["hash"])
        self.assertEqual(inr["fields"]["currency"], "INR")


class UsdGatewayChoiceTests(unittest.TestCase):
    def test_stripe_keeps_international_unless_payu_is_chosen(self):
        both = {
            "stripe_enabled": "true", "stripe_secret_key": "sk_test",
            "payu_enabled": "true", "payu_merchant_key": KEY, "payu_salt": SALT,
        }
        # Nothing chosen: international stays where it was.
        self.assertEqual(payment_service._usd_gateway(both), "stripe")
        self.assertEqual(payment_service._usd_gateway({**both, "usd_gateway": "payu"}), "payu")
        # Chosen but unusable falls through rather than blocking the sale.
        self.assertEqual(
            payment_service._usd_gateway({**both, "usd_gateway": "payu", "payu_salt": ""}), "stripe"
        )
        self.assertEqual(payment_service._usd_gateway({"usd_gateway": "payu"}), "")


class UsdPricingTests(unittest.TestCase):
    """Rupees in India, dollars outside it - for every plan, not only the ones
    somebody remembered to tick."""

    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _plan(self, **kwargs):
        plan = Plan(
            name="Plan", price=Decimal("4999.00"), duration_days=30,
            student_limit=1, staff_limit=0, grace_days=7, is_active=True, currency="INR",
        )
        for key, value in kwargs.items():
            setattr(plan, key, value)
        self.db.add(plan)
        self.db.commit()
        return plan

    def test_an_explicit_dollar_price_is_used_as_typed(self):
        plan = self._plan(usd_price=Decimal("49.00"), is_international_enabled=True)
        self.assertEqual(payment_service.usd_price_for(plan), Decimal("49.00"))

    def test_a_plan_with_no_dollar_price_still_has_one(self):
        """This is the case that used to charge rupees to an overseas student
        who had been shown a dollar price."""
        plan = self._plan()
        with unittest.mock.patch.object(
            currency_conversion_service, "get_inr_usd_display_rate", return_value={"rate": 0.0117}
        ):
            self.assertEqual(payment_service.usd_price_for(plan), Decimal("59"))

    def test_the_international_flag_no_longer_decides_who_can_pay_in_dollars(self):
        plan = self._plan(is_international_enabled=False)
        with unittest.mock.patch.object(
            currency_conversion_service, "get_inr_usd_display_rate", return_value={"rate": 0.0117}
        ):
            self.assertGreater(payment_service.usd_price_for(plan), Decimal("0"))

    def test_a_converted_price_is_a_whole_dollar_and_never_zero(self):
        with unittest.mock.patch.object(
            currency_conversion_service, "get_inr_usd_display_rate", return_value={"rate": 0.0117}
        ):
            self.assertEqual(currency_conversion_service.inr_to_usd(Decimal("10")), Decimal("1"))
            self.assertEqual(currency_conversion_service.inr_to_usd(Decimal("999")), Decimal("12"))
            # No fractional cents drifting with the daily rate.
            self.assertEqual(currency_conversion_service.inr_to_usd(Decimal("4999")) % 1, 0)


class InrGatewayChoiceTests(unittest.TestCase):
    def test_the_chosen_gateway_wins_and_an_unusable_choice_falls_through(self):
        both = {
            "razorpay_enabled": "true", "razorpay_key_id": "k", "razorpay_key_secret": "s",
            "payu_enabled": "true", "payu_merchant_key": KEY, "payu_salt": SALT,
        }
        self.assertEqual(payment_service._inr_gateway({**both, "inr_gateway": "payu"}), "payu")
        self.assertEqual(payment_service._inr_gateway({**both, "inr_gateway": "razorpay"}), "razorpay")

        # Chosen but not actually set up: students still get a way to pay.
        half = {**both, "inr_gateway": "payu", "payu_salt": ""}
        self.assertEqual(payment_service._inr_gateway(half), "razorpay")

        # Nothing configured at all is reported as nothing, not as a default.
        self.assertEqual(payment_service._inr_gateway({"inr_gateway": "payu"}), "")


if __name__ == "__main__":
    unittest.main()
