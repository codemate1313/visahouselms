from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.coupon import Coupon
from app.models.exam_module import ExamModule, ExamModulePart
from app.models.institute import Institute
from app.models.payment import Payment
from app.models.role import SA_INSTRUCTOR, Role
from app.models.user import User
from app.services import demo_service, payment_service, revenue_service, subscription_service, super_admin_service

SUBSCRIPTION_STATES = (
    subscription_service.STATE_ACTIVE,
    subscription_service.STATE_GRACE,
    subscription_service.STATE_EXPIRED,
    subscription_service.STATE_NONE,
)

def _iso(value) -> str | None:
    return value.isoformat() if value is not None else None


def _meta(label: str, value, value_type: str = "text", currency: str | None = None) -> dict:
    return {
        "label": label,
        "value": value,
        "value_type": value_type,
        "currency": currency,
    }


def _item(
    *,
    item_id: str,
    title: str,
    subtitle: str | None = None,
    status_label: str | None = None,
    status_tone: str = "slate",
    value=None,
    value_label: str | None = None,
    value_type: str = "text",
    currency: str | None = None,
    metadata: list[dict] | None = None,
) -> dict:
    return {
        "id": item_id,
        "title": title,
        "subtitle": subtitle,
        "status_label": status_label,
        "status_tone": status_tone,
        "value": value,
        "value_label": value_label,
        "value_type": value_type,
        "currency": currency,
        "metadata": metadata or [],
    }


def _detail(metric: str, title: str, description: str, empty_message: str, items: list[dict]) -> dict:
    return {
        "metric": metric,
        "title": title,
        "description": description,
        "empty_message": empty_message,
        "items": items,
    }


def _subscription_label(state: str) -> str:
    return {
        subscription_service.STATE_ACTIVE: "Active",
        subscription_service.STATE_GRACE: "In grace",
        subscription_service.STATE_EXPIRED: "Expired",
        subscription_service.STATE_NONE: "No plan",
    }.get(state, state.replace("_", " ").title())


def _payment_owner(payment: Payment, users: dict[int, User]) -> str:
    if payment.institute is not None:
        return payment.institute.name
    user = users.get(payment.user_id) if payment.user_id is not None else None
    if user is not None:
        return f"{user.first_name} {user.last_name}".strip() or user.email
    return "Unassigned account"


def _payment_subtitle(payment: Payment, users: dict[int, User]) -> str:
    parts = []
    if payment.invoice_number:
        parts.append(payment.invoice_number)
    if payment.plan is not None:
        parts.append(payment.plan.name)
    if payment.institute is None and payment.user_id in users:
        parts.append(users[payment.user_id].email)
    return " · ".join(parts) or "Payment record"


def _payment_tone(payment: Payment) -> str:
    return {
        payment_service.STATUS_PAID: "green",
        payment_service.STATUS_PARTIAL: "amber",
        payment_service.STATUS_PENDING: "amber",
        payment_service.STATUS_FAILED: "red",
        payment_service.STATUS_REFUNDED: "slate",
    }.get(payment.status, "slate")


def _payment_rows(db: Session, statuses: tuple[str, ...]) -> tuple[list[Payment], dict[int, User]]:
    payments = (
        db.query(Payment)
        .options(joinedload(Payment.institute), joinedload(Payment.plan))
        .filter(Payment.status.in_(statuses))
        .order_by(Payment.created_at.desc(), Payment.id.desc())
        .all()
    )
    user_ids = {payment.user_id for payment in payments if payment.user_id is not None}
    users = (
        {user.id: user for user in db.query(User).filter(User.id.in_(user_ids)).all()}
        if user_ids
        else {}
    )
    return payments, users


def _institutes_detail(db: Session) -> dict:
    items = []
    for institute in db.query(Institute).order_by(Institute.created_at.desc(), Institute.id.desc()).all():
        _, subscription_state = subscription_service.current_subscription(db, institute.id)
        status_label = "Active" if institute.is_active else "Inactive"
        if institute.onboarding_status == "draft":
            status_label = "Draft"
        items.append(
            _item(
                item_id=str(institute.id),
                title=institute.name,
                subtitle=institute.contact_email or institute.slug,
                status_label=status_label,
                status_tone=(
                    "amber"
                    if institute.onboarding_status == "draft"
                    else ("green" if institute.is_active else "red")
                ),
                value=_subscription_label(subscription_state),
                value_label="Access",
                metadata=[
                    _meta("Onboarding", institute.onboarding_status.replace("_", " ").title()),
                    _meta("Student limit", institute.student_limit if institute.student_limit is not None else "Unlimited", "number" if institute.student_limit is not None else "text"),
                    _meta("Created", _iso(institute.created_at), "date"),
                ],
            )
        )
    return _detail(
        "institutes",
        "Total Institutes",
        "Every institute account and its current platform access.",
        "No institutes have been created yet.",
        items,
    )


def _subscriptions_detail(db: Session) -> dict:
    items = []
    institutes = db.query(Institute).order_by(Institute.name).all()
    for institute in institutes:
        subscription, state = subscription_service.current_subscription(db, institute.id)
        if subscription is None or state != subscription_service.STATE_ACTIVE:
            continue
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        days_remaining = max(0, (subscription.expires_at - now).days)
        items.append(
            _item(
                item_id=str(subscription.id),
                title=institute.name,
                subtitle=subscription.plan.name if subscription.plan else "Assigned access",
                status_label="Active",
                status_tone="green",
                value=days_remaining,
                value_label="Days remaining",
                value_type="number",
                metadata=[
                    _meta("Starts", _iso(subscription.starts_at), "date"),
                    _meta("Expires", _iso(subscription.expires_at), "date"),
                    _meta("Grace period", subscription.grace_days, "number"),
                ],
            )
        )
    return _detail(
        "subscriptions",
        "Active Subscriptions",
        "Institute subscriptions that currently have live access.",
        "There are no active institute subscriptions.",
        items,
    )


def _revenue_detail(db: Session) -> dict:
    payments, users = _payment_rows(db, revenue_service.REVENUE_STATUSES)
    items = [
        _item(
            item_id=str(payment.id),
            title=_payment_owner(payment, users),
            subtitle=_payment_subtitle(payment, users),
            status_label=payment.status.title(),
            status_tone=_payment_tone(payment),
            value=str(payment.amount_paid),
            value_label="Collected",
            value_type="money",
            currency=payment.currency,
            metadata=[
                _meta("Account type", "Institute" if payment.source == "b2b" else "Direct student"),
                _meta("Invoice total", str(payment.final_amount), "money", payment.currency),
                _meta("Received", _iso(payment.paid_at or payment.created_at), "date"),
            ],
        )
        for payment in payments
    ]
    return _detail(
        "revenue",
        "Total Revenue",
        "Payments collected from institutes and direct students.",
        "No revenue has been collected yet.",
        items,
    )


def _dues_detail(db: Session) -> dict:
    payments, users = _payment_rows(db, revenue_service.DUE_STATUSES)
    items = []
    for payment in payments:
        due_amount = payment.final_amount - payment.amount_paid
        if due_amount <= 0:
            continue
        items.append(
            _item(
                item_id=str(payment.id),
                title=_payment_owner(payment, users),
                subtitle=_payment_subtitle(payment, users),
                status_label=payment.status.title(),
                status_tone="amber",
                value=str(due_amount),
                value_label="Outstanding",
                value_type="money",
                currency=payment.currency,
                metadata=[
                    _meta("Invoice total", str(payment.final_amount), "money", payment.currency),
                    _meta("Already paid", str(payment.amount_paid), "money", payment.currency),
                    _meta("Issued", _iso(payment.created_at), "date"),
                ],
            )
        )
    return _detail(
        "dues",
        "Total Due",
        "Outstanding balances, including the account that owes each amount.",
        "There are no outstanding balances.",
        items,
    )


def _transactions_detail(db: Session) -> dict:
    payments, users = _payment_rows(db, revenue_service.REVENUE_STATUSES)
    items = [
        _item(
            item_id=str(payment.id),
            title=_payment_owner(payment, users),
            subtitle=_payment_subtitle(payment, users),
            status_label=payment.status.title(),
            status_tone=_payment_tone(payment),
            value=str(payment.amount_paid),
            value_label="Received",
            value_type="money",
            currency=payment.currency,
            metadata=[
                _meta("Source", "Institute" if payment.source == "b2b" else "Direct student"),
                _meta("Method", payment.gateway.replace("_", " ").title()),
                _meta("Recorded", _iso(payment.paid_at or payment.created_at), "date"),
            ],
        )
        for payment in payments
    ]
    return _detail(
        "transactions",
        "Transactions",
        "Successful and partially settled payment activity.",
        "No completed transactions have been recorded.",
        items,
    )


def _demos_detail(db: Session) -> dict:
    items = []
    for demo in demo_service.list_demos(db):
        if demo["state"] != demo_service.STATE_ACTIVE:
            continue
        items.append(
            _item(
                item_id=str(demo["id"]),
                title=demo["institute_name"] or f"Demo #{demo['id']}",
                subtitle=f"Created for {demo['duration_days']} days",
                status_label="Active",
                status_tone="blue",
                value=demo["days_remaining"],
                value_label="Days remaining",
                value_type="number",
                metadata=[
                    _meta("Course limit", demo["course_limit"], "number"),
                    _meta("Test limit", demo["test_limit"], "number"),
                    _meta("Expires", _iso(demo["expires_at"]), "date"),
                ],
            )
        )
    return _detail(
        "demos",
        "Active Demos",
        "Demo institutes that can currently access the platform.",
        "There are no active demo accounts.",
        items,
    )


def _instructors_detail(db: Session) -> dict:
    instructor_role = db.query(Role).filter(Role.name == SA_INSTRUCTOR).first()
    instructors = (
        db.query(User)
        .filter(User.role_id == instructor_role.id)
        .order_by(User.created_at.desc(), User.id.desc())
        .all()
        if instructor_role
        else []
    )
    module_counts = dict(
        db.query(ExamModule.created_by_id, func.count(ExamModule.id))
        .filter(ExamModule.deleted_at.is_(None))
        .group_by(ExamModule.created_by_id)
        .all()
    )
    items = [
        _item(
            item_id=str(instructor.id),
            title=f"{instructor.first_name} {instructor.last_name}".strip(),
            subtitle=instructor.email,
            status_label="Active" if instructor.is_active else "Inactive",
            status_tone="green" if instructor.is_active else "red",
            value=module_counts.get(instructor.id, 0),
            value_label="Courses created",
            value_type="number",
            metadata=[
                _meta("Account", "Enabled" if instructor.is_active else "Disabled"),
                _meta("Joined", _iso(instructor.created_at), "date"),
            ],
        )
        for instructor in instructors
    ]
    return _detail(
        "instructors",
        "SA Instructors",
        "Instructor accounts and the number of courses each has authored.",
        "No SA instructor accounts have been created.",
        items,
    )


def _modules_detail(db: Session) -> dict:
    modules = (
        db.query(ExamModule)
        .options(
            joinedload(ExamModule.created_by),
            selectinload(ExamModule.parts).selectinload(ExamModulePart.questions),
        )
        .filter(ExamModule.status == "published", ExamModule.deleted_at.is_(None))
        .order_by(ExamModule.published_at.desc(), ExamModule.id.desc())
        .all()
    )
    items = []
    for module in modules:
        author = f"{module.created_by.first_name} {module.created_by.last_name}".strip()
        question_count = sum(len(part.questions) for part in module.parts)
        items.append(
            _item(
                item_id=str(module.id),
                title=module.title,
                subtitle=f"By {author}",
                status_label="Visible" if module.is_visible else "Hidden",
                status_tone="green" if module.is_visible else "slate",
                value=module.module_type.replace("_", " ").title(),
                value_label="Course type",
                metadata=[
                    _meta("Parts", len(module.parts), "number"),
                    _meta("Questions", question_count, "number"),
                    _meta("Published", _iso(module.published_at or module.created_at), "date"),
                ],
            )
        )
    return _detail(
        "modules",
        "Published Modules",
        "Published assessment courses, their authors, visibility, and content size.",
        "No courses have been published yet.",
        items,
    )


def get_metric_detail(db: Session, metric: str) -> dict:
    handlers = {
        "institutes": _institutes_detail,
        "subscriptions": _subscriptions_detail,
        "revenue": _revenue_detail,
        "dues": _dues_detail,
        "transactions": _transactions_detail,
        "demos": _demos_detail,
        "instructors": _instructors_detail,
        "modules": _modules_detail,
    }
    handler = handlers.get(metric)
    if handler is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard metric not found")
    return handler(db)


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
            "modules_total": db.query(ExamModule).filter(ExamModule.deleted_at.is_(None)).count(),
            "modules_published": db.query(ExamModule).filter(
                ExamModule.status == "published", ExamModule.deleted_at.is_(None)
            ).count(),
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
