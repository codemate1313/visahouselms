"""PayU (India) hosted checkout.

PayU is not an API-and-modal gateway like Razorpay or Stripe: there is no order
to create over HTTP. The server signs a set of form fields, the browser POSTs
them to PayU, and PayU sends the candidate back to a URL of ours with the
result and a hash of its own. Everything here is therefore pure - build a
signature, check a signature - and the only thing that can go wrong is the
exact layout of the string being hashed, which is why both layouts are written
out in full below and asserted in the tests.
"""

import hashlib
import hmac
from decimal import Decimal
from typing import Optional

TEST_ACTION_URL = "https://test.payu.in/_payment"
LIVE_ACTION_URL = "https://secure.payu.in/_payment"

# PayU accepts ten user-defined fields. Five are addressable in the documented
# hash layout and the remaining five are hashed as empty strings - they are
# written out rather than looped so the layout can be read against PayU's docs.
UDF_FIELDS = ("udf1", "udf2", "udf3", "udf4", "udf5")


def action_url(mode: str) -> str:
    return LIVE_ACTION_URL if (mode or "test").lower() == "live" else TEST_ACTION_URL


def format_amount(amount: Decimal) -> str:
    """PayU hashes the amount as the exact string that is posted.

    Two places, always: a hash built over "100.0" will not match one PayU
    builds over "100.00", and the failure looks like a rejected payment rather
    than a formatting mistake.
    """
    return f"{Decimal(amount):.2f}"


def _request_hash_string(fields: dict, salt: str) -> str:
    """key|txnid|amount|productinfo|firstname|email|udf1..udf5||||||salt"""
    ordered = [
        fields.get("key", ""),
        fields.get("txnid", ""),
        fields.get("amount", ""),
        fields.get("productinfo", ""),
        fields.get("firstname", ""),
        fields.get("email", ""),
        *(fields.get(name, "") for name in UDF_FIELDS),
    ]
    # udf6..udf10 are not used, and are hashed as five empty values.
    return "|".join(ordered) + "|||||" + "|" + salt


def _response_hash_string(fields: dict, salt: str) -> str:
    """The reverse of the request layout, which is how PayU signs its reply:

    salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key

    `additionalCharges`, when PayU applies any, is prepended to the whole
    thing - a detail that silently breaks verification for merchants who take
    convenience fees.
    """
    ordered = [
        salt,
        fields.get("status", ""),
        "", "", "", "", "",
        *(fields.get(name, "") for name in reversed(UDF_FIELDS)),
        fields.get("email", ""),
        fields.get("firstname", ""),
        fields.get("productinfo", ""),
        fields.get("amount", ""),
        fields.get("txnid", ""),
        fields.get("key", ""),
    ]
    base = "|".join(ordered)
    extra = (fields.get("additionalCharges") or "").strip()
    return f"{extra}|{base}" if extra else base


def _sha512(value: str) -> str:
    return hashlib.sha512(value.encode("utf-8")).hexdigest().lower()


def build_checkout(
    *,
    merchant_key: str,
    salt: str,
    mode: str,
    txnid: str,
    amount: Decimal,
    product_info: str,
    first_name: str,
    email: str,
    phone: str,
    success_url: str,
    failure_url: str,
    udf: Optional[dict] = None,
) -> dict:
    """The form the browser posts to PayU, signed and ready."""
    if not merchant_key or not salt:
        raise ValueError("PayU merchant key and salt are required")

    fields = {
        "key": merchant_key,
        "txnid": txnid,
        "amount": format_amount(amount),
        "productinfo": product_info,
        # PayU rejects an empty firstname, and hashes whatever is sent.
        "firstname": (first_name or "Student").strip(),
        "email": (email or "").strip(),
        "phone": (phone or "").strip(),
        "surl": success_url,
        "furl": failure_url,
        "service_provider": "payu_paisa",
    }
    for name in UDF_FIELDS:
        fields[name] = str((udf or {}).get(name, ""))

    fields["hash"] = _sha512(_request_hash_string(fields, salt))
    return {"action": action_url(mode), "fields": fields}


def verify_response(payload: dict, salt: str) -> bool:
    """Is this really PayU's answer, unaltered?

    The candidate's own browser carries the result back, so the hash is the
    only thing standing between a real payment and a forged one - a POST
    claiming `status=success` is trivial to write by hand.
    """
    provided = (payload.get("hash") or "").strip().lower()
    if not provided or not salt:
        return False
    expected = _sha512(_response_hash_string(payload, salt))
    return hmac.compare_digest(expected, provided)
