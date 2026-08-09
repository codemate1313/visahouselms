import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, status, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.models.role import INSTITUTE_ADMIN, SUPER_ADMIN
from app.models.support_ticket import SUPPORT_QUEUE_INSTITUTE, SUPPORT_QUEUE_SUPER_ADMIN
from app.models.user import User
from app.schemas.support import (
    InstituteSupportTicketUpdate,
    PortalSupportTicketCreate,
    PortalSupportTicketResponse,
    SupportTicketCreate,
    SupportTicketCreatedResponse,
    SupportTicketListResponse,
    SupportTicketMessageCreate,
    SupportTicketResponse,
    SupportTicketUpdate,
)
from app.services import support_service

# Allowed MIME types for support attachments
_ALLOWED_ATTACH_TYPES = {
    "image/png", "image/jpeg", "image/webp", "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
_MAX_ATTACH_BYTES = 10 * 1024 * 1024  # 10 MB per file
_MAX_FILES = 5


async def _save_support_attachments(ticket_id: int, files: List[UploadFile]) -> List[str]:
    """Save uploaded files to storage and return their storage-relative paths."""
    saved: List[str] = []
    if not files:
        return saved
    valid_files = [f for f in files if f and hasattr(f, "filename") and f.filename]
    if not valid_files:
        return saved
    attach_dir = settings.storage_path / "support_attachments" / str(ticket_id)
    attach_dir.mkdir(parents=True, exist_ok=True)
    for upload in valid_files[:_MAX_FILES]:
        content_type = (upload.content_type or "").split(";")[0].strip()
        if content_type and content_type not in _ALLOWED_ATTACH_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type '{content_type}' is not allowed. Allowed: images, PDF, Word, Excel.",
            )
        content = await upload.read()
        if not content:
            continue
        if len(content) > _MAX_ATTACH_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Each attachment must be 10 MB or smaller.",
            )
        ext = Path(upload.filename or "file").suffix or ".bin"
        filename = f"{uuid.uuid4().hex}{ext}"
        dest = attach_dir / filename
        dest.write_bytes(content)
        relative = f"support_attachments/{ticket_id}/{filename}"
        saved.append(relative)
    return saved


public_router = APIRouter(prefix="/support", tags=["support"])
admin_router = APIRouter(
    prefix="/super-admin/support-tickets",
    tags=["support-tickets"],
    dependencies=[Depends(require_role(SUPER_ADMIN))],
)
institute_router = APIRouter(
    prefix="/institute/support-tickets",
    tags=["institute-support-tickets"],
    dependencies=[Depends(require_role(INSTITUTE_ADMIN))],
)


def require_institute_id(user: User) -> int:
    if user.institute_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institute membership is required",
        )
    return user.institute_id


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


@public_router.get("/my-tickets", response_model=list[PortalSupportTicketResponse])
def list_my_tickets(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return support_service.list_portal_tickets(db, user)


@public_router.post(
    "/my-tickets",
    response_model=SupportTicketCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_my_ticket(
    payload: PortalSupportTicketCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = support_service.create_portal_ticket(
        db,
        payload,
        user,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return {
        "id": ticket.id,
        "status": ticket.status,
        "message": "Your support ticket has been created.",
    }


@public_router.post("/my-tickets/{ticket_id}/messages", response_model=SupportTicketResponse)
async def post_my_ticket_message(
    ticket_id: int,
    message: str = Form(..., min_length=1, max_length=5000),
    files: List[UploadFile] = File(default=[]),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    attachments: List[str] = []
    if files:
        attachments = await _save_support_attachments(ticket_id, [f for f in files if f and f.filename])
    ticket = support_service.add_ticket_message(
        db,
        ticket_id,
        message_text=message,
        sender=user,
        sender_role="customer",
        attachments=attachments or None,
    )
    return support_service.serialize_ticket(ticket)


@public_router.post("/my-tickets/{ticket_id}/close", response_model=SupportTicketResponse)
def close_my_ticket(
    ticket_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = support_service.close_portal_ticket(db, ticket_id, user)
    return support_service.serialize_ticket(ticket)


@public_router.post("/my-tickets/{ticket_id}/reopen", response_model=SupportTicketResponse)
def reopen_my_ticket(
    ticket_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = support_service.reopen_portal_ticket(db, ticket_id, user)
    return support_service.serialize_ticket(ticket)



@admin_router.get("", response_model=SupportTicketListResponse)
def list_admin_tickets(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    priority: Optional[str] = Query(default=None),
    source: Optional[str] = Query(default=None),
    status_group: Optional[str] = Query(default=None),
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
        source_filter=source,
        status_group=status_group,
        queue=SUPPORT_QUEUE_SUPER_ADMIN,
        page=page,
        page_size=page_size,
    )


@admin_router.get("/{ticket_id}", response_model=SupportTicketResponse)
def get_admin_ticket(ticket_id: int, db: Session = Depends(get_db)):
    return support_service.serialize_ticket(
        support_service.get_ticket(db, ticket_id, queue=SUPPORT_QUEUE_SUPER_ADMIN)
    )


@admin_router.patch("/{ticket_id}", response_model=SupportTicketResponse)
def update_admin_ticket(ticket_id: int, payload: SupportTicketUpdate, db: Session = Depends(get_db)):
    return support_service.serialize_ticket(
        support_service.update_ticket(
            db,
            ticket_id,
            payload,
            queue=SUPPORT_QUEUE_SUPER_ADMIN,
        )
    )


@admin_router.post("/{ticket_id}/messages", response_model=SupportTicketResponse)
async def post_admin_ticket_message(
    ticket_id: int,
    message: str = Form(..., min_length=1, max_length=5000),
    files: List[UploadFile] = File(default=[]),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    attachments: List[str] = []
    if files:
        attachments = await _save_support_attachments(ticket_id, [f for f in files if f and f.filename])
    ticket = support_service.add_ticket_message(
        db,
        ticket_id,
        message_text=message,
        sender=user,
        sender_role="admin",
        queue=SUPPORT_QUEUE_SUPER_ADMIN,
        attachments=attachments or None,
    )
    return support_service.serialize_ticket(ticket)


@admin_router.post("/{ticket_id}/close", response_model=SupportTicketResponse)
def close_admin_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
):
    return support_service.serialize_ticket(
        support_service.close_ticket(db, ticket_id, queue=SUPPORT_QUEUE_SUPER_ADMIN)
    )


@admin_router.post("/{ticket_id}/reopen", response_model=SupportTicketResponse)
def reopen_admin_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
):
    return support_service.serialize_ticket(
        support_service.reopen_ticket(db, ticket_id, queue=SUPPORT_QUEUE_SUPER_ADMIN)
    )


@institute_router.get("", response_model=SupportTicketListResponse)
def list_institute_tickets(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    priority: Optional[str] = Query(default=None),
    status_group: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    institute_id = require_institute_id(user)
    return support_service.list_tickets(
        db,
        status_filter=status_filter,
        priority_filter=priority,
        search=search,
        status_group=status_group,
        queue=SUPPORT_QUEUE_INSTITUTE,
        institute_id=institute_id,
        page=page,
        page_size=page_size,
    )


@institute_router.get("/{ticket_id}", response_model=SupportTicketResponse)
def get_institute_ticket(
    ticket_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    institute_id = require_institute_id(user)
    return support_service.serialize_ticket(
        support_service.get_ticket(
            db,
            ticket_id,
            queue=SUPPORT_QUEUE_INSTITUTE,
            institute_id=institute_id,
        )
    )


@institute_router.patch("/{ticket_id}", response_model=SupportTicketResponse)
def update_institute_ticket(
    ticket_id: int,
    payload: InstituteSupportTicketUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    institute_id = require_institute_id(user)
    return support_service.serialize_ticket(
        support_service.update_ticket(
            db,
            ticket_id,
            SupportTicketUpdate(**payload.model_dump(exclude_unset=True)),
            queue=SUPPORT_QUEUE_INSTITUTE,
            institute_id=institute_id,
        )
    )


@institute_router.post("/{ticket_id}/messages", response_model=SupportTicketResponse)
async def post_institute_ticket_message(
    ticket_id: int,
    message: str = Form(..., min_length=1, max_length=5000),
    files: List[UploadFile] = File(default=[]),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    institute_id = require_institute_id(user)
    attachments: List[str] = []
    if files:
        attachments = await _save_support_attachments(ticket_id, [f for f in files if f and f.filename])
    ticket = support_service.add_ticket_message(
        db,
        ticket_id,
        message_text=message,
        sender=user,
        sender_role="admin",
        queue=SUPPORT_QUEUE_INSTITUTE,
        institute_id=institute_id,
        attachments=attachments or None,
    )
    return support_service.serialize_ticket(ticket)


@institute_router.post("/{ticket_id}/close", response_model=SupportTicketResponse)
def close_institute_ticket(
    ticket_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    institute_id = require_institute_id(user)
    return support_service.serialize_ticket(
        support_service.close_ticket(db, ticket_id, queue=SUPPORT_QUEUE_INSTITUTE, institute_id=institute_id)
    )


@institute_router.post("/{ticket_id}/reopen", response_model=SupportTicketResponse)
def reopen_institute_ticket(
    ticket_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    institute_id = require_institute_id(user)
    return support_service.serialize_ticket(
        support_service.reopen_ticket(db, ticket_id, queue=SUPPORT_QUEUE_INSTITUTE, institute_id=institute_id)
    )


@institute_router.post("/{ticket_id}/forward", response_model=SupportTicketResponse)
def forward_institute_ticket(
    ticket_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return support_service.serialize_ticket(
        support_service.forward_ticket_to_super_admin(db, ticket_id, user)
    )

