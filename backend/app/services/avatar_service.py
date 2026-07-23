"""Live Portrait Speaking Avatar Service for IELTS LMS.

Handles examiner profile selection, TTS audio synthesis with viseme timing,
and avatar asset delivery.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from app.config import settings
from app.services import tts_service

logger = logging.getLogger("avatar_service")

# Storage directory for avatar assets & generated audio
AVATAR_STORAGE_DIR = settings.storage_path / "avatars"
AVATAR_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

# Examiner Avatar Profiles
EXAMINER_PROFILES = {
    "sonia": {
        "id": "sonia",
        "name": "Sonia Radcliffe",
        "title": "Senior IELTS Speaking Examiner",
        "gender": "female",
        "voice": "en-GB-SoniaNeural",
        "accent": "British English",
        "avatar_image": "/storage/avatars/examiner_female.svg",
    },
    "ryan": {
        "id": "ryan",
        "name": "Ryan Mitchell",
        "title": "Senior IELTS Speaking Examiner",
        "gender": "male",
        "voice": "en-GB-RyanNeural",
        "accent": "British English",
        "avatar_image": "/storage/avatars/examiner_male.svg",
    },
    "jenny": {
        "id": "jenny",
        "name": "Jenny Parker",
        "title": "IELTS Speaking Specialist",
        "gender": "female",
        "voice": "en-US-JennyNeural",
        "accent": "US English",
        "avatar_image": "/storage/avatars/examiner_female.svg",
    },
    "guy": {
        "id": "guy",
        "name": "Guy Thornton",
        "title": "IELTS Speaking Specialist",
        "gender": "male",
        "voice": "en-US-GuyNeural",
        "accent": "US English",
        "avatar_image": "/storage/avatars/examiner_male.svg",
    },
}

DEFAULT_EXAMINER_ID = "sonia"


def _generate_text_visemes(text: str, duration_sec: float) -> List[Dict[str, Any]]:
    """Generate estimated viseme timeline from text and total audio duration.
    
    Visemes map to mouth shapes:
    0: Rest (Closed)
    1: A / O (Wide Open)
    2: E / I (Smile Open)
    3: U / W (Rounded Small)
    4: M / P / B (Lips Pressed)
    5: L / N / T / D (Teeth Visible)
    """
    words = re.findall(r"\b\w+\b", text)
    if not words or duration_sec <= 0:
        return [{"time": 0.0, "viseme": 0, "duration": duration_sec}]

    visemes = []
    time_per_word = (duration_sec * 0.85) / max(len(words), 1)
    current_time = duration_sec * 0.05

    for word in words:
        word_lower = word.lower()
        # Estimate 2-3 visemes per word based on vowels/consonants
        char_idx = 0
        w_len = len(word_lower)
        v_dur = time_per_word / max(w_len, 1)

        while char_idx < w_len:
            ch = word_lower[char_idx]
            v_id = 0
            if ch in "a":
                v_id = 1
            elif ch in "eiy":
                v_id = 2
            elif ch in "ouw":
                v_id = 3
            elif ch in "mpb":
                v_id = 4
            elif ch in "lntdsz":
                v_id = 5
            else:
                v_id = 1  # Open slight

            visemes.append({
                "time": round(current_time, 3),
                "viseme": v_id,
                "word": word if char_idx == 0 else None,
            })
            current_time += v_dur
            char_idx += 1

    # End rest position
    visemes.append({"time": round(duration_sec, 3), "viseme": 0, "word": None})
    return visemes


async def get_or_create_prompt_audio(text: str, voice: str) -> tuple[str, List[Dict[str, Any]], float]:
    """Synthesize or return cached MP3 audio and visemes for a speaking text prompt."""
    clean_text = " ".join(text.strip().split())
    if not clean_text:
        clean_text = "Please answer the examiner prompt."

    text_hash = hashlib.md5(f"{clean_text}_{voice}".encode("utf-8")).hexdigest()
    audio_filename = f"prompt_{text_hash}.mp3"
    meta_filename = f"prompt_{text_hash}.json"

    audio_path = AVATAR_STORAGE_DIR / audio_filename
    meta_path = AVATAR_STORAGE_DIR / meta_filename

    audio_url = f"/storage/avatars/{audio_filename}"

    if audio_path.exists() and meta_path.exists():
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
            return audio_url, meta.get("visemes", []), meta.get("duration", 3.0)
        except Exception:
            pass

    # Synthesize audio using edge-tts via tts_service
    mp3_bytes = await tts_service.synthesize_mp3(clean_text, voice=voice)
    with open(audio_path, "wb") as f:
        f.write(mp3_bytes)

    # Estimate audio duration based on MP3 size (~32kbps / 4000 bytes/sec)
    approx_duration = max(len(mp3_bytes) / 4000.0, 1.5)
    visemes = _generate_text_visemes(clean_text, approx_duration)

    meta_content = {
        "text": clean_text,
        "voice": voice,
        "duration": round(approx_duration, 2),
        "visemes": visemes,
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta_content, f)

    return audio_url, visemes, approx_duration


def list_examiners() -> List[Dict[str, Any]]:
    return list(EXAMINER_PROFILES.values())


def get_examiner(examiner_id: Optional[str] = None) -> Dict[str, Any]:
    if not examiner_id or examiner_id not in EXAMINER_PROFILES:
        return EXAMINER_PROFILES[DEFAULT_EXAMINER_ID]
    return EXAMINER_PROFILES[examiner_id]
