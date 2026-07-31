from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.gst_rate import GstRate
from app.models.user import User


def list_gst_rates(db: Session, active_only: bool = False) -> List[dict]:
    query = db.query(GstRate)
    if active_only:
        query = query.filter(GstRate.is_active.is_(True))
    rates = query.order_by(GstRate.is_default.desc(), GstRate.percentage.desc()).all()
    return [_serialize_rate(r) for r in rates]


def get_gst_rate_or_404(db: Session, rate_id: int) -> GstRate:
    rate = db.query(GstRate).filter(GstRate.id == rate_id).first()
    if not rate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GST rate not found")
    return rate


def create_gst_rate(db: Session, actor: User, data: dict, ip: Optional[str] = None) -> dict:
    if data.get("is_default"):
        db.query(GstRate).update({"is_default": False})

    rate = GstRate(
        name=data["name"],
        percentage=data["percentage"],
        tax_type=data.get("tax_type", "exclusive"),
        is_active=data.get("is_active", True),
        is_default=data.get("is_default", False),
    )
    db.add(rate)
    db.commit()
    db.refresh(rate)
    return _serialize_rate(rate)


def update_gst_rate(db: Session, actor: User, rate_id: int, data: dict, ip: Optional[str] = None) -> dict:
    rate = get_gst_rate_or_404(db, rate_id)
    
    if data.get("is_default"):
        db.query(GstRate).filter(GstRate.id != rate_id).update({"is_default": False})

    for key, value in data.items():
        if value is not None:
            setattr(rate, key, value)

    db.add(rate)
    db.commit()
    db.refresh(rate)
    return _serialize_rate(rate)


def toggle_gst_rate_active(db: Session, actor: User, rate_id: int, ip: Optional[str] = None) -> dict:
    rate = get_gst_rate_or_404(db, rate_id)
    rate.is_active = not rate.is_active
    db.add(rate)
    db.commit()
    db.refresh(rate)
    return _serialize_rate(rate)


def delete_gst_rate(db: Session, actor: User, rate_id: int, ip: Optional[str] = None) -> None:
    rate = get_gst_rate_or_404(db, rate_id)
    db.delete(rate)
    db.commit()


def _serialize_rate(rate: GstRate) -> dict:
    return {
        "id": rate.id,
        "name": rate.name,
        "percentage": float(rate.percentage),
        "tax_type": rate.tax_type,
        "is_active": rate.is_active,
        "is_default": rate.is_default,
        "created_at": rate.created_at.isoformat() if rate.created_at else None,
    }
