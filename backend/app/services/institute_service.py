import json
import logging
import re
import secrets
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import delete, or_, select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import hash_password
from app.core.uploads import read_validated_image
from app.models.audit_log import AuditLog
from app.models.base import Base
from app.models.demo_account import DemoAccount
from app.models.exam_module import InstituteModule
from app.models.institute import Institute
from app.models.institute_branding import InstituteBranding
from app.models.payment import Payment
from app.models.plan import AUDIENCE_INSTITUTES, Plan
from app.models.role import INSTITUTE_ADMIN, Role
from app.models.subscription import Subscription
from app.models.user import User
from app.models.user_session import UserSession
from app.services import plan_service, subscription_service
from app.services.subscription_service import current_subscription

MAX_LOGO_BYTES = 2 * 1024 * 1024
ALLOWED_FONT_FAMILIES = {"Plus Jakarta Sans", "Inter", "Sora", "Outfit", "system-ui"}
ALLOWED_FONT_WEIGHTS = {400, 500, 600, 700, 800}
DEFAULT_ADMIN_PERMISSIONS = {
    "view_students": False,
    "manage_students": False,
    "view_student_activity": False,
    "manage_student_sessions": False,
    "manage_staff": False,
    "view_billing": False,
}
logger = logging.getLogger(__name__)


def normalized_admin_permissions(value: Optional[dict]) -> dict:
    permissions = DEFAULT_ADMIN_PERMISSIONS.copy()
    if value:
        permissions.update(
            {key: bool(value.get(key)) for key in DEFAULT_ADMIN_PERMISSIONS if key in value}
        )
    return permissions


def _audit(db: Session, actor: User, action: str, entity_id: Optional[int], ip: Optional[str], details=None) -> None:
    db.add(
        AuditLog(
            user_id=actor.id,
            action=action,
            entity_type="institute",
            entity_id=entity_id,
            details=details,
            ip_address=ip,
        )
    )


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "institute"


def _unique_slug(db: Session, name: str, exclude_id: Optional[int] = None) -> str:
    base = slugify(name)
    slug = base
    suffix = 2
    while True:
        query = db.query(Institute).filter(Institute.slug == slug)
        if exclude_id is not None:
            query = query.filter(Institute.id != exclude_id)
        if query.first() is None:
            return slug
        slug = f"{base}-{suffix}"
        suffix += 1


def get_institute_or_404(db: Session, institute_id: int) -> Institute:
    institute = db.get(Institute, institute_id)
    if institute is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institute not found")
    return institute


def _serialize(db: Session, institute: Institute) -> dict:
    _, sub_state = current_subscription(db, institute.id)
    branding = db.query(InstituteBranding).filter(InstituteBranding.institute_id == institute.id).first()
    admin = db.query(User).filter(User.institute_id == institute.id).join(User.role).filter_by(name=INSTITUTE_ADMIN).first()
    modules = (
        db.query(InstituteModule)
        .filter(InstituteModule.institute_id == institute.id, InstituteModule.is_active.is_(True))
        .all()
    )
    payment = (
        db.query(Payment)
        .filter(Payment.institute_id == institute.id)
        .order_by(Payment.id.desc())
        .first()
    )
    plan = db.get(Plan, institute.onboarding_plan_id) if institute.onboarding_plan_id else None
    return {
        "id": institute.id,
        "name": institute.name,
        "slug": institute.slug,
        "contact_email": institute.contact_email,
        "logo_url": f"/storage/{branding.logo_path}" if branding and branding.logo_path else None,
        "admin_permissions": normalized_admin_permissions(institute.admin_permissions),
        "session_duration_hours": institute.session_duration_hours,
        "ai_student_monthly_limit": institute.ai_student_monthly_limit,
        "is_active": institute.is_active,
        "onboarding_status": institute.onboarding_status,
        "subscription_state": sub_state,
        "created_at": institute.created_at,
        "admin_email": admin.email if admin else None,
        "admin_first_name": admin.first_name if admin else None,
        "admin_last_name": admin.last_name if admin else None,
        "agreement_reference": institute.agreement_reference,
        "agreement_notes": institute.agreement_notes,
        "agreed_amount": str(institute.agreed_amount) if institute.agreed_amount is not None else None,
        "amount_received": str(payment.amount_paid) if payment and payment.amount_paid is not None else None,
        "payment_method_id": payment.payment_method_id if payment else None,
        "payment_reference": payment.gateway_reference if payment else None,
        "agreement_currency": institute.agreement_currency or "INR",
        "student_limit": institute.student_limit,
        "staff_limit": institute.staff_limit,
        "access_duration_days": institute.access_duration_days,
        "plan_id": institute.onboarding_plan_id,
        "plan": ({
            "id": plan.id,
            "name": plan.name,
            "price": str(plan.price),
            "currency": plan.currency,
            "duration_days": plan.duration_days,
            "student_limit": plan.student_limit,
            "staff_limit": plan.staff_limit,
            "test_limit": plan.test_limit,
            "grace_days": plan.grace_days,
            "module_count": len(plan.modules),
        } if plan else None),
        "module_ids": [link.module_id for link in modules],
        "branding": {
            "primary_color": branding.primary_color if branding else "#e53935",
            "secondary_color": branding.secondary_color if branding else "#17191d",
            "logo_url": f"/storage/{branding.logo_path}" if branding and branding.logo_path else None,
        },
    }


def list_institutes(db: Session, status: Optional[str] = None) -> List[dict]:
    query = db.query(Institute).order_by(Institute.name)
    if status == "published":
        query = query.filter(Institute.onboarding_status == "published")
    elif status == "draft":
        query = query.filter(Institute.onboarding_status == "draft")
    elif status == "active":
        query = query.filter(Institute.is_active.is_(True))
    elif status == "suspended":
        query = query.filter(Institute.is_active.is_(False))
    return [_serialize(db, i) for i in query.all()]


def get_institute(db: Session, institute_id: int) -> dict:
    return _serialize(db, get_institute_or_404(db, institute_id))


def create_institute(
    db: Session,
    actor: User,
    name: str,
    contact_email: Optional[str],
    admin_email: str,
    admin_first_name: str,
    admin_last_name: str,
    admin_permissions: dict,
    session_duration_hours: int,
    ip: Optional[str],
    active: bool = True,
    onboarding_status: str = "published",
    ai_student_monthly_limit: Optional[int] = None,
) -> dict:
    if db.query(User).filter(User.email == admin_email).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Admin email already in use")

    role = db.query(Role).filter(Role.name == INSTITUTE_ADMIN).first()
    if role is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="INSTITUTE_ADMIN role not seeded")

    institute = Institute(
        name=name,
        slug=_unique_slug(db, name),
        contact_email=contact_email,
        admin_permissions=normalized_admin_permissions(admin_permissions),
        session_duration_hours=session_duration_hours,
        ai_student_monthly_limit=(
            ai_student_monthly_limit if ai_student_monthly_limit and ai_student_monthly_limit > 0 else None
        ),
        is_active=active,
        onboarding_status=onboarding_status,
    )
    db.add(institute)
    db.flush()

    temp_password = secrets.token_urlsafe(9)  # e.g. "kZ3f9QpN2xT" - meets strength rules below
    admin = User(
        email=admin_email,
        password_hash=hash_password(temp_password),
        role_id=role.id,
        institute_id=institute.id,
        first_name=admin_first_name,
        last_name=admin_last_name,
        is_active=active,
        force_password_reset=True,
    )
    db.add(admin)
    db.flush()

    db.add(InstituteBranding(institute_id=institute.id))

    _audit(db, actor, "institute.create", institute.id, ip, {"name": name, "admin_email": admin_email})
    db.commit()
    db.refresh(institute)

    result = _serialize(db, institute)
    result["admin_temp_password"] = temp_password
    result["admin_email"] = admin_email
    return result


def _resolve_agreement_plan(db: Session, actor: User, payload: dict, ip: Optional[str]) -> Optional[Plan]:
    """The institute plan this agreement is sold on, or None when the payload
    says nothing about a plan (an edit that only touches branding, say).

    A new plan is authored straight into the institute catalogue so it is
    available to the next institute too - the point of creating it here is
    saving the round trip to the Plans screen, not making a private copy.
    """
    if payload.get("new_plan"):
        return plan_service.build_plan(
            db, actor, {**payload["new_plan"], "audience": AUDIENCE_INSTITUTES, "is_published": False}, ip
        )
    if payload.get("plan_id") is None:
        return None
    plan = plan_service.get_plan_or_404(db, payload["plan_id"])
    if plan.is_internal:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This plan is not part of the institute catalogue")
    plan_service.assert_audience(plan, AUDIENCE_INSTITUTES)
    if not plan.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This plan is deactivated and cannot be assigned")
    if not plan.modules:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This plan has no courses - add courses to it before assigning it to an institute",
        )
    return plan


def update_institute(
    db: Session,
    actor: User,
    institute_id: int,
    payload: dict,
    ip: Optional[str],
) -> dict:
    institute = get_institute_or_404(db, institute_id)
    # Resolved before anything is written so a bad plan fails the whole save.
    plan = _resolve_agreement_plan(db, actor, payload, ip)
    if plan is not None:
        # Allocation is the plan's, not a second set of numbers free to drift
        # from the plan the institute is actually subscribed to.
        payload = {
            **payload,
            "student_limit": plan.student_limit,
            "staff_limit": plan.staff_limit,
            "access_duration_days": plan.duration_days,
            "module_ids": [module.id for module in plan.modules],
        }
    name = payload.get("name")
    if name is not None and name != institute.name:
        institute.name = name
        institute.slug = _unique_slug(db, name, exclude_id=institute.id)
    if "contact_email" in payload:
        institute.contact_email = payload["contact_email"]
    if "admin_permissions" in payload and payload["admin_permissions"]:
        institute.admin_permissions = normalized_admin_permissions(payload["admin_permissions"])
    if "session_duration_hours" in payload and payload["session_duration_hours"]:
        institute.session_duration_hours = payload["session_duration_hours"]
    if "ai_student_monthly_limit" in payload:
        per_student = payload["ai_student_monthly_limit"]
        institute.ai_student_monthly_limit = per_student if per_student and per_student > 0 else None

    # Agreement & Quota fields
    if "agreement_reference" in payload:
        institute.agreement_reference = payload["agreement_reference"]
    if "agreement_notes" in payload:
        institute.agreement_notes = payload["agreement_notes"]
    if "agreed_amount" in payload and payload["agreed_amount"] is not None:
        institute.agreed_amount = Decimal(str(payload["agreed_amount"]))
    if "currency" in payload and payload["currency"]:
        institute.agreement_currency = payload["currency"].upper()
    if "student_limit" in payload:
        institute.student_limit = payload["student_limit"]
    if "staff_limit" in payload:
        institute.staff_limit = payload["staff_limit"]
    if "access_duration_days" in payload:
        institute.access_duration_days = payload["access_duration_days"]
    if "onboarding_status" in payload and payload["onboarding_status"]:
        institute.onboarding_status = payload["onboarding_status"]

    if "amount_received" in payload or "payment_method_id" in payload or "payment_reference" in payload:
        amt_rec = payload.get("amount_received")
        if amt_rec is not None:
            received = Decimal(str(amt_rec))
            agreed = Decimal(str(payload.get("agreed_amount") or institute.agreed_amount or 0))
            st = "paid" if (agreed > 0 and received >= agreed) else ("partial" if received > 0 else "unpaid")
            pm_id = payload.get("payment_method_id")
            ref = payload.get("payment_reference")

            payment = (
                db.query(Payment)
                .filter(Payment.institute_id == institute.id)
                .order_by(Payment.id.desc())
                .first()
            )
            if payment:
                payment.amount_paid = received
                if agreed > 0:
                    payment.amount = agreed
                    payment.final_amount = agreed
                payment.status = st
                if pm_id:
                    payment.payment_method_id = pm_id
                if ref:
                    payment.gateway_reference = ref
            else:
                payment = Payment(
                    source="b2b",
                    institute_id=institute.id,
                    amount=agreed if agreed > 0 else received,
                    discount_amount=0,
                    final_amount=agreed if agreed > 0 else received,
                    amount_paid=received,
                    currency=institute.agreement_currency or "INR",
                    payment_method_id=pm_id,
                    gateway="manual",
                    gateway_reference=ref,
                    status=st,
                    paid_at=datetime.now(timezone.utc) if st == "paid" else None,
                )
                db.add(payment)
                db.flush()
                payment.invoice_number = f"INV-{payment.id:06d}"

    # Agreement plan. Assigning one is what gives the institute a subscription,
    # so seats and validity are enforced from the same place they were sold.
    if plan is not None and plan.id != institute.onboarding_plan_id:
        institute.onboarding_plan_id = plan.id
        # 0 on the plan means the agreement does not meter test attempts.
        institute.test_limit = plan.test_limit or None
        needs_subscription = True
    else:
        needs_subscription = False

    # Module allocation
    if "module_ids" in payload and payload["module_ids"] is not None:
        db.query(InstituteModule).filter(InstituteModule.institute_id == institute.id).delete()
        for mid in payload["module_ids"]:
            db.add(InstituteModule(institute_id=institute.id, module_id=mid, is_active=True, assigned_by_id=actor.id))

    # Branding colors
    if "primary_color" in payload or "secondary_color" in payload:
        branding = db.query(InstituteBranding).filter(InstituteBranding.institute_id == institute.id).first()
        if not branding:
            branding = InstituteBranding(institute_id=institute.id)
            db.add(branding)
        if "primary_color" in payload and payload["primary_color"]:
            branding.primary_color = payload["primary_color"]
        if "secondary_color" in payload and payload["secondary_color"]:
            branding.secondary_color = payload["secondary_color"]

    db.add(institute)
    _audit(db, actor, "institute.update", institute.id, ip)
    db.commit()
    if needs_subscription:
        # Deferred until the institute row is committed: assign() commits too,
        # and re-runs the catalogue guards on whatever was just written.
        subscription_service.assign(db, actor, institute.id, plan.id, None, ip)
    db.refresh(institute)
    return _serialize(db, institute)


def list_institute_admins(db: Session, institute_id: int) -> List[User]:
    role = db.query(Role).filter(Role.name == INSTITUTE_ADMIN).first()
    if role is None:
        return []
    return (
        db.query(User)
        .filter(
            User.institute_id == institute_id,
            User.role_id == role.id,
            User.deleted_at.is_(None),
        )
        .order_by(User.id)
        .all()
    )


def get_institute_admin_or_404(db: Session, institute_id: int, admin_id: int) -> User:
    admin = next((user for user in list_institute_admins(db, institute_id) if user.id == admin_id), None)
    if admin is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institute admin not found")
    return admin


def reset_admin_password(
    db: Session,
    actor: User,
    institute_id: int,
    admin_id: int,
    ip: Optional[str],
) -> dict:
    """Issue a fresh temporary password for an institute's admin account.

    The tenant-scoped member endpoints only manage instructors and students, so
    the admin account - the one that can lock an institute out entirely if its
    password is lost - had no reset path outside the forgot-password email flow.
    """
    admin = get_institute_admin_or_404(db, institute_id, admin_id)
    if admin.is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner password cannot be reset")

    temporary_password = secrets.token_urlsafe(9)
    admin.password_hash = hash_password(temporary_password)
    admin.force_password_reset = True
    admin.password_changed_at = datetime.now(timezone.utc)
    revoked = _revoke_sessions(db, admin.id)
    db.add(admin)
    db.add(
        AuditLog(
            user_id=actor.id,
            action="institute_admin.reset_password",
            entity_type="user",
            entity_id=admin.id,
            details={"institute_id": institute_id, "email": admin.email, "sessions_revoked": revoked},
            ip_address=ip,
        )
    )
    db.commit()
    return {
        "temporary_password": temporary_password,
        "email": admin.email,
        "sessions_revoked": revoked,
    }


def _revoke_sessions(db: Session, user_id: int) -> int:
    now = datetime.now(timezone.utc)
    sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
        .all()
    )
    for session in sessions:
        session.revoked_at = now
        db.add(session)
    return len(sessions)


def set_institute_active(db: Session, actor: User, institute_id: int, active: bool, ip: Optional[str]) -> dict:
    institute = get_institute_or_404(db, institute_id)
    institute.is_active = active
    db.add(institute)
    _audit(db, actor, "institute.suspend" if not active else "institute.reactivate", institute.id, ip)
    db.commit()
    db.refresh(institute)
    return _serialize(db, institute)


def delete_institute(db: Session, actor: User, institute_id: int, ip: Optional[str]) -> None:
    """Permanently remove tenant data while retaining detached financial history."""
    institute = get_institute_or_404(db, institute_id)
    tables = Base.metadata.tables
    user_ids = list(
        db.execute(select(tables["users"].c.id).where(tables["users"].c.institute_id == institute_id)).scalars()
    )
    attempt_ids = (
        list(
            db.execute(
                select(tables["test_attempts"].c.id).where(
                    tables["test_attempts"].c.user_id.in_(user_ids)
                )
            ).scalars()
        )
        if user_ids
        else []
    )
    announcement_filter = tables["announcements"].c.institute_id == institute_id
    if user_ids:
        announcement_filter = or_(
            announcement_filter,
            tables["announcements"].c.created_by_id.in_(user_ids),
        )
    announcement_ids = list(
        db.execute(
            select(tables["announcements"].c.id).where(announcement_filter)
        ).scalars()
    )
    institute_course_ids = list(
        db.execute(
            select(tables["institute_courses"].c.id).where(
                tables["institute_courses"].c.institute_id == institute_id
            )
        ).scalars()
    )

    storage_paths = _institute_storage_paths(
        db, tables, institute_id, user_ids, attempt_ids
    )
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    _audit(
        db,
        actor,
        "institute.delete",
        institute.id,
        ip,
        {
            "name": institute.name,
            "slug": institute.slug,
            "financial_records_retained": True,
        },
    )
    db.flush()

    # Financial and contract rows are immutable history. Detach their live
    # foreign keys and retain the deleted institute identity as a snapshot.
    payment_scope = tables["payments"].c.institute_id == institute_id
    subscription_scope = tables["subscriptions"].c.institute_id == institute_id
    if user_ids:
        payment_scope = or_(payment_scope, tables["payments"].c.user_id.in_(user_ids))
        subscription_scope = or_(
            subscription_scope, tables["subscriptions"].c.user_id.in_(user_ids)
        )
    db.execute(
        update(tables["payments"])
        .where(payment_scope)
        .values(
            institute_id=None,
            institute_id_snapshot=institute.id,
            institute_name_snapshot=institute.name,
            institute_slug_snapshot=institute.slug,
            user_id=None,
        )
    )
    db.execute(
        update(tables["subscriptions"])
        .where(subscription_scope)
        .values(
            institute_id=None,
            institute_id_snapshot=institute.id,
            institute_name_snapshot=institute.name,
            institute_slug_snapshot=institute.slug,
            user_id=None,
            cancelled_at=now,
        )
    )

    if user_ids:
        _delete_user_operational_data(
            db,
            tables,
            user_ids,
            attempt_ids,
            announcement_ids,
            institute_course_ids,
            actor.id,
        )

    for table_name in (
        "ai_eval_limits",
        "leaderboard_snapshots",
        "institute_modules",
        "institute_courses",
        "settings",
        "demo_accounts",
        "institute_branding",
    ):
        table = tables[table_name]
        db.execute(delete(table).where(table.c.institute_id == institute_id))

    _remove_deleted_announcement_targets(
        db, tables["announcements"], institute_id, user_ids
    )
    db.execute(delete(tables["announcements"]).where(announcement_filter))
    db.execute(delete(tables["users"]).where(tables["users"].c.institute_id == institute_id))
    db.execute(delete(tables["institutes"]).where(tables["institutes"].c.id == institute_id))
    db.commit()

    _delete_storage_files(storage_paths)


def _institute_storage_paths(
    db: Session,
    tables,
    institute_id: int,
    user_ids: list[int],
    attempt_ids: list[int],
) -> list[str]:
    paths: list[str] = []
    paths.extend(
        path
        for path in db.execute(
            select(tables["institute_branding"].c.logo_path).where(
                tables["institute_branding"].c.institute_id == institute_id
            )
        ).scalars()
        if path
    )
    if user_ids:
        paths.extend(
            path
            for path in db.execute(
                select(tables["users"].c.avatar_path).where(
                    tables["users"].c.id.in_(user_ids)
                )
            ).scalars()
            if path
        )
    if attempt_ids:
        paths.extend(
            path
            for path in db.execute(
                select(tables["attempt_answers"].c.audio_path).where(
                    tables["attempt_answers"].c.attempt_id.in_(attempt_ids)
                )
            ).scalars()
            if path
        )
    return paths


def _delete_user_operational_data(
    db: Session,
    tables,
    user_ids: list[int],
    attempt_ids: list[int],
    announcement_ids: list[int],
    institute_course_ids: list[int],
    replacement_user_id: int,
) -> None:
    notifications_filter = tables["student_notifications"].c.user_id.in_(user_ids)
    if attempt_ids:
        notifications_filter = or_(
            notifications_filter,
            tables["student_notifications"].c.attempt_id.in_(attempt_ids),
        )
    if announcement_ids:
        notifications_filter = or_(
            notifications_filter,
            tables["student_notifications"].c.announcement_id.in_(announcement_ids),
        )
    db.execute(delete(tables["student_notifications"]).where(notifications_filter))

    if attempt_ids:
        for table_name in (
            "ai_evaluations",
            "grading_queue",
            "reevaluation_requests",
            "student_badges",
            "attempt_answers",
            "attempt_part_grades",
            "attempt_flags",
        ):
            table = tables[table_name]
            db.execute(delete(table).where(table.c.attempt_id.in_(attempt_ids)))
        db.execute(delete(tables["test_attempts"]).where(tables["test_attempts"].c.id.in_(attempt_ids)))

    enrollment_filter = tables["enrollments"].c.user_id.in_(user_ids)
    if institute_course_ids:
        enrollment_filter = or_(
            enrollment_filter,
            tables["enrollments"].c.institute_course_id.in_(institute_course_ids),
        )
    db.execute(delete(tables["enrollments"]).where(enrollment_filter))
    db.execute(delete(tables["student_badges"]).where(tables["student_badges"].c.user_id.in_(user_ids)))
    db.execute(delete(tables["leaderboard_snapshots"]).where(tables["leaderboard_snapshots"].c.user_id.in_(user_ids)))
    db.execute(delete(tables["instructor_profiles"]).where(tables["instructor_profiles"].c.user_id.in_(user_ids)))
    db.execute(delete(tables["user_devices"]).where(tables["user_devices"].c.user_id.in_(user_ids)))
    db.execute(delete(tables["user_sessions"]).where(tables["user_sessions"].c.user_id.in_(user_ids)))

    # Retained platform content must not keep a foreign key to a deleted user.
    for table_name, column_name in (
        ("courses", "created_by_id"),
        ("course_assets", "uploaded_by_id"),
        ("question_banks", "created_by_id"),
        ("questions", "created_by_id"),
        ("assessments", "created_by_id"),
        ("exam_modules", "created_by_id"),
        ("exam_module_assets", "uploaded_by_id"),
        ("exam_module_questions", "created_by_id"),
    ):
        table = tables[table_name]
        db.execute(
            update(table)
            .where(table.c[column_name].in_(user_ids))
            .values({column_name: replacement_user_id})
        )

    for table_name, column_name in (
        ("attempt_part_grades", "grader_id"),
        ("grading_queue", "assigned_to_id"),
        ("reevaluation_requests", "assigned_to_id"),
        ("api_logs", "user_id"),
        ("audit_logs", "user_id"),
        ("error_logs", "user_id"),
    ):
        table = tables[table_name]
        db.execute(
            update(table)
            .where(table.c[column_name].in_(user_ids))
            .values({column_name: None})
        )


def _remove_deleted_announcement_targets(
    db: Session,
    announcements,
    institute_id: int,
    user_ids: list[int],
) -> None:
    rows = db.execute(
        select(
            announcements.c.id,
            announcements.c.target_institute_ids,
            announcements.c.target_user_ids,
        ).where(announcements.c.institute_id.is_(None))
    ).all()
    deleted_users = set(user_ids)
    for row in rows:
        institute_targets = _without_json_ids(row.target_institute_ids, {institute_id})
        user_targets = _without_json_ids(row.target_user_ids, deleted_users)
        if (
            institute_targets != row.target_institute_ids
            or user_targets != row.target_user_ids
        ):
            db.execute(
                update(announcements)
                .where(announcements.c.id == row.id)
                .values(
                    target_institute_ids=institute_targets,
                    target_user_ids=user_targets,
                )
            )


def _without_json_ids(value: Optional[str], removed: set[int]) -> Optional[str]:
    if not value or not removed:
        return value
    try:
        ids = [int(item) for item in json.loads(value)]
    except (TypeError, ValueError, json.JSONDecodeError):
        return value
    remaining = [item for item in ids if item not in removed]
    return json.dumps(remaining) if remaining else None


def _delete_storage_files(relative_paths: list[str]) -> None:
    root = settings.storage_path.resolve()
    for relative_path in set(relative_paths):
        candidate = (root / relative_path).resolve()
        if candidate != root and root in candidate.parents:
            try:
                candidate.unlink(missing_ok=True)
            except OSError:
                logger.warning(
                    "Could not remove deleted institute file %s",
                    candidate,
                    exc_info=True,
                )


def _get_or_create_branding(db: Session, institute_id: int) -> InstituteBranding:
    branding = db.query(InstituteBranding).filter(InstituteBranding.institute_id == institute_id).first()
    if branding is None:
        branding = InstituteBranding(institute_id=institute_id)
        db.add(branding)
        db.commit()
        db.refresh(branding)
    return branding


def _serialize_branding(branding: InstituteBranding, institute_name: str) -> dict:
    return {
        "institute_id": branding.institute_id,
        "institute_name": institute_name,
        "logo_url": f"/storage/{branding.logo_path}" if branding.logo_path else None,
        "primary_color": branding.primary_color,
        "secondary_color": branding.secondary_color,
        "font_family": branding.font_family,
        "heading_font_weight": branding.heading_font_weight,
        "body_font_weight": branding.body_font_weight,
    }


def get_branding(db: Session, institute_id: int) -> dict:
    institute = get_institute_or_404(db, institute_id)
    return _serialize_branding(_get_or_create_branding(db, institute_id), institute.name)


_HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def update_branding(
    db: Session,
    actor: User,
    institute_id: int,
    primary_color: Optional[str],
    secondary_color: Optional[str],
    ip: Optional[str],
    font_family: Optional[str] = None,
    heading_font_weight: Optional[int] = None,
    body_font_weight: Optional[int] = None,
) -> dict:
    institute = get_institute_or_404(db, institute_id)
    branding = _get_or_create_branding(db, institute_id)

    for label, value in (("primary_color", primary_color), ("secondary_color", secondary_color)):
        if value is not None:
            if not _HEX_COLOR_RE.match(value):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{label} must be a hex color like #4f46e5")
            setattr(branding, label, value)

    if font_family is not None:
        if font_family not in ALLOWED_FONT_FAMILIES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported font family")
        branding.font_family = font_family
    for label, value in (
        ("heading_font_weight", heading_font_weight),
        ("body_font_weight", body_font_weight),
    ):
        if value is not None:
            if value not in ALLOWED_FONT_WEIGHTS:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported {label}")
            setattr(branding, label, value)

    db.add(branding)
    _audit(db, actor, "institute.update_branding", institute_id, ip)
    db.commit()
    db.refresh(branding)
    return _serialize_branding(branding, institute.name)


async def save_logo(db: Session, actor: User, institute_id: int, upload: UploadFile, ip: Optional[str]) -> dict:
    institute = get_institute_or_404(db, institute_id)
    ext, content = await read_validated_image(upload, MAX_LOGO_BYTES, "Logo")

    logos_dir = settings.storage_path / "institute_logos"
    logos_dir.mkdir(parents=True, exist_ok=True)

    branding = _get_or_create_branding(db, institute_id)
    if branding.logo_path:
        old = settings.storage_path / branding.logo_path
        if old.is_file():
            old.unlink()

    relative_path = f"institute_logos/institute_{institute_id}{ext}"
    (settings.storage_path / relative_path).write_bytes(content)

    branding.logo_path = relative_path
    db.add(branding)
    _audit(db, actor, "institute.update_logo", institute_id, ip)
    db.commit()
    db.refresh(branding)
    return _serialize_branding(branding, institute.name)


def get_public_branding(db: Session, slug: str) -> dict:
    institute = db.query(Institute).filter(Institute.slug == slug).first()
    if institute is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institute not found")
    branding = _get_or_create_branding(db, institute.id)
    return _serialize_branding(branding, institute.name)
