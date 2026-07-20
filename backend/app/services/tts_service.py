from collections.abc import AsyncIterator

from fastapi import HTTPException


TTS_VOICES = [
    {"id": "en-GB-SoniaNeural", "label": "Sonia — British English (female)"},
    {"id": "en-GB-RyanNeural", "label": "Ryan — British English (male)"},
    {"id": "en-US-JennyNeural", "label": "Jenny — US English (female)"},
    {"id": "en-US-GuyNeural", "label": "Guy — US English (male)"},
    {"id": "en-AU-NatashaNeural", "label": "Natasha — Australian English (female)"},
    {"id": "en-AU-WilliamNeural", "label": "William — Australian English (male)"},
]
VOICE_IDS = {voice["id"] for voice in TTS_VOICES}


async def _audio_stream(text: str, voice: str, rate: str) -> AsyncIterator[bytes]:
    try:
        import edge_tts
    except ImportError as exc:  # pragma: no cover - deployment configuration guard
        raise HTTPException(
            status_code=503,
            detail="Text-to-speech is not installed on the backend. Install the backend requirements and restart it.",
        ) from exc

    communicator = edge_tts.Communicate(text=text, voice=voice, rate=rate)
    async for chunk in communicator.stream():
        if chunk.get("type") == "audio" and chunk.get("data"):
            yield chunk["data"]


async def synthesize_mp3(text: str, voice: str, rate: str = "+0%") -> bytes:
    if voice not in VOICE_IDS:
        raise HTTPException(status_code=400, detail="Choose one of the supported English voices")
    try:
        content = b"".join([chunk async for chunk in _audio_stream(text, voice, rate)])
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="The text-to-speech provider could not generate audio. Check the backend internet connection and try again.",
        ) from exc
    if not content:
        raise HTTPException(status_code=502, detail="The text-to-speech provider returned no audio")
    return content
