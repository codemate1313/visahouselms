from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.coupon import Coupon
from app.models.course import COURSE_PUBLISHED, Course
from app.models.institute import Institute
from app.models.payment import Payment
from app.models.role import SA_INSTRUCTOR, Role
from app.models.user import User
from app.services import demo_service, revenue_service, subscription_service, super_admin_service

SUBSCRIPTION_STATES = (
    subscription_service.STATE_ACTIVE,
    subscription_service.STATE_GRACE,
    subscription_service.STATE_EXPIRED,
    subscription_service.STATE_NONE,
)


def get_summary(db: Session) -> dict:
    institutes = db.query(Institute).all()
    institutes_total = len(institutes)
    institutes_active = sum(1 for i in institutes if i.is_active)

    subscription_breakdown = {state: 0 for state in SUBSCRIPTION_STATES}
    for institute in institutes:
        _, state = subscription_service.current_subscription(db, institute.id)
        subscription_breakdown[state] += 1

    demos = demo_service.list_demos(db)
    demo_active_count = sum(1 for d in demos if d["state"] == demo_service.STATE_ACTIVE)

    coupons_active = db.query(Coupon).filter(Coupon.is_active.is_(True)).count()
    super_admin_accounts = len(super_admin_service.list_super_admins(db))
    instructor_role = db.query(Role).filter(Role.name == SA_INSTRUCTOR).first()
    sa_instructor_accounts = (
        db.query(User).filter(User.role_id == instructor_role.id).count()
        if instructor_role
        else 0
    )

    revenue = revenue_service.summary(db)

    payment_status_rows = (
        db.query(Payment.status, func.count(Payment.id)).group_by(Payment.status).all()
    )
    payment_status_breakdown = [{"status": status, "count": count} for status, count in payment_status_rows]

    return {
        "counts": {
            "institutes_total": institutes_total,
            "institutes_active": institutes_active,
            "subscriptions_active": subscription_breakdown[subscription_service.STATE_ACTIVE],
            "demo_accounts_active": demo_active_count,
            "coupons_active": coupons_active,
            "super_admin_accounts": super_admin_accounts,
            "sa_instructor_accounts": sa_instructor_accounts,
            "courses_total": db.query(Course).count(),
            "courses_published": db.query(Course).filter(Course.status == COURSE_PUBLISHED).count(),
        },
        "revenue": {
            "total_revenue": revenue["total_revenue"],
            "b2b_revenue": revenue["b2b_revenue"],
            "b2c_revenue": revenue["b2c_revenue"],
            "total_due": revenue["total_due"],
            "transaction_count": revenue["transaction_count"],
        },
        "revenue_by_institute": sorted(revenue["by_institute"], key=lambda r: float(r["total"]), reverse=True)[:6],
        "revenue_by_month": revenue["by_month"],
        "payment_status_breakdown": payment_status_breakdown,
        "institute_status_breakdown": [
            {"state": state, "count": count} for state, count in subscription_breakdown.items()
        ],
    }
