import logging
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.support_ticket import (
    SUPPORT_PRIORITIES,
    SUPPORT_PRIORITY_NORMAL,
    SUPPORT_QUEUE_INSTITUTE,
    SUPPORT_QUEUE_SUPER_ADMIN,
    SUPPORT_QUEUES,
    SUPPORT_STATUS_CLOSED,
    SUPPORT_STATUS_NEW,
    SUPPORT_STATUS_OPEN,
    SUPPORT_STATUS_RESOLVED,
    SUPPORT_STATUSES,
    SupportTicket,
)
from app.models.notification import SUPPORT_TICKET_ASSIGNED, SUPPORT_TICKET_CREATED, SUPPORT_TICKET_UPDATED
from app.models.role import INST_INSTRUCTOR, INSTITUTE_ADMIN, STUDENT, SUPER_ADMIN, Role
from app.models.user import User
from app.schemas.support import PortalSupportTicketCreate, SupportTicketCreate, SupportTicketUpdate
from app.services import notification_service

logger = logging.getLogger(__name__)


def serialize_ticket(ticket: SupportTicket) -> dict:
    assigned_to = ticket.assigned_to
    escalated_by = ticket.escalated_by
    return {
        "id": ticket.id,
        "source": ticket.source,
        "name": ticket.name,
        "email": ticket.email,
        "phone_number": ticket.phone_number,
        "institute_name": ticket.institute_name,
        "subject": ticket.subject,
        "message": ticket.message,
        "category": ticket.category,
        "status": ticket.status,
        "priority": ticket.priority,
        "admin_note": ticket.admin_note,
        "assigned_to_id": ticket.assigned_to_id,
        "assigned_to_name": f"{assigned_to.first_name} {assigned_to.last_name}" if assigned_to else None,
        "assigned_to_email": assigned_to.email if assigned_to else None,
        "requester_id": ticket.requester_id,
        "institute_id": ticket.institute_id,
        "queue": ticket.queue,
        "escalated_at": ticket.escalated_at,
        "escalated_by_id": ticket.escalated_by_id,
        "escalated_by_name": (
            f"{escalated_by.first_name} {escalated_by.last_name}" if escalated_by else None
        ),
        "created_at": ticket.created_at,
        "updated_at": ticket.updated_at,
        "resolved_at": ticket.resolved_at,
    }


def _staff_for_queue(db: Session, queue: str, institute_id: Optional[int]) -> list[User]:
    query = db.query(User).join(User.role).filter(User.deleted_at.is_(None), User.is_active.is_(True))
    if queue == SUPPORT_QUEUE_INSTITUTE and institute_id is not None:
        query = query.filter(Role.name == INSTITUTE_ADMIN, User.institute_id == institute_id)
    else:
        query = query.filter(Role.name == SUPER_ADMIN)
    return query.all()


def _ticket_link(queue: str) -> str:
    if queue == SUPPORT_QUEUE_INSTITUTE:
        return "/institute-portal/support-tickets"
    return "/super-admin/support-tickets"


def _notify_ticket_created(db: Session, ticket: SupportTicket) -> None:
    """Best-effort: alert the owning queue's staff of a new ticket, and confirm
    receipt to whoever submitted it. Never raises - a failure here must not
    block ticket creation."""
    link = _ticket_link(ticket.queue)
    for staff in _staff_for_queue(db, ticket.queue, ticket.institute_id):
        notification_service.create_notification(
            db,
            user_id=staff.id,
            kind=SUPPORT_TICKET_CREATED,
            title=f"New support ticket: {ticket.subject}",
            message=f"{ticket.name} ({ticket.email}) submitted a {ticket.priority}-priority ticket.",
            link_url=link,
        )
        notification_service.send_notification_email(
            db,
            staff.email,
            f"New support ticket: {ticket.subject}",
            f"{ticket.name} ({ticket.email}) submitted a new support ticket:\n\n{ticket.message}",
            user_id=staff.id,
        )
    notification_service.send_notification_email(
        db,
        ticket.email,
        "We've received your support request",
        (
            f"Hi {ticket.name},\n\n"
            f'Thanks for reaching out about "{ticket.subject}". Our team will get back to you shortly.'
        ),
        user_id=ticket.requester_id,
    )


def _notify_ticket_updated(db: Session, ticket: SupportTicket, *, status_changed: bool, note_changed: bool) -> None:
    """Best-effort: tell the requester their ticket moved - status changed
    and/or support left a reply. No-ops if neither happened this update."""
    if not (status_changed or note_changed):
        return
    if status_changed and note_changed:
        summary = f'Status changed to "{ticket.status}" and support added a reply.'
    elif status_changed:
        summary = f'Status changed to "{ticket.status}".'
    else:
        summary = "Support added a reply to your ticket."

    if ticket.requester_id is not None:
        notification_service.create_notification(
            db,
            user_id=ticket.requester_id,
            kind=SUPPORT_TICKET_UPDATED,
            title=f'Update on "{ticket.subject}"',
            message=summary,
        )

    body_lines = [f"Hi {ticket.name},", "", f'Your support ticket "{ticket.subject}" was updated:', summary]
    if note_changed and ticket.admin_note:
        body_lines += ["", f"Note from support: {ticket.admin_note}"]
    notification_service.send_notification_email(
        db,
        ticket.email,
        f"Update on your support ticket: {ticket.subject}",
        "\n".join(body_lines),
        user_id=ticket.requester_id,
    )


def _notify_ticket_assigned(db: Session, ticket: SupportTicket, previous_assignee_id: Optional[int]) -> None:
    if ticket.assigned_to_id is None or ticket.assigned_to_id == previous_assignee_id:
        return
    assignee = ticket.assigned_to or db.get(User, ticket.assigned_to_id)
    if assignee is None:
        return
    notification_service.create_notification(
        db,
        user_id=assignee.id,
        kind=SUPPORT_TICKET_ASSIGNED,
        title=f"Support ticket assigned: {ticket.subject}",
        message=f"{ticket.name} ({ticket.email}) is waiting for a response.",
        link_url=_ticket_link(ticket.queue),
    )
    notification_service.send_notification_email(
        db,
        assignee.email,
        f"Support ticket assigned: {ticket.subject}",
        f"You have been assigned this support ticket:\n\n{ticket.message}",
        user_id=assignee.id,
    )


def create_ticket(
    db: Session,
    payload: SupportTicketCreate,
    *,
    ip_address: Optional[str] = None,
    source: str = "public_contact",
    user_agent: Optional[str] = None,
    requester_id: Optional[int] = None,
    institute_id: Optional[int] = None,
    queue: str = SUPPORT_QUEUE_SUPER_ADMIN,
) -> SupportTicket:
    if queue not in SUPPORT_QUEUES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid support ticket queue")
    ticket = SupportTicket(
        source=source,
        name=payload.name.strip(),
        email=str(payload.email).strip().lower(),
        phone_number=payload.phone_number.strip() if payload.phone_number else None,
        institute_name=payload.institute_name.strip() if payload.institute_name else None,
        subject=payload.subject.strip(),
        message=payload.message.strip(),
        category=(payload.category or "general").strip().lower() or "general",
        status=SUPPORT_STATUS_NEW,
        priority=SUPPORT_PRIORITY_NORMAL,
        ip_address=ip_address,
        user_agent=user_agent[:255] if user_agent else None,
        requester_id=requester_id,
        institute_id=institute_id,
        queue=queue,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    try:
        _notify_ticket_created(db, ticket)
    except Exception:
        logger.exception("Failed to send notifications for new support ticket %s", ticket.id)
    return ticket


def create_portal_ticket(
    db: Session,
    payload: PortalSupportTicketCreate,
    user: User,
    *,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> SupportTicket:
    role_name = user.role_name or "user"
    institute_queue = role_name in {STUDENT, INST_INSTRUCTOR} and user.institute_id is not None
    return create_ticket(
        db,
        SupportTicketCreate(
            name=f"{user.first_name} {user.last_name}".strip() or user.email,
            email=user.email,
            phone_number=user.phone_number,
            institute_name=user.institute.name if user.institute else None,
            subject=payload.subject,
            message=payload.message,
            category=payload.category,
        ),
        ip_address=ip_address,
        source=f"portal_{role_name.lower()}",
        user_agent=user_agent,
        requester_id=user.id,
        institute_id=user.institute_id,
        queue=SUPPORT_QUEUE_INSTITUTE if institute_queue else SUPPORT_QUEUE_SUPER_ADMIN,
    )


def list_portal_tickets(db: Session, user: User) -> list[dict]:
    tickets = db.scalars(
        select(SupportTicket)
        .where(
            SupportTicket.source.like("portal_%"),
            or_(
                SupportTicket.requester_id == user.id,
                (
                    (SupportTicket.requester_id.is_(None))
                    & (func.lower(SupportTicket.email) == user.email.strip().lower())
                ),
            ),
        )
        .order_by(SupportTicket.created_at.desc(), SupportTicket.id.desc())
    ).all()
    return [
        {
            "id": ticket.id,
            "subject": ticket.subject,
            "message": ticket.message,
            "category": ticket.category,
            "status": ticket.status,
            "priority": ticket.priority,
            "queue": ticket.queue,
            "escalated_at": ticket.escalated_at,
            "created_at": ticket.created_at,
            "updated_at": ticket.updated_at,
            "resolved_at": ticket.resolved_at,
        }
        for ticket in tickets
    ]


def list_tickets(
    db: Session,
    *,
    status_filter: Optional[str] = None,
    priority_filter: Optional[str] = None,
    search: Optional[str] = None,
    source_filter: Optional[str] = None,
    status_group: Optional[str] = None,
    queue: str = SUPPORT_QUEUE_SUPER_ADMIN,
    institute_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 25,
) -> dict:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    if queue not in SUPPORT_QUEUES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid support ticket queue")
    stmt = select(SupportTicket).where(SupportTicket.queue == queue)
    count_stmt = select(SupportTicket.status, func.count(SupportTicket.id)).where(
        SupportTicket.queue == queue
    )
    if institute_id is not None:
        stmt = stmt.where(SupportTicket.institute_id == institute_id)
        count_stmt = count_stmt.where(SupportTicket.institute_id == institute_id)

    if source_filter == "customer":
        stmt = stmt.where(SupportTicket.source == "public_contact")
        count_stmt = count_stmt.where(SupportTicket.source == "public_contact")
    elif source_filter == "portal":
        stmt = stmt.where(SupportTicket.source.like("portal_%"))
        count_stmt = count_stmt.where(SupportTicket.source.like("portal_%"))
    elif source_filter:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid support ticket source")

    if status_group == "active":
        stmt = stmt.where(SupportTicket.status.in_({SUPPORT_STATUS_NEW, SUPPORT_STATUS_OPEN}))
    elif status_group == "resolved":
        stmt = stmt.where(SupportTicket.status.in_({SUPPORT_STATUS_RESOLVED, SUPPORT_STATUS_CLOSED}))
    elif status_group:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid support ticket status group")

    if status_filter:
        if status_filter not in SUPPORT_STATUSES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid support ticket status")
        stmt = stmt.where(SupportTicket.status == status_filter)
    if priority_filter:
        if priority_filter not in SUPPORT_PRIORITIES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid support ticket priority")
        stmt = stmt.where(SupportTicket.priority == priority_filter)
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                SupportTicket.name.ilike(pattern),
                SupportTicket.email.ilike(pattern),
                SupportTicket.institute_name.ilike(pattern),
                SupportTicket.subject.ilike(pattern),
                SupportTicket.message.ilike(pattern),
            )
        )

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.order_by(SupportTicket.created_at.desc(), SupportTicket.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    count_rows = db.execute(count_stmt.group_by(SupportTicket.status)).all()
    counts = {item: 0 for item in SUPPORT_STATUSES}
    counts.update({row[0]: int(row[1]) for row in count_rows})
    counts["all"] = sum(counts.values())

    return {
        "items": [serialize_ticket(ticket) for ticket in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "counts": counts,
    }


def get_ticket(
    db: Session,
    ticket_id: int,
    *,
    queue: Optional[str] = None,
    institute_id: Optional[int] = None,
) -> SupportTicket:
    ticket = db.get(SupportTicket, ticket_id)
    if (
        not ticket
        or (queue is not None and ticket.queue != queue)
        or (institute_id is not None and ticket.institute_id != institute_id)
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Support ticket not found")
    return ticket


def update_ticket(
    db: Session,
    ticket_id: int,
    payload: SupportTicketUpdate,
    *,
    queue: Optional[str] = None,
    institute_id: Optional[int] = None,
) -> SupportTicket:
    ticket = get_ticket(db, ticket_id, queue=queue, institute_id=institute_id)
    data = payload.model_dump(exclude_unset=True)
    previous_status = ticket.status
    previous_admin_note = ticket.admin_note
    previous_assignee_id = ticket.assigned_to_id

    if "status" in data and data["status"] is not None:
        if data["status"] not in SUPPORT_STATUSES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid support ticket status")
        ticket.status = data["status"]
        ticket.resolved_at = datetime.utcnow() if ticket.status in {SUPPORT_STATUS_RESOLVED, SUPPORT_STATUS_CLOSED} else None
    if "priority" in data and data["priority"] is not None:
        if data["priority"] not in SUPPORT_PRIORITIES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid support ticket priority")
        ticket.priority = data["priority"]
    if "admin_note" in data:
        ticket.admin_note = data["admin_note"]
    if "assigned_to_id" in data:
        if data["assigned_to_id"] is not None and not db.get(User, data["assigned_to_id"]):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assigned user not found")
        ticket.assigned_to_id = data["assigned_to_id"]

    db.commit()
    db.refresh(ticket)
    try:
        _notify_ticket_updated(
            db,
            ticket,
            status_changed=ticket.status != previous_status,
            note_changed=bool(ticket.admin_note) and ticket.admin_note != previous_admin_note,
        )
        _notify_ticket_assigned(db, ticket, previous_assignee_id)
    except Exception:
        logger.exception("Failed to send notifications for updated support ticket %s", ticket.id)
    return ticket


def forward_ticket_to_super_admin(
    db: Session,
    ticket_id: int,
    institute_admin: User,
) -> SupportTicket:
    if institute_admin.institute_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institute membership is required",
        )
    ticket = get_ticket(
        db,
        ticket_id,
        queue=SUPPORT_QUEUE_INSTITUTE,
        institute_id=institute_admin.institute_id,
    )
    ticket.queue = SUPPORT_QUEUE_SUPER_ADMIN
    ticket.escalated_at = datetime.utcnow()
    ticket.escalated_by_id = institute_admin.id
    if ticket.status == SUPPORT_STATUS_NEW:
        ticket.status = SUPPORT_STATUS_OPEN
    db.commit()
    db.refresh(ticket)
    try:
        for staff in _staff_for_queue(db, SUPPORT_QUEUE_SUPER_ADMIN, None):
            notification_service.create_notification(
                db,
                user_id=staff.id,
                kind=SUPPORT_TICKET_CREATED,
                title=f"Ticket escalated: {ticket.subject}",
                message=(
                    f"{institute_admin.first_name} {institute_admin.last_name} escalated a "
                    f"{ticket.priority}-priority ticket from {ticket.institute_name or 'an institute'}."
                ),
                link_url=_ticket_link(SUPPORT_QUEUE_SUPER_ADMIN),
            )
            notification_service.send_notification_email(
                db,
                staff.email,
                f"Ticket escalated: {ticket.subject}",
                f"{institute_admin.first_name} {institute_admin.last_name} escalated this ticket to you:\n\n{ticket.message}",
                user_id=staff.id,
            )
    except Exception:
        logger.exception("Failed to send notifications for escalated support ticket %s", ticket.id)
    return ticket
