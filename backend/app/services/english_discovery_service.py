import logging
import random
import re
import threading
import time
from typing import Optional
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException, status


WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php"
POOL_TTL_SECONDS = 15 * 60
REQUEST_TIMEOUT_SECONDS = 8.0
DISCOVERY_TITLES = (
    "English language",
    "History of English",
    "Old English",
    "Middle English",
    "Early Modern English",
    "Great Vowel Shift",
    "English phonology",
    "English orthography",
    "English grammar",
    "English verbs",
    "English articles",
    "English plurals",
    "English vocabulary",
    "English-language idioms",
    "English-language spelling reform",
    "British English",
    "American English",
    "Australian English",
    "Canadian English",
    "Indian English",
    "Received Pronunciation",
    "General American English",
    "English alphabet",
    "English punctuation",
    "Oxford English Dictionary",
    "A Dictionary of the English Language",
    "International Phonetic Alphabet",
    "Loanword",
    "Homophone",
    "Synonym",
    "Metaphor",
    "Alliteration",
)

_logger = logging.getLogger(__name__)
_pool: list[dict] = []
_pool_expires_at = 0.0
_pool_lock = threading.Lock()


def _clean_extract(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _is_expected_url(value: str, host: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme == "https" and parsed.hostname == host


def _fetch_pool_from_wikipedia() -> list[dict]:
    params = {
        "action": "query",
        "format": "json",
        "formatversion": 2,
        "titles": "|".join(DISCOVERY_TITLES),
        "prop": "extracts|pageimages|info|pageprops",
        "exintro": 1,
        "explaintext": 1,
        "exsentences": 3,
        "piprop": "thumbnail",
        "pithumbsize": 720,
        "inprop": "url",
    }
    headers = {
        "User-Agent": "VisaHouseLMS/1.0 (English learning dashboard; local educational application)",
    }
    with httpx.Client(
        timeout=REQUEST_TIMEOUT_SECONDS,
        follow_redirects=True,
        headers=headers,
    ) as client:
        response = client.get(WIKIPEDIA_API_URL, params=params)
        response.raise_for_status()
        pages = response.json().get("query", {}).get("pages", [])

    facts = []
    for page in pages:
        extract = _clean_extract(page.get("extract", ""))
        thumbnail = page.get("thumbnail", {})
        image_url = thumbnail.get("source")
        source_url = page.get("fullurl")
        if (
            page.get("pageid")
            and len(extract) >= 120
            and image_url
            and source_url
            and _is_expected_url(image_url, "upload.wikimedia.org")
            and _is_expected_url(source_url, "en.wikipedia.org")
            and "disambiguation" not in page.get("pageprops", {})
        ):
            facts.append({
                "page_id": page["pageid"],
                "title": page["title"],
                "fact": extract,
                "image_url": image_url,
                "source_url": source_url,
                "source_name": "Wikipedia",
            })
    random.shuffle(facts)
    return facts


def get_random_english_fact(excluded_page_ids: Optional[set[int]] = None) -> dict:
    global _pool, _pool_expires_at

    excluded = excluded_page_ids or set()
    with _pool_lock:
        now = time.monotonic()
        available = [fact for fact in _pool if fact["page_id"] not in excluded]
        if now >= _pool_expires_at or not available:
            try:
                refreshed = _fetch_pool_from_wikipedia()
            except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
                _logger.warning("Unable to load English discovery content: %s", exc)
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="English discovery content is temporarily unavailable",
                ) from exc
            if refreshed:
                _pool = refreshed
                _pool_expires_at = now + POOL_TTL_SECONDS
            available = [fact for fact in _pool if fact["page_id"] not in excluded]

        if not available:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="No English discovery content is currently available",
            )
        return random.choice(available).copy()


def clear_fact_cache() -> None:
    global _pool, _pool_expires_at
    with _pool_lock:
        _pool = []
        _pool_expires_at = 0.0
