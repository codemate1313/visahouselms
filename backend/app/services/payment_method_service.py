from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.payment import Payment
from app.models.payment_method import PaymentMethod
from app.models.user import User


def _audit(db: Session, actor: User, action: str, method_id: Optional[int], ip: Optional[str], details=None) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            action=action,
            entity_type="payment_method",
            entity_id=method_id,
            details=details,
            ip_address=ip,
        )
    )


def _serialize(method: PaymentMethod) -> dict:
    return {"id": method.id, "name": method.name, "is_active": method.is_active, "created_at": method.created_at}


def list_methods(db: Session, active_only: bool = False) -> List[dict]:
    query = db.query(PaymentMethod)
    if active_only:
        query = query.filter(PaymentMethod.is_active.is_(True))
    return [_serialize(m) for m in query.order_by(PaymentMethod.name).all()]


def get_method_or_404(db: Session, method_id: int) -> PaymentMethod:
    method = db.get(PaymentMethod, method_id)
    if method is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment method not found")
    return method


def create_method(db: Session, actor: User, name: str, ip: Optional[str]) -> dict:
    if db.query(PaymentMethod).filter(PaymentMethod.name == name).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A payment method with this name already exists")
    method = PaymentMethod(name=name, is_active=True)
    db.add(method)
    db.flush()
    _audit(db, actor, "payment_method.create", method.id, ip, {"name": name})
    db.commit()
    db.refresh(method)
    return _serialize(method)


def set_method_active(db: Session, actor: User, method_id: int, active: bool, ip: Optional[str]) -> dict:
    method = get_method_or_404(db, method_id)
    method.is_active = active
    db.add(method)
    _audit(db, actor, "payment_method.activate" if active else "payment_method.deactivate", method.id, ip)
    db.commit()
    db.refresh(method)
    return _serialize(method)


def delete_method(db: Session, actor: User, method_id: int, ip: Optional[str]) -> None:
    method = get_method_or_404(db, method_id)
    if db.query(Payment).filter(Payment.payment_method_id == method.id).count() > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This payment method has been used on a payment and cannot be deleted - deactivate it instead",
        )
    _audit(db, actor, "payment_method.delete", method.id, ip, {"name": method.name})
    db.delete(method)
    db.commit()
