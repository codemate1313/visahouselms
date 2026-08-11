from __future__ import annotations

import hashlib
import hmac
import logging

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

import requests
from fastapi import HTTPException, status
from sqlalchemy import func, or_, and_
from sqlalchemy.orm import Session, joinedload

from app.models.user import User
from app.models.voucher import VoucherType, VoucherOffering, VoucherCode, VoucherPurchase
from app.services import smtp_service

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def format_voucher_code(code: str) -> str:
    """Formats a 16-digit code into XXXX-XXXX-XXXX-XXXX for readable presentation."""
    clean = code.replace("-", "").strip().upper()
    if len(clean) == 16:
        return f"{clean[0:4]}-{clean[4:8]}-{clean[8:12]}-{clean[12:16]}"
    return code


# ==========================================
# VOUCHER TYPES (VOUCHER MASTER)
# ==========================================

def seed_sample_voucher_data(db: Session):
    """Seed initial realistic sample Voucher Types, Offerings, and 16-digit Alphanumeric Codes."""
    if db.query(VoucherType).count() > 0:
        return

    sample_types = [
        {"name": "Language CERT Academic Exam", "code": "language-cert-academic", "description": "Official Language CERT Academic exam voucher", "color": "#0284c7"},
        {"name": "PTE Academic Exam", "code": "pte-academic", "description": "Pearson Test of English Academic computer-based test voucher", "color": "#7c3aed"},
        {"name": "TOEFL iBT Exam", "code": "toefl-ibt", "description": "ETS Official TOEFL iBT internet-based test registration voucher", "color": "#059669"},
        {"name": "GRE General Test", "code": "gre-general", "description": "Graduate Record Examination general test registration voucher code", "color": "#ea580c"},
    ]

    created_types = {}
    for st in sample_types:
        vt = VoucherType(
            name=st["name"],
            code=st["code"],
            description=st["description"],
            badge_color=st["color"],
            is_active=True,
        )
        db.add(vt)
        db.flush()
        created_types[st["code"]] = vt

    # Add Offerings
    offerings_data = [
        {"type_code": "language-cert-academic", "title": "Language CERT Academic Standard Exam Voucher", "price": Decimal("15500.00"), "discount_price": Decimal("14200.00"), "validity": 180, "desc": "Includes official practice test + instant 16-digit redemption code."},
        {"type_code": "pte-academic", "title": "PTE Academic Saver Pass", "price": Decimal("17000.00"), "discount_price": Decimal("15900.00"), "validity": 180, "desc": "Official Pearson PTE voucher code valid for all test centers across India."},
        {"type_code": "toefl-ibt", "title": "TOEFL iBT Standard Registration", "price": Decimal("16900.00"), "discount_price": Decimal("14999.00"), "validity": 365, "desc": "ETS official 1-year registration code with free scoring support."},
        {"type_code": "gre-general", "title": "GRE General Test Registration Voucher", "price": Decimal("22500.00"), "discount_price": Decimal("20500.00"), "validity": 180, "desc": "ETS official GRE General Test registration voucher valid for all centers."},
    ]

    for od in offerings_data:
        vt = created_types.get(od["type_code"])
        if vt:
            offering = VoucherOffering(
                voucher_type_id=vt.id,
                title=od["title"],
                description=od["desc"],
                price=od["price"],
                discount_price=od["discount_price"],
                validity_days=od["validity"],
                is_active=True,
            )
            db.add(offering)

    # Add 16-digit Alphanumeric Sample Voucher Codes
    import random, string
    def gen_code():
        return "".join(random.choices(string.ascii_uppercase + string.digits, k=16))

    for vt in created_types.values():
        for _ in range(5):
            vc = VoucherCode(
                voucher_type_id=vt.id,
                code=gen_code(),
                status="available",
                source_filename="sample_seed.csv",
            )
            db.add(vc)

    db.commit()


def list_voucher_types(db: Session, include_inactive: bool = True) -> List[dict]:
    if db.query(VoucherType).count() == 0:
        seed_sample_voucher_data(db)

    query = db.query(VoucherType)
    if not include_inactive:
        query = query.filter(VoucherType.is_active.is_(True))
    types = query.order_by(VoucherType.name.asc()).all()

    result = []
    for vt in types:
        stock_summary = get_stock_summary_for_type(db, vt.id)
        result.append({
            "id": vt.id,
            "name": vt.name,
            "code": vt.code,
            "description": vt.description,
            "badge_color": vt.badge_color,
            "is_active": vt.is_active,
            "created_at": vt.created_at,
            "stock": stock_summary,
        })
    return result


def create_voucher_type(db: Session, name: str, code: str, description: Optional[str] = None, badge_color: str = "#0284c7") -> VoucherType:
    existing = db.query(VoucherType).filter(VoucherType.code == code.lower().strip()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Voucher type code '{code}' already exists")

    vt = VoucherType(
        name=name.strip(),
        code=code.lower().strip(),
        description=description.strip() if description else None,
        badge_color=badge_color,
        is_active=True,
    )
    db.add(vt)
    db.commit()
    db.refresh(vt)
    return vt


def update_voucher_type(db: Session, type_id: int, name: str, description: Optional[str] = None, badge_color: str = "#0284c7", is_active: bool = True) -> VoucherType:
    vt = db.query(VoucherType).filter(VoucherType.id == type_id).first()
    if not vt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voucher type not found")

    vt.name = name.strip()
    vt.description = description.strip() if description else None
    vt.badge_color = badge_color
    vt.is_active = is_active

    db.commit()
    db.refresh(vt)
    return vt


# ==========================================
# VOUCHER OFFERINGS (PACKAGES & PRICING)
# ==========================================

def list_voucher_offerings(db: Session, include_inactive: bool = False) -> List[dict]:
    if db.query(VoucherOffering).count() == 0:
        seed_sample_voucher_data(db)

    query = db.query(VoucherOffering).options(
        joinedload(VoucherOffering.voucher_type),
        joinedload(VoucherOffering.gst_rate),
    )
    if not include_inactive:
        query = query.filter(VoucherOffering.is_active.is_(True))
    offerings = query.order_by(VoucherOffering.created_at.desc()).all()

    result = []
    for vo in offerings:
        stock = get_stock_summary_for_type(db, vo.voucher_type_id)
        result.append({
            "id": vo.id,
            "voucher_type_id": vo.voucher_type_id,
            "voucher_type_name": vo.voucher_type.name if vo.voucher_type else "",
            "voucher_type_code": vo.voucher_type.code if vo.voucher_type else "",
            "voucher_type_badge_color": vo.voucher_type.badge_color if vo.voucher_type else "#0284c7",
            "title": vo.title,
            "description": vo.description,
            "price": str(vo.price),
            "discount_price": str(vo.discount_price) if vo.discount_price is not None else None,
            "validity_days": vo.validity_days,
            "gst_rate_id": vo.gst_rate_id,
            "gst_percentage": str(vo.gst_rate.percentage) if vo.gst_rate else "0.00",
            "is_active": vo.is_active,
            "created_at": vo.created_at,
            "image_url": vo.image_url,
            "available_stock": stock["available"],
        })
    return result


def create_voucher_offering(db: Session, voucher_type_id: int, title: str, price: Decimal, validity_days: int, description: Optional[str] = None, discount_price: Optional[Decimal] = None, gst_rate_id: Optional[int] = None, image_url: Optional[str] = None) -> VoucherOffering:
    vt = db.query(VoucherType).filter(VoucherType.id == voucher_type_id).first()
    if not vt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voucher type not found")

    vo = VoucherOffering(
        voucher_type_id=voucher_type_id,
        title=title.strip(),
        description=description.strip() if description else None,
        price=price,
        discount_price=discount_price,
        validity_days=validity_days,
        gst_rate_id=gst_rate_id,
        image_url=image_url,
        is_active=True,
    )
    db.add(vo)
    db.commit()
    db.refresh(vo)
    return vo


def update_voucher_offering(db: Session, offering_id: int, title: str, price: Decimal, validity_days: int, description: Optional[str] = None, discount_price: Optional[Decimal] = None, gst_rate_id: Optional[int] = None, image_url: Optional[str] = None, is_active: bool = True) -> VoucherOffering:
    vo = db.query(VoucherOffering).filter(VoucherOffering.id == offering_id).first()
    if not vo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voucher offering not found")

    vo.title = title.strip()
    vo.description = description.strip() if description else None
    vo.price = price
    vo.discount_price = discount_price
    vo.validity_days = validity_days
    vo.gst_rate_id = gst_rate_id
    if image_url is not None:
        vo.image_url = image_url
    vo.is_active = is_active

    db.commit()
    db.refresh(vo)
    return vo


# ==========================================
# STOCK & BULK UPLOAD MANAGEMENT
# ==========================================

def get_stock_summary_for_type(db: Session, voucher_type_id: int) -> dict:
    base = db.query(func.count(VoucherCode.id)).filter(VoucherCode.voucher_type_id == voucher_type_id)
    available = base.filter(VoucherCode.status == "available").scalar() or 0
    purchased = base.filter(VoucherCode.status == "purchased").scalar() or 0
    disabled = base.filter(VoucherCode.status == "disabled").scalar() or 0
    # Reserved = held for an in-flight checkout, not yet paid. Counted separately
    # so the bucket adds up and a held code is not mistaken for sellable stock.
    reserved = base.filter(VoucherCode.status == "reserved").scalar() or 0
    total = available + purchased + disabled + reserved
    return {
        "total": total,
        "available": available,
        "purchased": purchased,
        "disabled": disabled,
        "reserved": reserved,
    }


def add_bulk_voucher_codes(db: Session, voucher_type_id: int, codes: List[str], added_by_user_id: Optional[int] = None, filename: Optional[str] = None) -> dict:
    vt = db.query(VoucherType).filter(VoucherType.id == voucher_type_id).first()
    if not vt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voucher type not found")

    import re
    cleaned_codes = [c.replace("-", "").strip().upper() for c in codes if c]
    # Keep only codes that are exactly 16 characters and contain only letters/numbers
    valid_codes = [c for c in cleaned_codes if len(c) == 16 and re.match(r"^[A-Z0-9]+$", c)]

    if not valid_codes:
        return {"total_extracted": len(codes), "inserted": 0, "duplicates_skipped": 0, "message": "No valid 16-digit alphanumeric codes found"}

    # Find existing codes in DB
    existing_rows = db.query(VoucherCode.code).filter(VoucherCode.code.in_(valid_codes)).all()
    existing_set = {r[0] for r in existing_rows}

    new_codes_to_insert = [c for c in set(valid_codes) if c not in existing_set]

    now_dt = _now()
    objects = [
        VoucherCode(
            voucher_type_id=voucher_type_id,
            code=c,
            status="available",
            added_by_id=added_by_user_id,
            source_filename=filename,
            created_at=now_dt,
        )
        for c in new_codes_to_insert
    ]

    if objects:
        db.bulk_save_objects(objects)
        db.commit()

    return {
        "total_extracted": len(valid_codes),
        "inserted": len(objects),
        "duplicates_skipped": len(valid_codes) - len(objects),
        "message": f"Successfully added {len(objects)} new 16-character voucher codes to {vt.name}",
    }


def list_unused_codes(db: Session, voucher_type_id: Optional[int] = None) -> List[dict]:
    query = (
        db.query(VoucherCode)
        .options(joinedload(VoucherCode.voucher_type))
        .filter(VoucherCode.status.in_(("available", "disabled")))
    )
    if voucher_type_id:
        query = query.filter(VoucherCode.voucher_type_id == voucher_type_id)
    
    codes = query.order_by(VoucherCode.status.asc(), VoucherCode.created_at.desc()).all()
    result = []
    for c in codes:
        result.append({
            "id": c.id,
            "code": c.code,
            "status": c.status,
            "voucher_type_name": c.voucher_type.name if c.voucher_type else "",
            "voucher_type_badge_color": c.voucher_type.badge_color if c.voucher_type else "#0284c7",
            "validity_days": 180,
            "source_filename": c.source_filename or "Manual",
            "created_at": c.created_at,
        })
    return result

# ==========================================
# PURCHASES & INVOICING
# ==========================================

def _generate_purchase_number(db: Session) -> str:
    count = db.query(func.count(VoucherPurchase.id)).scalar() or 0
    now_year = datetime.now().year
    return f"VCH-{now_year}-{(count + 1):05d}"


# A reserved code is held for a pending purchase for this long; after it, the
# reservation is released so an abandoned checkout does not lock a code away
# forever.
_RESERVATION_MINUTES = 30


def _razorpay_credentials(db: Session) -> Tuple[Optional[str], Optional[str]]:
    """(key_id, key_secret) if Razorpay is enabled and configured, else (None, None)."""
    from app.services.settings_service import get_settings_group

    gw = get_settings_group(db, "payment_gateways", mask_secrets=False)
    if gw.get("razorpay_enabled") != "true":
        return None, None
    return gw.get("razorpay_key_id"), gw.get("razorpay_key_secret")


def _release_stale_reservations(db: Session, voucher_type_id: int) -> None:
    """Return codes reserved by pending purchases that were never paid to the
    available pool, and fail those purchases. Runs before a new reservation so a
    burst of abandoned checkouts cannot exhaust the stock."""
    cutoff = _now() - timedelta(minutes=_RESERVATION_MINUTES)
    stale = (
        db.query(VoucherCode)
        .join(VoucherPurchase, VoucherCode.purchase_id == VoucherPurchase.id)
        .filter(
            VoucherCode.voucher_type_id == voucher_type_id,
            VoucherCode.status == "reserved",
            VoucherPurchase.status == "pending",
            VoucherPurchase.created_at < cutoff,
        )
        .all()
    )
    for code in stale:
        purchase = db.get(VoucherPurchase, code.purchase_id) if code.purchase_id else None
        code.status = "available"
        code.purchase_id = None
        if purchase is not None:
            purchase.status = "failed"
            purchase.voucher_code_id = None
    if stale:
        db.commit()


def create_voucher_order(
    db: Session,
    offering_id: int,
    buyer_name: str,
    buyer_email: str,
    buyer_phone: Optional[str] = None,
    student_user_id: Optional[int] = None,
) -> dict:
    """Step 1 of a purchase: reserve a code and open a payment order.

    A code is taken out of the available pool and marked `reserved` *before* the
    buyer pays, so the platform never takes money for a voucher it cannot
    deliver. The code is not handed over here - that happens only after the
    payment is verified. If the gateway is not configured, nothing is reserved
    and no sale is possible: a voucher is never given away without payment.
    """
    offering = (
        db.query(VoucherOffering)
        .options(joinedload(VoucherOffering.voucher_type), joinedload(VoucherOffering.gst_rate))
        .filter(VoucherOffering.id == offering_id)
        .first()
    )
    if not offering or not offering.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voucher offering is not available")

    _release_stale_reservations(db, offering.voucher_type_id)

    key_id, key_secret = _razorpay_credentials(db)
    if not key_id or not key_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Online payment is not available right now. Please try again later.",
        )

    # Reserve the next available code. On Postgres this takes a row lock and
    # skips already-locked rows so two buyers never grab the same code; on
    # SQLite writes serialize, so the status flip is atomic either way.
    code_query = db.query(VoucherCode).filter(
        VoucherCode.voucher_type_id == offering.voucher_type_id,
        VoucherCode.status == "available",
    ).order_by(VoucherCode.id.asc())
    if db.bind is not None and db.bind.dialect.name != "sqlite":
        code_query = code_query.with_for_update(skip_locked=True)
    code_row = code_query.first()
    if not code_row:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Currently out of stock for {offering.voucher_type.name} vouchers. Please try again later.",
        )

    price = offering.discount_price if offering.discount_price is not None else offering.price
    gst_percentage = offering.gst_rate.percentage if offering.gst_rate else Decimal("0.00")
    gst_amount = round(price * (gst_percentage / Decimal("100")), 2)
    final_amount = price + gst_amount

    purchase = VoucherPurchase(
        purchase_number=_generate_purchase_number(db),
        voucher_offering_id=offering.id,
        voucher_code_id=code_row.id,
        student_id=student_user_id,
        buyer_name=buyer_name.strip(),
        buyer_email=buyer_email.strip().lower(),
        buyer_phone=buyer_phone.strip() if buyer_phone else None,
        amount=price,
        discount_amount=Decimal("0.00"),
        gst_percentage=gst_percentage,
        gst_amount=gst_amount,
        final_amount=final_amount,
        currency="INR",
        gateway="razorpay",
        status="pending",
        valid_until=_now() + timedelta(days=offering.validity_days),
    )
    db.add(purchase)
    db.flush()

    code_row.status = "reserved"
    code_row.purchase_id = purchase.id
    db.add(code_row)
    db.commit()

    amount_paise = int(final_amount * 100)
    try:
        res = requests.post(
            "https://api.razorpay.com/v1/orders",
            auth=(key_id, key_secret),
            json={
                "amount": amount_paise,
                "currency": "INR",
                "receipt": f"vch_{purchase.id}",
                "notes": {"voucher_purchase_id": str(purchase.id), "offering_id": str(offering.id)},
            },
            timeout=10,
        )
        if res.status_code != 200:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not start the payment. Please try again.")
        order = res.json()
    except requests.RequestException:
        # Could not reach the gateway: release the reservation so the code is not
        # stuck, and fail the purchase.
        code_row.status = "available"
        code_row.purchase_id = None
        purchase.status = "failed"
        purchase.voucher_code_id = None
        db.commit()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Payment service is unreachable. Please try again.")

    purchase.gateway_transaction_id = order["id"]
    db.add(purchase)
    db.commit()

    return {
        "online_payment": True,
        "gateway": "razorpay",
        "purchase_id": purchase.id,
        "order_id": order["id"],
        "key_id": key_id,
        "amount": amount_paise,
        "currency": "INR",
        "offering_title": offering.title,
        "voucher_type": offering.voucher_type.name,
        "buyer_name": purchase.buyer_name,
        "buyer_email": purchase.buyer_email,
    }


def _complete_purchase(db: Session, purchase: VoucherPurchase) -> dict:
    """Hand the reserved code over once payment is verified: flip it to sold,
    stamp the purchase, and email the buyer. Idempotent - a second call on an
    already-completed purchase just returns it."""
    code_row = db.get(VoucherCode, purchase.voucher_code_id) if purchase.voucher_code_id else None
    if code_row is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The reserved code is no longer available. Support has been notified.")

    offering = (
        db.query(VoucherOffering)
        .options(joinedload(VoucherOffering.voucher_type))
        .filter(VoucherOffering.id == purchase.voucher_offering_id)
        .first()
    )

    # Only flip the code and email on the first completion. A repeat call (a
    # double-verify, or re-serializing an already-completed purchase) returns the
    # same data without sending a second code email or re-stamping the code.
    already_done = purchase.status == "completed" and code_row.status == "purchased"
    if not already_done:
        code_row.status = "purchased"
        code_row.purchased_at = _now()
        purchase.status = "completed"
        db.add_all([code_row, purchase])
        db.commit()
        db.refresh(purchase)

    formatted_code = format_voucher_code(code_row.code)
    if not already_done:
        try:
            smtp_service.send_voucher_purchase_email(
                db=db,
                to_email=purchase.buyer_email,
                buyer_name=purchase.buyer_name,
                voucher_name=offering.voucher_type.name if offering else "Exam voucher",
                code_16_digit=formatted_code,
                valid_until_str=purchase.valid_until.strftime("%d %b %Y") if purchase.valid_until else "",
                amount_str=f"₹{purchase.final_amount:,.2f}",
                purchase_number=purchase.purchase_number,
            )
        except Exception:
            logger.exception("Failed to send voucher purchase email for purchase %s", purchase.purchase_number)

    return {
        "purchase_id": purchase.id,
        "purchase_number": purchase.purchase_number,
        "buyer_name": purchase.buyer_name,
        "buyer_email": purchase.buyer_email,
        "voucher_type": offering.voucher_type.name if offering else None,
        "offering_title": offering.title if offering else None,
        "voucher_code": formatted_code,
        "raw_code": code_row.code,
        "valid_until": purchase.valid_until,
        "final_amount": str(purchase.final_amount),
        "status": purchase.status,
    }


def verify_voucher_payment(
    db: Session,
    purchase_id: int,
    razorpay_payment_id: str,
    razorpay_order_id: str,
    razorpay_signature: str,
) -> dict:
    """Step 2: verify the gateway's signed receipt, then release the code.

    The signature is checked against the stored secret - a forged or replayed
    callback cannot unlock a code. Only on a valid signature is the code handed
    over; an invalid one fails the purchase and returns the reserved code to the
    pool so it can be sold to someone else.
    """
    purchase = db.get(VoucherPurchase, purchase_id)
    if purchase is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase not found")
    if purchase.status == "completed":
        return _complete_purchase(db, purchase)  # idempotent no-op re-serialize
    if purchase.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This purchase can no longer be completed.")

    from app.services.settings_service import get_settings_group

    key_secret = get_settings_group(db, "payment_gateways", mask_secrets=False).get("razorpay_key_secret")
    if not key_secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Razorpay is not configured")

    expected = hmac.new(
        key_secret.encode("utf-8"),
        f"{razorpay_order_id}|{razorpay_payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, razorpay_signature or ""):
        # Reject and release the reserved code.
        code_row = db.get(VoucherCode, purchase.voucher_code_id) if purchase.voucher_code_id else None
        if code_row is not None and code_row.status == "reserved":
            code_row.status = "available"
            code_row.purchase_id = None
        purchase.status = "failed"
        purchase.voucher_code_id = None
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment could not be verified.")

    purchase.gateway_transaction_id = f"Order: {razorpay_order_id} | Payment: {razorpay_payment_id}"
    db.add(purchase)
    return _complete_purchase(db, purchase)


def get_student_purchased_vouchers(db: Session, student_id: int, student_email: Optional[str] = None) -> List[dict]:
    filters = [VoucherPurchase.student_id == student_id]
    if student_email:
        filters.append(VoucherPurchase.buyer_email == student_email.lower().strip())

    purchases = db.query(VoucherPurchase).options(
        joinedload(VoucherPurchase.offering).joinedload(VoucherOffering.voucher_type),
        joinedload(VoucherPurchase.voucher_code),
    ).filter(or_(*filters)).order_by(VoucherPurchase.created_at.desc()).all()

    now_dt = _now()
    result = []
    for p in purchases:
        raw_code = p.voucher_code.code if p.voucher_code else ""
        fmt_code = format_voucher_code(raw_code)
        is_expired = p.valid_until is not None and p.valid_until < now_dt
        result.append({
            "id": p.id,
            "purchase_number": p.purchase_number,
            "offering_title": p.offering.title if p.offering else "",
            "voucher_type_name": p.offering.voucher_type.name if p.offering and p.offering.voucher_type else "",
            "voucher_type_badge_color": p.offering.voucher_type.badge_color if p.offering and p.offering.voucher_type else "#0284c7",
            "voucher_code": fmt_code,
            "raw_code": raw_code,
            "buyer_name": p.buyer_name,
            "buyer_email": p.buyer_email,
            "final_amount": str(p.final_amount),
            "created_at": p.created_at,
            "valid_until": p.valid_until,
            "is_expired": is_expired,
            "gateway": p.gateway,
            "status": p.status,
        })
    return result


def list_admin_purchases(db: Session, search: Optional[str] = None) -> List[dict]:
    query = db.query(VoucherPurchase).options(
        joinedload(VoucherPurchase.offering).joinedload(VoucherOffering.voucher_type),
        joinedload(VoucherPurchase.voucher_code),
    )

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                VoucherPurchase.purchase_number.ilike(term),
                VoucherPurchase.buyer_name.ilike(term),
                VoucherPurchase.buyer_email.ilike(term),
                VoucherPurchase.buyer_phone.ilike(term),
                VoucherPurchase.gateway_transaction_id.ilike(term),
            )
        )

    purchases = query.order_by(VoucherPurchase.created_at.desc()).all()

    result = []
    for p in purchases:
        raw_code = p.voucher_code.code if p.voucher_code else ""
        fmt_code = format_voucher_code(raw_code)
        result.append({
            "id": p.id,
            "purchase_number": p.purchase_number,
            "buyer_name": p.buyer_name,
            "buyer_email": p.buyer_email,
            "buyer_phone": p.buyer_phone,
            "offering_title": p.offering.title if p.offering else "",
            "voucher_type_name": p.offering.voucher_type.name if p.offering and p.offering.voucher_type else "",
            "voucher_code": fmt_code,
            "raw_code": raw_code,
            "amount": str(p.amount),
            "gst_amount": str(p.gst_amount),
            "final_amount": str(p.final_amount),
            "gateway": p.gateway,
            "gateway_transaction_id": p.gateway_transaction_id,
            "status": p.status,
            "created_at": p.created_at,
            "valid_until": p.valid_until,
        })
    return result


def delete_voucher_type(db: Session, type_id: int) -> dict:
    vt = db.query(VoucherType).filter(VoucherType.id == type_id).first()
    if not vt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voucher type not found")
    db.query(VoucherCode).filter(VoucherCode.voucher_type_id == type_id).delete(synchronize_session=False)
    db.query(VoucherOffering).filter(VoucherOffering.voucher_type_id == type_id).delete(synchronize_session=False)
    db.delete(vt)
    db.commit()
    return {"message": "Voucher type deleted successfully"}


def delete_voucher_offering(db: Session, offering_id: int) -> dict:
    vo = db.query(VoucherOffering).filter(VoucherOffering.id == offering_id).first()
    if not vo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voucher offering not found")
    db.delete(vo)
    db.commit()
    return {"message": "Voucher offering deleted successfully"}


def delete_voucher_code(db: Session, code_id: int) -> dict:
    vc = db.query(VoucherCode).filter(VoucherCode.id == code_id).first()
    if not vc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voucher code not found")
    db.delete(vc)
    db.commit()
    return {"message": "Voucher code deleted successfully"}


def disable_voucher_code(db: Session, code_id: int) -> dict:
    vc = db.query(VoucherCode).filter(VoucherCode.id == code_id).first()
    if not vc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voucher code not found")
    if vc.status != "available":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only unused available voucher codes can be disabled")

    vc.status = "disabled"
    db.add(vc)
    db.commit()
    return {"message": "Voucher code disabled successfully", "disabled": 1}


def toggle_voucher_code(db: Session, code_id: int) -> dict:
    vc = db.query(VoucherCode).filter(VoucherCode.id == code_id).first()
    if not vc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voucher code not found")
    if vc.status not in ("available", "disabled"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only unused voucher codes can be toggled")

    vc.status = "available" if vc.status == "disabled" else "disabled"
    db.add(vc)
    db.commit()
    return {"message": "Voucher code toggled successfully", "status": vc.status}


def update_voucher_code(db: Session, code_id: int, code: str, voucher_type_id: int) -> dict:
    vc = db.query(VoucherCode).filter(VoucherCode.id == code_id).first()
    if not vc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voucher code not found")
    if vc.status not in ("available", "disabled"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot edit a purchased or expired code")

    # check if new code exists
    existing = db.query(VoucherCode).filter(VoucherCode.code == code, VoucherCode.id != code_id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Voucher code already exists")

    vc.code = code
    vc.voucher_type_id = voucher_type_id
    db.add(vc)
    db.commit()
    return {"message": "Voucher code updated successfully"}


def disable_voucher_codes(db: Session, code_ids: List[int]) -> dict:
    unique_ids = sorted({int(code_id) for code_id in code_ids if int(code_id) > 0})
    if not unique_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No voucher codes selected")

    codes = db.query(VoucherCode).filter(VoucherCode.id.in_(unique_ids)).all()
    found_ids = {code.id for code in codes}
    missing = len(unique_ids) - len(found_ids)
    disabled = 0
    skipped = missing

    for code in codes:
        if code.status == "available":
            code.status = "disabled"
            db.add(code)
            disabled += 1
        else:
            skipped += 1

    db.commit()
    return {
        "message": f"Disabled {disabled} voucher code{'s' if disabled != 1 else ''}.",
        "disabled": disabled,
        "skipped": skipped,
    }
