from io import BytesIO

from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps, UnidentifiedImageError

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


async def read_compressed_profile_image(
    upload: UploadFile,
    label: str = "Avatar",
    max_dimension: int = 1600,
    quality: int = 82,
) -> tuple[str, bytes]:
    """Validate and normalize a profile image into a compact, metadata-free WebP."""
    if (upload.content_type or "") not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label} must be a PNG, JPEG, or WebP image",
        )

    await upload.seek(0)
    try:
        with Image.open(upload.file) as source:
            source.seek(0)
            image = ImageOps.exif_transpose(source)
            image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

            has_alpha = image.mode in {"RGBA", "LA"} or (
                image.mode == "P" and "transparency" in image.info
            )
            image = image.convert("RGBA" if has_alpha else "RGB")

            output = BytesIO()
            image.save(output, format="WEBP", quality=quality, method=6)
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label} is not a valid or supported image",
        ) from None

    content = output.getvalue()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label} could not be processed",
        )
    return ".webp", content


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


SPEAKING_ANSWER_AUDIO_TYPES = {
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
}


async def read_validated_speaking_answer(upload: UploadFile) -> tuple[bytes, str]:
    """Read a browser-recorded (MediaRecorder) Speaking response.

    Browser MediaRecorder uses several possible containers, so validate each
    supported type against its own container signature."""
    content_type = upload.content_type or ""
    if content_type not in SPEAKING_ANSWER_AUDIO_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Speaking answers must be an audio recording")
    content = await upload.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded recording is empty")
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Recordings must be 25 MB or smaller")
    signatures = {
        "audio/webm": content.startswith(b"\x1a\x45\xdf\xa3"),
        "audio/ogg": content.startswith(b"OggS"),
        "audio/mp4": len(content) >= 12 and content[4:8] == b"ftyp",
        "audio/mpeg": content.startswith(b"ID3")
        or (len(content) >= 2 and content[0] == 0xFF and (content[1] & 0xE0) == 0xE0),
        "audio/mp3": content.startswith(b"ID3")
        or (len(content) >= 2 and content[0] == 0xFF and (content[1] & 0xE0) == 0xE0),
        "audio/wav": len(content) >= 12 and content.startswith(b"RIFF") and content[8:12] == b"WAVE",
        "audio/x-wav": len(content) >= 12 and content.startswith(b"RIFF") and content[8:12] == b"WAVE",
    }
    if not signatures[content_type]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recording content does not match its declared audio format",
        )
    extension = {
        "audio/webm": ".webm",
        "audio/ogg": ".ogg",
        "audio/mp4": ".m4a",
        "audio/mpeg": ".mp3",
        "audio/mp3": ".mp3",
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
    }[content_type]
    return content, extension
