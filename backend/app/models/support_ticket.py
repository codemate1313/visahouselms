from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


SUPPORT_STATUS_NEW = "new"
SUPPORT_STATUS_OPEN = "open"
SUPPORT_STATUS_RESOLVED = "resolved"
SUPPORT_STATUS_CLOSED = "closed"
SUPPORT_STATUSES = {
    SUPPORT_STATUS_NEW,
    SUPPORT_STATUS_OPEN,
    SUPPORT_STATUS_RESOLVED,
    SUPPORT_STATUS_CLOSED,
}

SUPPORT_PRIORITY_LOW = "low"
SUPPORT_PRIORITY_NORMAL = "normal"
SUPPORT_PRIORITY_HIGH = "high"
SUPPORT_PRIORITIES = {SUPPORT_PRIORITY_LOW, SUPPORT_PRIORITY_NORMAL, SUPPORT_PRIORITY_HIGH}

SUPPORT_QUEUE_INSTITUTE = "institute"
SUPPORT_QUEUE_SUPER_ADMIN = "super_admin"
SUPPORT_QUEUES = {SUPPORT_QUEUE_INSTITUTE, SUPPORT_QUEUE_SUPER_ADMIN}


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(40), nullable=False, default="public_contact", index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    phone_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    institute_name: Mapped[Optional[str]] = mapped_column(String(180), nullable=True, index=True)
    subject: Mapped[str] = mapped_column(String(220), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(60), nullable=False, default="general", index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=SUPPORT_STATUS_NEW, index=True)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default=SUPPORT_PRIORITY_NORMAL, index=True)
    admin_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assigned_to_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    requester_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    institute_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("institutes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    queue: Mapped[str] = mapped_column(
        String(30), nullable=False, default=SUPPORT_QUEUE_SUPER_ADMIN, index=True
    )
    escalated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    escalated_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), index=True)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=func.now(), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    assigned_to: Mapped[Optional["User"]] = relationship(foreign_keys=[assigned_to_id])  # noqa: F821
    requester: Mapped[Optional["User"]] = relationship(foreign_keys=[requester_id])  # noqa: F821
    escalated_by: Mapped[Optional["User"]] = relationship(foreign_keys=[escalated_by_id])  # noqa: F821
    messages: Mapped[list["SupportTicketMessage"]] = relationship(
        back_populates="ticket", order_by="SupportTicketMessage.created_at.asc()", cascade="all, delete-orphan"
    )


class SupportTicketMessage(Base):
    __tablename__ = "support_ticket_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(
        ForeignKey("support_tickets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    sender_name: Mapped[str] = mapped_column(String(160), nullable=False)
    sender_role: Mapped[str] = mapped_column(String(40), nullable=False, default="customer")  # "customer" | "admin" | "staff"
    message: Mapped[str] = mapped_column(Text, nullable=False)
    attachments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON-encoded list of storage-relative paths
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now(), index=True)

    ticket: Mapped["SupportTicket"] = relationship(back_populates="messages")
    sender: Mapped[Optional["User"]] = relationship()

