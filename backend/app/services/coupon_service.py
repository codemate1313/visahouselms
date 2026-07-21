from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.coupon import Coupon
from app.models.payment import Payment
from app.models.user import User


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _audit(db: Session, actor: User, action: str, coupon_id: Optional[int], ip: Optional[str], details=None) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            action=action,
            entity_type="coupon",
            entity_id=coupon_id,
            details=details,
            ip_address=ip,
        )
    )


def _serialize(coupon: Coupon) -> dict:
    return {
        "id": coupon.id,
        "code": coupon.code,
        "discount_type": coupon.discount_type,
        "value": str(coupon.value),
        "scope": coupon.scope,
        "scope_plan_id": coupon.scope_plan_id,
        "usage_limit": coupon.usage_limit,
        "usage_count": coupon.usage_count,
        "valid_from": coupon.valid_from,
        "valid_until": coupon.valid_until,
        "is_active": coupon.is_active,
        "created_at": coupon.created_at,
    }


def list_coupons(
    db: Session,
    search: Optional[str] = None,
    scope: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> List[dict]:
    query = db.query(Coupon)
    if search:
        query = query.filter(Coupon.code.like(f"%{search.upper()}%"))
    if scope:
        query = query.filter(Coupon.scope == scope)
    if is_active is not None:
        query = query.filter(Coupon.is_active.is_(is_active))
    return [_serialize(c) for c in query.order_by(Coupon.created_at.desc()).all()]


def get_coupon_or_404(db: Session, coupon_id: int) -> Coupon:
    coupon = db.get(Coupon, coupon_id)
    if coupon is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coupon not found")
    return coupon


def get_coupon(db: Session, coupon_id: int) -> dict:
    return _serialize(get_coupon_or_404(db, coupon_id))


def create_coupon(db: Session, actor: User, data: dict, ip: Optional[str]) -> dict:
    if db.query(Coupon).filter(Coupon.code == data["code"]).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A coupon with this code already exists")
    if data["discount_type"] not in ("percent", "flat"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="discount_type must be 'percent' or 'flat'")
    if data.get("scope", "all") not in ("all", "plan"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="scope must be 'all' or 'plan'")
    if data.get("scope") == "plan" and data.get("scope_plan_id") is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Select a plan for this coupon")

    coupon_scope = data.get("scope", "all")
    coupon = Coupon(
        code=data["code"].upper(),
        discount_type=data["discount_type"],
        value=Decimal(str(data["value"])),
        scope=coupon_scope,
        scope_plan_id=data.get("scope_plan_id") if coupon_scope == "plan" else None,
        usage_limit=data.get("usage_limit"),
        valid_from=data.get("valid_from"),
        valid_until=data.get("valid_until"),
        is_active=True,
    )
    db.add(coupon)
    db.flush()
    _audit(db, actor, "coupon.create", coupon.id, ip, {"code": coupon.code})
    db.commit()
    db.refresh(coupon)
    return _serialize(coupon)


def update_coupon(db: Session, actor: User, coupon_id: int, data: dict, ip: Optional[str]) -> dict:
    coupon = get_coupon_or_404(db, coupon_id)
    resulting_scope = data.get("scope") or coupon.scope
    resulting_plan_id = data.get("scope_plan_id", coupon.scope_plan_id)
    if resulting_scope == "plan" and resulting_plan_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Select a plan for this coupon")
    for field in ("usage_limit", "valid_from", "valid_until", "scope_plan_id"):
        if field in data:
            setattr(coupon, field, data[field])
    if data.get("value") is not None:
        coupon.value = Decimal(str(data["value"]))
    if data.get("scope") is not None:
        coupon.scope = data["scope"]
    if coupon.scope != "plan":
        coupon.scope_plan_id = None

    db.add(coupon)
    _audit(db, actor, "coupon.update", coupon.id, ip)
    db.commit()
    db.refresh(coupon)
    return _serialize(coupon)


def set_coupon_active(db: Session, actor: User, coupon_id: int, active: bool, ip: Optional[str]) -> dict:
    coupon = get_coupon_or_404(db, coupon_id)
    coupon.is_active = active
    db.add(coupon)
    _audit(db, actor, "coupon.activate" if active else "coupon.deactivate", coupon.id, ip)
    db.commit()
    db.refresh(coupon)
    return _serialize(coupon)


def delete_coupon(db: Session, actor: User, coupon_id: int, ip: Optional[str]) -> None:
    coupon = get_coupon_or_404(db, coupon_id)
    if db.query(Payment).filter(Payment.coupon_id == coupon.id).count() > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This coupon has been used on a payment and cannot be deleted - deactivate it instead",
        )
    _audit(db, actor, "coupon.delete", coupon.id, ip, {"code": coupon.code})
    db.delete(coupon)
    db.commit()


def validate_and_price(
    db: Session, code: Optional[str], base_amount: Decimal, scope: str, scope_id: Optional[int]
) -> Tuple[Decimal, Optional[Coupon]]:
    """Returns (discount_amount, coupon_or_none). Raises 400 on any invalid
    coupon rather than silently ignoring it, so a typo'd code never silently
    charges full price."""
    if not code:
        return Decimal("0"), None

    coupon = db.query(Coupon).filter(Coupon.code == code.upper()).first()
    if coupon is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Coupon code not found")
    if not coupon.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Coupon is not active")

    now = _now()
    if coupon.valid_from and now < coupon.valid_from:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Coupon is not valid yet")
    if coupon.valid_until and now > coupon.valid_until:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Coupon has expired")
    if coupon.usage_limit is not None and coupon.usage_count >= coupon.usage_limit:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Coupon usage limit reached")

    if coupon.scope == "plan" and (scope != "plan" or coupon.scope_plan_id != scope_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Coupon does not apply to this plan")

    if coupon.discount_type == "percent":
        discount = (base_amount * coupon.value / Decimal("100")).quantize(Decimal("0.01"))
    else:
        discount = coupon.value
    discount = min(discount, base_amount)
    return discount, coupon


def redeem(db: Session, coupon: Coupon) -> None:
    """Increments usage_count - call only once a payment is actually marked
    paid, never on a failed/pending attempt, or a bad gateway retry could
    burn a customer's coupon use for nothing."""
    coupon.usage_count += 1
    db.add(coupon)
