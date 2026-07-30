from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.support_ticket import (
    SUPPORT_PRIORITIES,
    SUPPORT_PRIORITY_NORMAL,
    SUPPORT_STATUS_CLOSED,
    SUPPORT_STATUS_NEW,
    SUPPORT_STATUS_RESOLVED,
    SUPPORT_STATUSES,
    SupportTicket,
)
from app.models.user import User
from app.schemas.support import SupportTicketCreate, SupportTicketUpdate


def serialize_ticket(ticket: SupportTicket) -> dict:
    assigned_to = ticket.assigned_to
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
        "created_at": ticket.created_at,
        "updated_at": ticket.updated_at,
        "resolved_at": ticket.resolved_at,
    }


def create_ticket(
    db: Session,
    payload: SupportTicketCreate,
    *,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> SupportTicket:
    ticket = SupportTicket(
        source="public_contact",
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
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


def list_tickets(
    db: Session,
    *,
    status_filter: Optional[str] = None,
    priority_filter: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
) -> dict:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    stmt = select(SupportTicket)

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
    count_rows = db.execute(
        select(SupportTicket.status, func.count(SupportTicket.id)).group_by(SupportTicket.status)
    ).all()
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


def get_ticket(db: Session, ticket_id: int) -> SupportTicket:
    ticket = db.get(SupportTicket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Support ticket not found")
    return ticket


def update_ticket(db: Session, ticket_id: int, payload: SupportTicketUpdate) -> SupportTicket:
    ticket = get_ticket(db, ticket_id)
    data = payload.model_dump(exclude_unset=True)

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
    return ticket
