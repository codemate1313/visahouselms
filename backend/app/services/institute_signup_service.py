"""Public institute applications and the Super Admin queue that reviews them.

An application is not an institute. Anyone on the internet can submit one, so
nothing is created from it until a Super Admin approves - at which point the
normal institute-creation path runs and the applicant receives login details for
a real admin account. What they cannot do yet is anything at all: the institute
has no subscription, so seats are zero and the portal holds them in the setup
wizard until they have chosen a tier and paid for it.

Rejections are kept, not deleted. The queue doubles as the record of who was let
in and who was turned away, and the reviewer's reason is emailed verbatim so an
applicant who was declined for something fixable can fix it.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.audit_log import AuditLog
from app.models.institute_signup import (
    STATUS_APPROVED,
    STATUS_PENDING,
    STATUS_REJECTED,
    InstituteSignupRequest,
)
from app.models.plan import AUDIENCE_INSTITUTES, Plan
from app.models.role import DEVELOPER, SUPER_ADMIN
from app.models.user import User
from app.services import account_service, institute_service, notification_service


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _audit(db: Session, actor: Optional[User], action: str, request_id: int, ip: Optional[str], details=None) -> None:
    db.add(
        AuditLog(
            user_id=actor.id if actor else None,
            action=action,
            entity_type="institute_signup_request",
            entity_id=request_id,
            details=details,
            ip_address=ip,
        )
    )


def _serialize(row: InstituteSignupRequest) -> dict:
    return {
        "id": row.id,
        "institute_name": row.institute_name,
        "contact_email": row.contact_email,
        "contact_phone": row.contact_phone,
        "city": row.city,
        "country": row.country,
        "website": row.website,
        "admin_first_name": row.admin_first_name,
        "admin_last_name": row.admin_last_name,
        "admin_email": row.admin_email,
        "expected_students": row.expected_students,
        "expected_instructors": row.expected_instructors,
        "message": row.message,
        "interested_plan_id": row.interested_plan_id,
        "interested_plan_name": row.interested_plan.name if row.interested_plan else None,
        "status": row.status,
        "rejection_reason": row.rejection_reason,
        "reviewed_by": row.reviewed_by.email if row.reviewed_by else None,
        "reviewed_at": row.reviewed_at,
        "created_institute_id": row.created_institute_id,
        "created_at": row.created_at,
    }


def _query(db: Session):
    return db.query(InstituteSignupRequest).options(
        joinedload(InstituteSignupRequest.interested_plan),
        joinedload(InstituteSignupRequest.reviewed_by),
    )


def _send(db: Session, to_address: str, rendered: tuple[str, str, str]) -> None:
    """Best-effort delivery. An email that fails to send must never roll back an
    approval that has already created an account - the credentials are still
    recoverable from the queue, a lost institute is not."""
    subject, plain, html = rendered
    try:
        from app.services import smtp_service

        smtp_service.send_email(db, to_address, subject, plain, html_body=html)
    except Exception as exc:  # noqa: BLE001 - logged, never raised
        import logging

        logging.getLogger(__name__).warning("Institute signup email to %s failed: %s", to_address, exc)
        notification_service.record_send_failure(db, f"Institute signup email to {to_address} failed: {exc}")


# ---------------------------------------------------------------------------
# Public submission
# ---------------------------------------------------------------------------


def submit(db: Session, data: dict, ip: Optional[str]) -> dict:
    """Records a public application.

    Two collisions are refused up front rather than at approval time, because
    an applicant who is going to be rejected for a duplicate should learn that
    now and not after a reviewer has spent time on it: an email already
    belonging to a user, and an application from the same address still waiting
    in the queue.
    """
    admin_email = account_service.ensure_user_credentials_available(db, data["admin_email"])
    contact_email = account_service.validate_account_email(data["contact_email"])

    pending = (
        db.query(InstituteSignupRequest)
        .filter(
            InstituteSignupRequest.admin_email == admin_email,
            InstituteSignupRequest.status == STATUS_PENDING,
        )
        .first()
    )
    if pending is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="We already have an application from this email under review - we will be in touch shortly",
        )

    # An interest in a tier is context for the reviewer, never a commitment, so
    # a stale or bogus id is dropped rather than failing the application.
    interested_plan_id = data.get("interested_plan_id")
    if interested_plan_id is not None:
        plan = db.get(Plan, interested_plan_id)
        if plan is None or plan.audience != AUDIENCE_INSTITUTES or not plan.is_active:
            interested_plan_id = None

    row = InstituteSignupRequest(
        institute_name=data["institute_name"].strip(),
        contact_email=contact_email,
        contact_phone=(data.get("contact_phone") or "").strip() or None,
        city=(data.get("city") or "").strip() or None,
        country=(data.get("country") or "").strip() or None,
        website=(data.get("website") or "").strip() or None,
        admin_first_name=data["admin_first_name"].strip(),
        admin_last_name=data["admin_last_name"].strip(),
        admin_email=admin_email,
        expected_students=data.get("expected_students"),
        expected_instructors=data.get("expected_instructors"),
        message=(data.get("message") or "").strip() or None,
        interested_plan_id=interested_plan_id,
        status=STATUS_PENDING,
        submitted_ip=ip,
    )
    db.add(row)
    db.flush()
    _audit(db, None, "institute_signup.submit", row.id, ip, {"institute": row.institute_name})
    # Committed before anything else is attempted. Everything below is a
    # courtesy - telling staff, telling the applicant - and none of it is worth
    # losing an application over. `create_notification` commits internally too,
    # which would otherwise entangle its failures with this insert.
    db.commit()

    try:
        notification_service.notify_roles(
            db,
            {SUPER_ADMIN, DEVELOPER},
            kind="institute_signup_request",
            title="New institute application",
            message=f"{row.institute_name} applied for an institute account.",
            link_url="/super-admin/institute-signups",
        )
    except Exception as exc:  # noqa: BLE001 - the application is already safe
        import logging

        db.rollback()
        logging.getLogger(__name__).warning("Institute signup notification failed: %s", exc)

    from app.services import email_template_service

    _send(
        db,
        row.contact_email,
        email_template_service.render_institute_application_received_email(
            row.admin_first_name, row.institute_name
        ),
    )
    # Only ever an acknowledgement - a public caller learns nothing about the
    # queue beyond the fact that their own form arrived.
    return {"submitted": True}


# ---------------------------------------------------------------------------
# Super Admin queue
# ---------------------------------------------------------------------------


def list_requests(db: Session, status_filter: Optional[str] = None) -> list[dict]:
    query = _query(db)
    if status_filter:
        query = query.filter(InstituteSignupRequest.status == status_filter)
    rows = query.order_by(InstituteSignupRequest.created_at.desc()).all()
    return [_serialize(row) for row in rows]


def pending_count(db: Session) -> int:
    return (
        db.query(InstituteSignupRequest)
        .filter(InstituteSignupRequest.status == STATUS_PENDING)
        .count()
    )


def get_request(db: Session, request_id: int) -> dict:
    """One application, serialized. The public read - routers have no business
    reaching past the service boundary for `_serialize`."""
    return _serialize(get_or_404(db, request_id))


def get_or_404(db: Session, request_id: int) -> InstituteSignupRequest:
    row = _query(db).filter(InstituteSignupRequest.id == request_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    return row


def _require_pending(row: InstituteSignupRequest) -> None:
    if row.status != STATUS_PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This application has already been {row.status}",
        )


def approve(db: Session, actor: User, request_id: int, ip: Optional[str]) -> dict:
    """Turns an application into a real institute and admin account.

    The institute is created live so its admin can actually sign in, but with no
    subscription behind it - which is the whole gate. Seat limits resolve to
    nothing without an active plan, so until the admin picks a tier and pays,
    the portal holds them in the setup wizard and the API refuses to add anyone.

    `create_institute` sends the credentials email itself, so the applicant
    receives their temporary password as part of this call.
    """
    row = get_or_404(db, request_id)
    _require_pending(row)

    created = institute_service.create_institute(
        db,
        actor,
        row.institute_name,
        row.contact_email,
        row.admin_email,
        row.admin_first_name,
        row.admin_last_name,
        24,
        ip,
    )

    row.status = STATUS_APPROVED
    row.reviewed_by_id = actor.id
    row.reviewed_at = _now()
    row.created_institute_id = created["id"]
    db.add(row)
    _audit(
        db, actor, "institute_signup.approve", row.id, ip,
        {"institute_id": created["id"], "admin_email": row.admin_email},
    )
    db.commit()

    result = _serialize(get_or_404(db, request_id))
    # Surfaced once, for the reviewer to relay if the email never lands.
    result["admin_temp_password"] = created["admin_temp_password"]
    return result


def reject(db: Session, actor: User, request_id: int, reason: str, ip: Optional[str]) -> dict:
    """Declines an application and tells the applicant why.

    The row is kept rather than deleted: the queue is the record of who was
    turned away, and a reason on file is what makes a later appeal answerable.
    """
    row = get_or_404(db, request_id)
    _require_pending(row)

    reason = (reason or "").strip()
    if not reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Give a reason - it is sent to the applicant and kept on the record",
        )

    row.status = STATUS_REJECTED
    row.rejection_reason = reason
    row.reviewed_by_id = actor.id
    row.reviewed_at = _now()
    db.add(row)
    _audit(db, actor, "institute_signup.reject", row.id, ip, {"reason": reason})
    db.commit()

    from app.services import email_template_service

    _send(
        db,
        row.contact_email,
        email_template_service.render_institute_application_rejected_email(
            row.admin_first_name, row.institute_name, reason
        ),
    )
    return _serialize(get_or_404(db, request_id))


def mark_approved_with_institute(
    db: Session,
    actor: User,
    request_id: int,
    institute_id: int,
    ip: Optional[str] = None,
) -> None:
    """Marks an application approved when on-boarded directly via the institute creation form."""
    row = db.get(InstituteSignupRequest, request_id)
    if not row or row.status != STATUS_PENDING:
        return
    row.status = STATUS_APPROVED
    row.reviewed_by_id = actor.id
    row.reviewed_at = _now()
    row.created_institute_id = institute_id
    db.add(row)
    _audit(
        db,
        actor,
        "institute_signup.approve",
        row.id,
        ip,
        {"institute_id": institute_id, "admin_email": row.admin_email, "source": "institute_onboarding_form"},
    )
    db.commit()
