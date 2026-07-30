from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import require_role
from app.models.role import SUPER_ADMIN
from app.schemas.support import (
    SupportTicketCreate,
    SupportTicketCreatedResponse,
    SupportTicketListResponse,
    SupportTicketResponse,
    SupportTicketUpdate,
)
from app.services import support_service

public_router = APIRouter(prefix="/support", tags=["support"])
admin_router = APIRouter(
    prefix="/super-admin/support-tickets",
    tags=["support-tickets"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)


@public_router.post("/tickets", response_model=SupportTicketCreatedResponse, status_code=status.HTTP_201_CREATED)
def create_public_ticket(payload: SupportTicketCreate, request: Request, db: Session = Depends(get_db)):
    ticket = support_service.create_ticket(
        db,
        payload,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return {
        "id": ticket.id,
        "status": ticket.status,
        "message": "Thanks. Your enquiry has been received.",
    }


@admin_router.get("", response_model=SupportTicketListResponse)
def list_admin_tickets(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    priority: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return support_service.list_tickets(
        db,
        status_filter=status_filter,
        priority_filter=priority,
        search=search,
        page=page,
        page_size=page_size,
    )


@admin_router.get("/{ticket_id}", response_model=SupportTicketResponse)
def get_admin_ticket(ticket_id: int, db: Session = Depends(get_db)):
    return support_service.serialize_ticket(support_service.get_ticket(db, ticket_id))


@admin_router.patch("/{ticket_id}", response_model=SupportTicketResponse)
def update_admin_ticket(ticket_id: int, payload: SupportTicketUpdate, db: Session = Depends(get_db)):
    return support_service.serialize_ticket(support_service.update_ticket(db, ticket_id, payload))
