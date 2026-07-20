from fastapi import HTTPException, UploadFile, status

ALLOWED_IMAGE_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
}

COURSE_ASSET_TYPES = {
    "application/pdf": ("pdf", ".pdf"),
    "audio/mpeg": ("audio", ".mp3"),
    "audio/mp3": ("audio", ".mp3"),
}


async def read_validated_image(upload: UploadFile, max_bytes: int, label: str = "Image") -> tuple:
    """Validates content-type + size, returns (extension, content_bytes)."""
    ext = ALLOWED_IMAGE_TYPES.get(upload.content_type or "")
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label} must be a PNG, JPEG, or WebP image",
        )

    content = await upload.read()
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label} must be {max_bytes // (1024 * 1024)} MB or smaller",
        )
    return ext, content


async def read_validated_course_asset(upload: UploadFile) -> tuple[str, str, bytes]:
    """Return ``(asset_type, extension, bytes)`` for a genuine PDF or MP3.

    Content type alone is supplied by the browser and cannot be trusted, so a
    small signature check prevents renamed executables or arbitrary files from
    being served back through course storage.
    """
    declared = COURSE_ASSET_TYPES.get(upload.content_type or "")
    if declared is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Course resources must be PDF or MP3 files",
        )

    asset_type, extension = declared
    max_bytes = 25 * 1024 * 1024 if asset_type == "pdf" else 50 * 1024 * 1024
    content = await upload.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{asset_type.upper()} files must be {max_bytes // (1024 * 1024)} MB or smaller",
        )

    if asset_type == "pdf" and not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is not a valid PDF")
    if asset_type == "audio":
        has_id3 = content.startswith(b"ID3")
        has_frame_sync = len(content) >= 2 and content[0] == 0xFF and (content[1] & 0xE0) == 0xE0
        if not (has_id3 or has_frame_sync):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is not a valid MP3")

    return asset_type, extension, content


async def read_validated_mp3(upload: UploadFile) -> bytes:
    """Read a real MP3 upload for a Listening assessment part."""
    if upload.content_type not in {"audio/mpeg", "audio/mp3", "audio/x-mpeg"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Listening audio must be an MP3 file",
        )
    content = await upload.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded MP3 is empty")
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="MP3 files must be 50 MB or smaller")
    has_id3 = content.startswith(b"ID3")
    has_frame_sync = len(content) >= 2 and content[0] == 0xFF and (content[1] & 0xE0) == 0xE0
    if not (has_id3 or has_frame_sync):
        raise HTTPException(status_code=400, detail="File is not a valid MP3")
    return content
