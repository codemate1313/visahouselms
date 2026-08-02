"""Stripe payment gateway integration."""

import urllib.parse
import urllib.request
import json
import logging
from decimal import Decimal
from typing import Optional, Tuple
from app.core.payment_gateway import PaymentGateway

logger = logging.getLogger(__name__)


class StripeGateway(PaymentGateway):
    def __init__(self, secret_key: Optional[str] = None):
        self.secret_key = secret_key

    def create_order(self, amount: Decimal, currency: str, meta: dict) -> dict:
        """Create a Stripe PaymentIntent using direct API request (no external package dependency needed)."""
        if not self.secret_key:
            raise ValueError("Stripe secret key is not configured in Platform Settings.")

        # Convert amount to cents (e.g. 59.00 USD -> 5900 cents)
        amount_cents = int(round(amount * 100))
        curr = currency.lower()

        data = {
            "amount": str(amount_cents),
            "currency": curr,
            "payment_method_types[]": "card",
            "metadata[payment_id]": str(meta.get("payment_id", "")),
            "metadata[plan_id]": str(meta.get("plan_id", "")),
            "metadata[user_id]": str(meta.get("user_id", "")),
            "description": f"Visa House LMS - {meta.get('plan_name', 'Plan Subscription')}",
        }

        encoded_data = urllib.parse.urlencode(data).encode("utf-8")
        req = urllib.request.Request("https://api.stripe.com/v1/payment_intents", data=encoded_data)
        req.add_header("Authorization", f"Bearer {self.secret_key}")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")

        try:
            with urllib.request.urlopen(req) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                return {
                    "gateway": "stripe",
                    "id": res.get("id"),  # pi_...
                    "client_secret": res.get("client_secret"),
                    "amount": amount_cents,
                    "currency": curr,
                    "status": res.get("status"),
                }
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            logger.error(f"Stripe API error: {err_body}")
            try:
                err_json = json.loads(err_body)
                msg = err_json.get("error", {}).get("message", "Stripe API error")
            except Exception:
                msg = err_body
            raise RuntimeError(f"Stripe Payment Error: {msg}")

    def verify_payment(self, reference: Optional[str]) -> bool:
        """Fetch PaymentIntent status from Stripe API."""
        if not reference or not self.secret_key:
            return False

        req = urllib.request.Request(f"https://api.stripe.com/v1/payment_intents/{reference}")
        req.add_header("Authorization", f"Bearer {self.secret_key}")

        try:
            with urllib.request.urlopen(req) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                return res.get("status") in ("succeeded", "processing")
        except Exception as e:
            logger.error(f"Failed to verify Stripe payment intent {reference}: {e}")
            return False
