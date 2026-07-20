from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.institute import Institute
from app.models.payment import Payment

# revenue counts cash actually collected, including the received portion of a
# partial payment - not just fully-settled invoices
REVENUE_STATUSES = ("paid", "partial")
DUE_STATUSES = ("pending", "partial")


def summary(
    db: Session,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    institute_id: Optional[int] = None,
) -> dict:
    def _apply_common(query):
        if date_from is not None:
            query = query.filter(Payment.created_at >= date_from)
        if date_to is not None:
            query = query.filter(Payment.created_at <= date_to)
        if institute_id is not None:
            query = query.filter(Payment.institute_id == institute_id)
        return query

    revenue_rows = _apply_common(db.query(Payment).filter(Payment.status.in_(REVENUE_STATUSES))).all()
    total = sum((p.amount_paid for p in revenue_rows), Decimal("0"))
    b2b_total = sum((p.amount_paid for p in revenue_rows if p.source == "b2b"), Decimal("0"))
    b2c_total = sum((p.amount_paid for p in revenue_rows if p.source == "b2c"), Decimal("0"))

    due_rows = _apply_common(db.query(Payment).filter(Payment.status.in_(DUE_STATUSES))).all()
    total_due = sum((p.final_amount - p.amount_paid for p in due_rows), Decimal("0"))

    by_institute_query = _apply_common(
        db.query(Institute.id, Institute.name, func.sum(Payment.amount_paid), func.count(Payment.id))
        .join(Payment, Payment.institute_id == Institute.id)
        .filter(Payment.status.in_(REVENUE_STATUSES))
    )
    by_institute = [
        {"institute_id": iid, "institute_name": name, "total": str(total_amt), "count": count}
        for iid, name, total_amt, count in by_institute_query.group_by(Institute.id, Institute.name).all()
    ]

    by_month_query = _apply_common(
        db.query(func.date_format(Payment.created_at, "%Y-%m"), func.sum(Payment.amount_paid), func.count(Payment.id))
        .filter(Payment.status.in_(REVENUE_STATUSES))
    )
    by_month = [
        {"month": month, "total": str(total_amt), "count": count}
        for month, total_amt, count in by_month_query.group_by(
            func.date_format(Payment.created_at, "%Y-%m")
        ).order_by(func.date_format(Payment.created_at, "%Y-%m")).all()
    ]

    dues_query = _apply_common(
        db.query(Payment).options(joinedload(Payment.institute)).filter(Payment.status.in_(DUE_STATUSES))
    ).order_by(Payment.created_at.desc())
    dues = [
        {
            "id": p.id,
            "institute_name": p.institute.name if p.institute else None,
            "invoice_number": p.invoice_number,
            "final_amount": str(p.final_amount),
            "amount_paid": str(p.amount_paid),
            "due_amount": str(p.final_amount - p.amount_paid),
            "created_at": p.created_at,
        }
        for p in dues_query.all()
    ]

    return {
        "total_revenue": str(total),
        "b2b_revenue": str(b2b_total),
        "b2c_revenue": str(b2c_total),
        "total_due": str(total_due),
        "transaction_count": len(revenue_rows),
        "by_institute": by_institute,
        "by_month": by_month,
        "dues": dues,
    }
