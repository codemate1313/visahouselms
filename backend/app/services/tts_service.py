import asyncio
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass

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
VOICE_NAMES = {voice["id"]: voice["label"].split(" —", 1)[0] for voice in TTS_VOICES}
MAX_CONVERSATION_TURNS = 120
_SPEAKER_LINE = re.compile(
    r"^\s*\[?(?P<speaker>[A-Za-z][A-Za-z0-9 ._'-]{0,39})\]?\s*:\s*(?P<text>.+?)\s*$"
)


@dataclass(frozen=True)
class ConversationTurn:
    speaker: str
    speaker_key: str
    text: str


def _append_turn(
    turns: list[ConversationTurn], speaker: str, text: str
) -> None:
    clean_speaker = " ".join(speaker.split())
    clean_text = " ".join(text.split())
    if not clean_text:
        return
    speaker_key = clean_speaker.casefold()
    if turns and turns[-1].speaker_key == speaker_key:
        previous = turns[-1]
        turns[-1] = ConversationTurn(
            speaker=previous.speaker,
            speaker_key=previous.speaker_key,
            text=f"{previous.text} {clean_text}",
        )
        return
    turns.append(
        ConversationTurn(
            speaker=clean_speaker,
            speaker_key=speaker_key,
            text=clean_text,
        )
    )


def parse_conversation(text: str) -> list[ConversationTurn]:
    """Parse `Speaker: words` lines while treating wrapped lines as continuation."""
    conversation = text.strip()
    if not conversation:
        raise HTTPException(status_code=400, detail="Enter a conversation to generate audio")

    turns: list[ConversationTurn] = []
    detected_label = False
    for raw_line in conversation.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        match = _SPEAKER_LINE.match(line)
        if match:
            detected_label = True
            _append_turn(turns, match.group("speaker"), match.group("text"))
        elif turns:
            previous = turns[-1]
            turns[-1] = ConversationTurn(
                speaker=previous.speaker,
                speaker_key=previous.speaker_key,
                text=f"{previous.text} {' '.join(line.split())}",
            )
        else:
            _append_turn(turns, "Narrator", line)

    # Plain text is a single-speaker narration. This also avoids interpreting
    # colons inside ordinary paragraphs as multiple people unless a line starts
    # with a valid speaker label.
    if not detected_label:
        return [
            ConversationTurn(
                speaker="Narrator",
                speaker_key="narrator",
                text=" ".join(conversation.split()),
            )
        ]
    if len(turns) > MAX_CONVERSATION_TURNS:
        raise HTTPException(
            status_code=400,
            detail=f"A conversation can contain at most {MAX_CONVERSATION_TURNS} speaker turns",
        )
    return turns


def assign_voices(
    turns: list[ConversationTurn], preferred_voice: str = "en-GB-SoniaNeural"
) -> list[dict[str, str]]:
    if preferred_voice not in VOICE_IDS:
        raise HTTPException(status_code=400, detail="Choose one of the supported English voices")

    speakers: list[tuple[str, str]] = []
    seen: set[str] = set()
    for turn in turns:
        if turn.speaker_key not in seen:
            seen.add(turn.speaker_key)
            speakers.append((turn.speaker_key, turn.speaker))
    if len(speakers) > len(TTS_VOICES):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Detected {len(speakers)} speakers, but automatic generation currently supports "
                f"up to {len(TTS_VOICES)} distinct speakers"
            ),
        )

    ordered_voice_ids = [preferred_voice] + [
        voice["id"] for voice in TTS_VOICES if voice["id"] != preferred_voice
    ]
    return [
        {
            "speaker_key": speaker_key,
            "speaker": speaker,
            "voice": ordered_voice_ids[index],
            "voice_name": VOICE_NAMES[ordered_voice_ids[index]],
        }
        for index, (speaker_key, speaker) in enumerate(speakers)
    ]


def voice_assignment_summary(assignments: list[dict[str, str]]) -> str:
    detail = ", ".join(
        f"{assignment['speaker']}={assignment['voice_name']}"
        for assignment in assignments
    )
    summary = f"Automatic ({len(assignments)}): {detail}"
    if len(summary) <= 120:
        return summary
    return f"Automatic multi-speaker audio ({len(assignments)} speakers)"


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


async def _synthesize_segment(text: str, voice: str, rate: str) -> bytes:
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


async def synthesize_mp3(text: str, voice: str, rate: str = "+0%") -> bytes:
    if voice not in VOICE_IDS:
        raise HTTPException(status_code=400, detail="Choose one of the supported English voices")
    return await _synthesize_segment(text, voice, rate)


async def synthesize_conversation_mp3(
    text: str,
    rate: str = "+0%",
    preferred_voice: str = "en-GB-SoniaNeural",
) -> tuple[bytes, list[dict[str, str]]]:
    turns = parse_conversation(text)
    assignments = assign_voices(turns, preferred_voice)
    voice_by_speaker = {
        assignment["speaker_key"]: assignment["voice"]
        for assignment in assignments
    }

    # All voices use Edge's same mono MP3 output format, so their MPEG frame
    # streams can be concatenated in turn order without transcoding or ffmpeg.
    semaphore = asyncio.Semaphore(4)

    async def render(turn: ConversationTurn) -> bytes:
        async with semaphore:
            return await _synthesize_segment(
                turn.text, voice_by_speaker[turn.speaker_key], rate
            )

    segments = await asyncio.gather(*(render(turn) for turn in turns))
    content = b"".join(segments)
    if not content:
        raise HTTPException(status_code=502, detail="The text-to-speech provider returned no audio")
    return content, assignments
