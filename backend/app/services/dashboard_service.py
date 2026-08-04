from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.dependencies.auth import can_view_monetary_analytics
from app.models.attempt import ATTEMPT_IN_PROGRESS, Enrollment, TestAttempt
from app.models.coupon import Coupon
from app.models.exam_module import ExamModule, ExamModulePart
from app.models.institute import Institute
from app.models.payment import Payment
from app.models.payment_method import PaymentMethod
from app.models.role import SA_INSTRUCTOR, STUDENT, Role
from app.models.user import User
from app.models.user_session import UserSession
from app.services import institute_signup_service, payment_service, plan_service, revenue_service, subscription_service, super_admin_service

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
    group_key: str | None = None,
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
        # Which breakdown group this row belongs to, so selecting a group in the
        # panel can narrow the list below it. None on details that have no
        # breakdown.
        "group_key": group_key,
    }


def _detail(
    metric: str,
    title: str,
    description: str,
    empty_message: str,
    items: list[dict],
    breakdown: dict | None = None,
) -> dict:
    return {
        "metric": metric,
        "title": title,
        "description": description,
        "empty_message": empty_message,
        "items": items,
        # Optional composition of the headline figure - drawn above the records
        # by whichever metric has one. None means "just the list".
        "breakdown": breakdown,
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
        .options(
            joinedload(Payment.institute),
            joinedload(Payment.plan),
            joinedload(Payment.payment_method),
        )
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
        days_remaining = subscription_service.days_until(subscription.expires_at)
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


def _method_name(payment: Payment) -> str:
    return payment.payment_method.name if payment.payment_method else revenue_service.UNSPECIFIED_METHOD_NAME


def _method_key(payment: Payment) -> str:
    """Stable identity for a payment method, used to key both the breakdown and
    the colour a method carries. Falls back to the name so payments with no
    method row still group together instead of each becoming their own slice."""
    return str(payment.payment_method_id) if payment.payment_method_id is not None else "unspecified"


def _revenue_breakdown(payments: list[Payment], db: Session) -> list[dict]:
    """Cash collected per payment method, including all active payment methods.

    Pre-populates active payment methods so every configured method appears as
    a tab even if no revenue/transactions exist for it yet.
    """
    all_methods = db.query(PaymentMethod).filter(PaymentMethod.is_active.is_(True)).order_by(PaymentMethod.id.asc()).all()

    groups: dict[str, dict] = {}
    for pm in all_methods:
        key = str(pm.id)
        groups[key] = {
            "key": key,
            "payment_method_id": pm.id,
            "label": pm.name,
            "total": Decimal("0"),
            "count": 0,
            "currency": "INR",
        }

    for payment in payments:
        key = _method_key(payment)
        if key not in groups:
            groups[key] = {
                "key": key,
                "payment_method_id": payment.payment_method_id,
                "label": _method_name(payment),
                "total": Decimal("0"),
                "count": 0,
                "currency": payment.currency,
            }
        groups[key]["total"] += payment.amount_paid
        groups[key]["count"] += 1
        if payment.currency:
            groups[key]["currency"] = payment.currency

    collected = sum((group["total"] for group in groups.values()), Decimal("0"))
    ordered = sorted(groups.values(), key=lambda group: (group["count"] == 0, -group["total"], group["label"]))
    return [
        {
            **group,
            "total": str(group["total"]),
            "share": float(group["total"] / collected * 100) if collected else 0.0,
        }
        for group in ordered
    ]


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
            group_key=_method_key(payment),
            metadata=[
                _meta("Account type", "Institute" if payment.source == "b2b" else "Direct student"),
                _meta("Payment method", _method_name(payment)),
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
        breakdown={
            "label": "Revenue by payment method",
            "total": str(sum((payment.amount_paid for payment in payments), Decimal("0"))),
            "currency": payments[0].currency if payments else "INR",
            "groups": _revenue_breakdown(payments, db),
        },
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


def _student_name(student: User) -> str:
    return f"{student.first_name} {student.last_name}".strip() or student.email


def _students_detail(db: Session) -> dict:
    student_role = db.query(Role).filter(Role.name == STUDENT).first()
    students = (
        db.query(User)
        .options(joinedload(User.institute))
        .filter(User.role_id == student_role.id, User.deleted_at.is_(None))
        .order_by(User.created_at.desc(), User.id.desc())
        .all()
        if student_role
        else []
    )
    enrollment_counts = dict(
        db.query(Enrollment.user_id, func.count(Enrollment.id))
        .filter(Enrollment.is_active.is_(True))
        .group_by(Enrollment.user_id)
        .all()
    )
    items = [
        _item(
            item_id=str(student.id),
            title=_student_name(student),
            subtitle=student.email,
            status_label="Active" if student.is_active else "Inactive",
            status_tone="green" if student.is_active else "red",
            value=enrollment_counts.get(student.id, 0),
            value_label="Enrolled courses",
            value_type="number",
            metadata=[
                _meta("Account type", student.institute.name if student.institute else "Direct student"),
                _meta("Joined", _iso(student.created_at), "date"),
            ],
        )
        for student in students
    ]
    return _detail(
        "students",
        "Students Enrolled",
        "All student accounts and their active course enrollments.",
        "No students have been enrolled yet.",
        items,
    )


def _online_students_detail(db: Session) -> dict:
    now = datetime.now(timezone.utc)
    student_role = db.query(Role).filter(Role.name == STUDENT).first()
    if student_role is None:
        sessions = []
    else:
        sessions = (
            db.query(UserSession)
            .join(User, UserSession.user_id == User.id)
            .options(joinedload(UserSession.device), joinedload(UserSession.user).joinedload(User.institute))
            .filter(
                User.role_id == student_role.id,
                User.is_active.is_(True),
                User.deleted_at.is_(None),
                UserSession.revoked_at.is_(None),
                UserSession.expires_at > now,
            )
            .order_by(UserSession.created_at.desc(), UserSession.id.desc())
            .all()
        )
    items = [
        _item(
            item_id=str(session.id),
            title=_student_name(session.user),
            subtitle=session.user.email,
            status_label="Online",
            status_tone="green",
            value=session.device.name if session.device and session.device.name else "Active session",
            value_label="Device",
            metadata=[
                _meta("Institute", session.user.institute.name if session.user.institute else "Direct student"),
                _meta("IP address", session.ip_address or "Unknown"),
                _meta("Expires", _iso(session.expires_at), "date"),
            ],
        )
        for session in sessions
    ]
    return _detail(
        "online_students",
        "Students Online",
        "Student accounts with active, unrevoked sessions.",
        "No students are online right now.",
        items,
    )


def _active_tests_detail(db: Session) -> dict:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    attempts = (
        db.query(TestAttempt)
        .options(
            joinedload(TestAttempt.user).joinedload(User.institute),
            joinedload(TestAttempt.module),
            joinedload(TestAttempt.course),
        )
        .filter(TestAttempt.status == ATTEMPT_IN_PROGRESS, TestAttempt.expires_at > now)
        .order_by(TestAttempt.started_at.desc(), TestAttempt.id.desc())
        .all()
    )
    items = [
        _item(
            item_id=str(attempt.id),
            title=_student_name(attempt.user),
            subtitle=attempt.module.title if attempt.module else "Assessment attempt",
            status_label="In progress",
            status_tone="blue",
            value=_iso(attempt.expires_at),
            value_label="Expires",
            value_type="date",
            metadata=[
                _meta("Institute", attempt.user.institute.name if attempt.user and attempt.user.institute else "Direct student"),
                _meta("Started", _iso(attempt.started_at), "date"),
                _meta("Course", attempt.course.title if attempt.course else "Module access"),
            ],
        )
        for attempt in attempts
    ]
    return _detail(
        "active_tests",
        "Students Giving Tests",
        "Live student attempts that have started and not expired.",
        "No students are giving tests right now.",
        items,
    )


def get_metric_detail(db: Session, metric: str, actor: User | None = None) -> dict:
    money_metrics = {"revenue", "dues", "transactions"}
    if actor is not None and metric in money_metrics and not can_view_monetary_analytics(actor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Monetary analytics access is restricted by the owner account",
        )
    handlers = {
        "institutes": _institutes_detail,
        "students": _students_detail,
        "online_students": _online_students_detail,
        "active_tests": _active_tests_detail,
        "subscriptions": _subscriptions_detail,
        "revenue": _revenue_detail,
        "dues": _dues_detail,
        "transactions": _transactions_detail,
        "instructors": _instructors_detail,
        "modules": _modules_detail,
    }
    handler = handlers.get(metric)
    if handler is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dashboard metric not found")
    return handler(db)


def get_summary(db: Session, actor: User | None = None) -> dict:
    institutes = db.query(Institute).all()
    institutes_total = len(institutes)
    institutes_active = sum(1 for i in institutes if i.is_active)
    can_view_money = actor is None or can_view_monetary_analytics(actor)

    subscription_breakdown = {state: 0 for state in SUBSCRIPTION_STATES}
    for institute in institutes:
        _, state = subscription_service.current_subscription(db, institute.id)
        subscription_breakdown[state] += 1

    coupons_active = db.query(Coupon).filter(Coupon.is_active.is_(True)).count()
    super_admin_accounts = len(super_admin_service.list_super_admins(db))
    instructor_role = db.query(Role).filter(Role.name == SA_INSTRUCTOR).first()
    sa_instructor_accounts = (
        db.query(User).filter(User.role_id == instructor_role.id).count()
        if instructor_role
        else 0
    )
    student_role = db.query(Role).filter(Role.name == STUDENT).first()
    students_total = (
        db.query(User)
        .filter(User.role_id == student_role.id, User.deleted_at.is_(None))
        .count()
        if student_role
        else 0
    )
    direct_students_total = (
        db.query(User)
        .filter(
            User.role_id == student_role.id,
            User.deleted_at.is_(None),
            User.institute_id.is_(None),
        )
        .count()
        if student_role
        else 0
    )
    institute_students_total = (
        db.query(User)
        .filter(
            User.role_id == student_role.id,
            User.deleted_at.is_(None),
            User.institute_id.isnot(None),
        )
        .count()
        if student_role
        else 0
    )
    students_online = (
        db.query(func.count(func.distinct(UserSession.user_id)))
        .join(User, UserSession.user_id == User.id)
        .filter(
            User.role_id == student_role.id,
            User.is_active.is_(True),
            User.deleted_at.is_(None),
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > datetime.now(timezone.utc),
        )
        .scalar()
        if student_role
        else 0
    )
    students_giving_tests = (
        db.query(func.count(func.distinct(TestAttempt.user_id)))
        .filter(
            TestAttempt.status == ATTEMPT_IN_PROGRESS,
            TestAttempt.expires_at > datetime.now(timezone.utc).replace(tzinfo=None),
        )
        .scalar()
    )

    revenue = revenue_service.summary(db) if can_view_money else None

    payment_status_rows = db.query(Payment.status, func.count(Payment.id)).group_by(Payment.status).all() if can_view_money else []
    payment_status_breakdown = [{"status": status, "count": count} for status, count in payment_status_rows]

    return {
        "permissions": {
            "can_view_monetary_analytics": can_view_money,
        },
        "counts": {
            "institutes_total": institutes_total,
            "institutes_active": institutes_active,
            "students_total": students_total,
            "students_online": students_online or 0,
            "students_giving_tests": students_giving_tests or 0,
            "subscriptions_active": subscription_breakdown[subscription_service.STATE_ACTIVE],
            "coupons_active": coupons_active,
            # Drives the "publish a plan" warning - a platform with no live plan
            # shows an empty public pricing page.
            "plans_live": plan_service.live_plan_query(db).count(),
            # Institutes waiting on a human decision. Drives the review prompt
            # on the dashboard, which is the only place these surface.
            "institute_signups_pending": institute_signup_service.pending_count(db),
            "super_admin_accounts": super_admin_accounts,
            "sa_instructor_accounts": sa_instructor_accounts,
            "modules_total": db.query(ExamModule).filter(ExamModule.deleted_at.is_(None)).count(),
            "modules_published": db.query(ExamModule).filter(
                ExamModule.status == "published", ExamModule.deleted_at.is_(None)
            ).count(),
        },
        "revenue": (
            {
                "total_revenue": revenue["total_revenue"],
                "b2b_revenue": revenue["b2b_revenue"],
                "b2c_revenue": revenue["b2c_revenue"],
                "total_due": revenue["total_due"],
                "transaction_count": revenue["transaction_count"],
            }
            if revenue
            else None
        ),
        "revenue_by_institute": sorted(revenue["by_institute"], key=lambda r: float(r["total"]), reverse=True)[:6] if revenue else [],
        "revenue_by_month": revenue["by_month"] if revenue else [],
        "payment_status_breakdown": payment_status_breakdown,
        "student_type_breakdown": [
            {"type": "direct", "label": "Direct Students", "count": direct_students_total},
            {"type": "institute", "label": "Institute Students", "count": institute_students_total},
        ],
        "institute_status_breakdown": [
            {"state": state, "count": count} for state, count in subscription_breakdown.items()
        ],
    }
