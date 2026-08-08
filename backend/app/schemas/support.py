from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class SupportTicketCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    email: EmailStr
    phone_number: Optional[str] = Field(default=None, max_length=50)
    institute_name: Optional[str] = Field(default=None, max_length=180)
    subject: str = Field(min_length=3, max_length=220)
    message: str = Field(min_length=10, max_length=5000)
    category: str = Field(default="general", max_length=60)


class PortalSupportTicketCreate(BaseModel):
    subject: str = Field(min_length=3, max_length=220)
    message: str = Field(min_length=10, max_length=5000)
    category: str = Field(default="general", max_length=60)


class SupportTicketUpdate(BaseModel):
    status: Optional[str] = Field(default=None, max_length=20)
    priority: Optional[str] = Field(default=None, max_length=20)
    admin_note: Optional[str] = Field(default=None, max_length=5000)
    assigned_to_id: Optional[int] = None


class InstituteSupportTicketUpdate(BaseModel):
    status: Optional[str] = Field(default=None, max_length=20)
    priority: Optional[str] = Field(default=None, max_length=20)
    admin_note: Optional[str] = Field(default=None, max_length=5000)


class SupportTicketResponse(BaseModel):
    id: int
    source: str
    name: str
    email: str
    phone_number: Optional[str] = None
    institute_name: Optional[str] = None
    subject: str
    message: str
    category: str
    status: str
    priority: str
    admin_note: Optional[str] = None
    assigned_to_id: Optional[int] = None
    assigned_to_name: Optional[str] = None
    assigned_to_email: Optional[str] = None
    requester_id: Optional[int] = None
    institute_id: Optional[int] = None
    queue: str
    escalated_at: Optional[datetime] = None
    escalated_by_id: Optional[int] = None
    escalated_by_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None


class SupportTicketListResponse(BaseModel):
    items: list[SupportTicketResponse]
    total: int
    page: int
    page_size: int
    counts: dict[str, int]


class SupportTicketCreatedResponse(BaseModel):
    id: int
    status: str
    message: str


class PortalSupportTicketResponse(BaseModel):
    id: int
    subject: str
    message: str
    category: str
    status: str
    priority: str
    admin_note: Optional[str] = None
    queue: str
    escalated_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
