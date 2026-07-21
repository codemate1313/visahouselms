"""Avatar video generation interface (roadmap 3.3 - Speaking avatar).

`DIdAvatarProvider` is the only implementation - it calls D-ID's Talking
Photo API (https://docs.d-id.com/reference/create-a-talk) to turn a
presenter image + spoken script into a short MP4 of the presenter reading
the script. It is inert (raises `AvatarNotConfigured`) until a Super Admin
pastes a real D-ID API key and presenter image URL into Developer Settings,
mirroring how SMTP/FCM/payment-gateway credentials already work in this
codebase. Nothing else in the codebase changes if a different vendor
(HeyGen, Synthesia, ...) is swapped in later - only this file would change."""

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass

import httpx

D_ID_BASE_URL = "https://api.d-id.com"
POLL_INTERVAL_SECONDS = 3
MAX_POLL_SECONDS = 180


class AvatarNotConfigured(RuntimeError):
    """Raised when no avatar vendor credentials are stored yet."""


class AvatarGenerationError(RuntimeError):
    """Raised when the vendor call fails or times out."""


@dataclass(frozen=True)
class AvatarClip:
    content: bytes
    mime_type: str = "video/mp4"


class AvatarProvider(ABC):
    @abstractmethod
    def generate(self, script_text: str) -> AvatarClip:
        """Returns the rendered MP4 bytes for a presenter reading script_text."""
        raise NotImplementedError

    @abstractmethod
    def verify_credentials(self) -> bool:
        """Cheap call to confirm the stored API key/presenter image are valid."""
        raise NotImplementedError


class DIdAvatarProvider(AvatarProvider):
    def __init__(self, api_key: str, presenter_image_url: str, voice_id: str = "en-GB-SoniaNeural"):
        if not api_key or not presenter_image_url:
            raise AvatarNotConfigured("D-ID API key and presenter image are required")
        self._api_key = api_key
        self._presenter_image_url = presenter_image_url
        self._voice_id = voice_id

    def _client(self) -> httpx.Client:
        return httpx.Client(
            base_url=D_ID_BASE_URL,
            headers={"Authorization": f"Basic {self._api_key}"},
            timeout=30,
        )

    def generate(self, script_text: str) -> AvatarClip:
        with self._client() as client:
            create = client.post(
                "/talks",
                json={
                    "source_url": self._presenter_image_url,
                    "script": {
                        "type": "text",
                        "input": script_text,
                        "provider": {"type": "microsoft", "voice_id": self._voice_id},
                    },
                    "config": {"fluent": True, "pad_audio": 0.0},
                },
            )
            if create.status_code >= 400:
                raise AvatarGenerationError(f"D-ID rejected the talk request: {create.status_code} {create.text[:300]}")
            talk_id = create.json().get("id")
            if not talk_id:
                raise AvatarGenerationError("D-ID did not return a talk id")

            deadline = time.monotonic() + MAX_POLL_SECONDS
            while time.monotonic() < deadline:
                poll = client.get(f"/talks/{talk_id}")
                poll.raise_for_status()
                body = poll.json()
                status = body.get("status")
                if status == "done":
                    result_url = body.get("result_url")
                    if not result_url:
                        raise AvatarGenerationError("D-ID marked the talk done but returned no result_url")
                    video = client.get(result_url)
                    video.raise_for_status()
                    return AvatarClip(content=video.content)
                if status == "error":
                    raise AvatarGenerationError(f"D-ID failed to render the talk: {body.get('error')}")
                time.sleep(POLL_INTERVAL_SECONDS)
            raise AvatarGenerationError("Timed out waiting for D-ID to render the talk")

    def verify_credentials(self) -> bool:
        with self._client() as client:
            response = client.get("/credits")
            return response.status_code < 400


def get_provider(api_key: str, presenter_image_url: str, voice_id: str = "en-GB-SoniaNeural") -> AvatarProvider:
    return DIdAvatarProvider(api_key=api_key, presenter_image_url=presenter_image_url, voice_id=voice_id)
