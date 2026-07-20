from fastapi import HTTPException, UploadFile, status

ALLOWED_IMAGE_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
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
