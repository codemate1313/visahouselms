"""Payment gateway interface (roadmap 2.4). ManualGateway is the only
implementation today - the super admin is directly asserting a payment was
received (bank transfer, cash, etc.), so verification is trivially true.
A future RazorpayGateway/StripeGateway implements the same interface with a
real checkout order + webhook signature verification; nothing else in the
codebase changes when one is added."""

from abc import ABC, abstractmethod
from decimal import Decimal
from typing import Optional


class PaymentGateway(ABC):
    @abstractmethod
    def create_order(self, amount: Decimal, currency: str, meta: dict) -> dict:
        """Returns a gateway-specific order reference the client would use to
        complete checkout (for a real gateway) or a stub (for manual)."""
        raise NotImplementedError

    @abstractmethod
    def verify_payment(self, reference: Optional[str]) -> bool:
        """Returns True if the payment is confirmed received."""
        raise NotImplementedError


class ManualGateway(PaymentGateway):
    def create_order(self, amount: Decimal, currency: str, meta: dict) -> dict:
        return {"gateway": "manual", "order_reference": None}

    def verify_payment(self, reference: Optional[str]) -> bool:
        return True


def get_gateway(name: str = "manual") -> PaymentGateway:
    if name == "manual":
        return ManualGateway()
    raise ValueError(f"Unknown payment gateway '{name}'")
