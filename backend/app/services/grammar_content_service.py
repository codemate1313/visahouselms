import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.grammar_content import GrammarContent
from app.schemas.grammar_content import GrammarContentResponse


async def validate_pdf_upload(upload: UploadFile) -> tuple[str, bytes]:
    """Validate uploaded file is a valid non-empty PDF under 50MB."""
    filename = upload.filename or "grammar_content.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be a PDF document (.pdf)",
        )

    content = await upload.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded PDF file is empty",
        )
    max_bytes = 50 * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PDF file must be 50 MB or smaller",
        )
    if not content.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File content is not a valid PDF document",
        )

    return filename, content


def save_pdf_to_storage(filename: str, content: bytes) -> tuple[str, int]:
    """Save bytes to storage/grammar_contents/<uuid>_<filename> and return (relative_path, size)."""
    target_dir = settings.storage_path / "grammar_contents"
    target_dir.mkdir(parents=True, exist_ok=True)

    safe_name = Path(filename).name
    unique_filename = f"{uuid.uuid4().hex}_{safe_name}"
    full_path = target_dir / unique_filename
    full_path.write_bytes(content)

    relative_path = f"grammar_contents/{unique_filename}"
    return relative_path, len(content)


def delete_pdf_from_storage(relative_path: str) -> None:
    """Safely delete file from storage if exists."""
    if not relative_path:
        return
    try:
        full_path = settings.storage_path / relative_path
        if full_path.exists() and full_path.is_file():
            full_path.unlink()
    except Exception:
        pass


def to_response_dto(item: GrammarContent) -> GrammarContentResponse:
    file_url = f"/storage/{item.file_path}"
    return GrammarContentResponse(
        id=item.id,
        title=item.title,
        description=item.description,
        is_active=item.is_active,
        file_name=item.file_name,
        file_size=item.file_size,
        file_url=file_url,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def list_grammar_contents(db: Session, student_only: bool = False) -> List[GrammarContentResponse]:
    stmt = select(GrammarContent).order_by(GrammarContent.created_at.desc())
    if student_only:
        stmt = stmt.where(GrammarContent.is_active.is_(True))
    items = db.scalars(stmt).all()
    return [to_response_dto(item) for item in items]


def get_grammar_content_by_id(db: Session, content_id: int) -> GrammarContent:
    item = db.get(GrammarContent, content_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grammar content not found",
        )
    return item


async def create_grammar_content(
    db: Session,
    title: str,
    description: Optional[str],
    is_active: bool,
    pdf_file: UploadFile,
    created_by_id: Optional[int] = None,
) -> GrammarContentResponse:
    if not title or not title.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title is required",
        )

    filename, content = await validate_pdf_upload(pdf_file)
    rel_path, file_size = save_pdf_to_storage(filename, content)

    item = GrammarContent(
        title=title.strip(),
        description=description.strip() if description else None,
        file_path=rel_path,
        file_name=filename,
        file_size=file_size,
        is_active=is_active,
        created_by_id=created_by_id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return to_response_dto(item)


async def update_grammar_content(
    db: Session,
    content_id: int,
    title: str,
    description: Optional[str],
    is_active: bool,
    pdf_file: Optional[UploadFile] = None,
) -> GrammarContentResponse:
    item = get_grammar_content_by_id(db, content_id)

    if not title or not title.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title is required",
        )

    item.title = title.strip()
    item.description = description.strip() if description else None
    item.is_active = is_active

    if pdf_file and pdf_file.filename:
        filename, content = await validate_pdf_upload(pdf_file)
        old_path = item.file_path
        rel_path, file_size = save_pdf_to_storage(filename, content)
        item.file_path = rel_path
        item.file_name = filename
        item.file_size = file_size
        delete_pdf_from_storage(old_path)

    db.commit()
    db.refresh(item)
    return to_response_dto(item)


def toggle_grammar_content_status(db: Session, content_id: int) -> GrammarContentResponse:
    item = get_grammar_content_by_id(db, content_id)
    item.is_active = not item.is_active
    db.commit()
    db.refresh(item)
    return to_response_dto(item)


def delete_grammar_content(db: Session, content_id: int) -> None:
    item = get_grammar_content_by_id(db, content_id)
    old_path = item.file_path
    db.delete(item)
    db.commit()
    delete_pdf_from_storage(old_path)
