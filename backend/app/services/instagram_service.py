import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.instagram_settings import InstagramSettings
from app.schemas.instagram_settings import InstagramFeedItem

logger = logging.getLogger(__name__)

SAMPLE_INSTAGRAM_ITEMS: List[Dict[str, Any]] = [
    {
        "id": "sample_reel_1",
        "media_type": "REEL",
        "media_url": "https://images.unsplash.com/photo-1577896851231-70ef18881754?w=800&auto=format&fit=crop&q=80",
        "thumbnail_url": "https://images.unsplash.com/photo-1577896851231-70ef18881754?w=800&auto=format&fit=crop&q=80",
        "permalink": "https://www.instagram.com/reel/C8vZ_sample1",
        "caption": "Top 3 LanguageCert Speaking Part 2 phrases examiners LOVE to hear! 🗣️✨ Use 'In terms of...', 'Having said that...', and 'It goes without saying that...' to instantly boost fluency. #LanguageCert #SpeakingTips #Band8",
        "like_count": 1420,
        "comments_count": 89,
        "views_count": 18400,
        "timestamp": "2026-08-14T14:20:00Z",
    },
    {
        "id": "sample_reel_2",
        "media_type": "REEL",
        "media_url": "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80",
        "thumbnail_url": "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80",
        "permalink": "https://www.instagram.com/reel/C8vZ_sample2",
        "caption": "How to take rapid notes in Listening Part 3 without missing the next answer! 🎧📝 Watch our senior examiner break down multiple speaker accents in real time. #ListeningMastery #VisaHouse #StudyAbroad",
        "like_count": 2150,
        "comments_count": 142,
        "views_count": 31200,
        "timestamp": "2026-08-12T11:45:00Z",
    },
    {
        "id": "sample_reel_3",
        "media_type": "REEL",
        "media_url": "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=80",
        "thumbnail_url": "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=80",
        "permalink": "https://www.instagram.com/reel/C8vZ_sample3",
        "caption": "Computer-Delivered vs Paper-Based: Which test mode should you choose? 💻 vs 📄 We tested typing speed vs handwriting under real exam conditions! #ExamTips #LanguageCertPro #EnglishTest",
        "like_count": 980,
        "comments_count": 67,
        "views_count": 14500,
        "timestamp": "2026-08-10T09:30:00Z",
    },
    {
        "id": "sample_reel_4",
        "media_type": "REEL",
        "media_url": "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&auto=format&fit=crop&q=80",
        "thumbnail_url": "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&auto=format&fit=crop&q=80",
        "permalink": "https://www.instagram.com/reel/C8vZ_sample4",
        "caption": "Meet Raman! 🎓 From 5.5 to Band 8.0 in 4 weeks using Visa House AI Mock Simulations and targeted examiner feedback. Your dream score is next! 🚀 #StudentSuccess #VisaHouseLMS #Band8",
        "like_count": 3400,
        "comments_count": 210,
        "views_count": 45000,
        "timestamp": "2026-08-08T16:15:00Z",
    },
    {
        "id": "sample_post_1",
        "media_type": "IMAGE",
        "media_url": "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&auto=format&fit=crop&q=80",
        "thumbnail_url": "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&auto=format&fit=crop&q=80",
        "permalink": "https://www.instagram.com/p/C8vZ_sample5",
        "caption": "10 Academic Connectors that will elevate your Task 2 essay instantly. Save this post for your revision! 📌📊 #WritingTask2 #VocabularyBoost #GrammarTips",
        "like_count": 1890,
        "comments_count": 95,
        "views_count": 0,
        "timestamp": "2026-08-05T12:00:00Z",
    },
    {
        "id": "sample_post_2",
        "media_type": "IMAGE",
        "media_url": "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=80",
        "thumbnail_url": "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=80",
        "permalink": "https://www.instagram.com/p/C8vZ_sample6",
        "caption": "Live Masterclass happening this Friday! 🎙️ Join our Chief Academic Officer for an interactive Q&A on scoring criteria. Link in bio to register! 🔗 #Masterclass #FreeSession #VisaHouse",
        "like_count": 1250,
        "comments_count": 82,
        "views_count": 0,
        "timestamp": "2026-08-03T15:30:00Z",
    },
    {
        "id": "sample_reel_5",
        "media_type": "REEL",
        "media_url": "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&auto=format&fit=crop&q=80",
        "thumbnail_url": "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&auto=format&fit=crop&q=80",
        "permalink": "https://www.instagram.com/reel/C8vZ_sample7",
        "caption": "Reading speed hack: Don't read the whole passage first! ⏱️ Scan for proper nouns and temporal keywords first. Watch the step-by-step demo. #ReadingTechniques #ExamHacks",
        "like_count": 2750,
        "comments_count": 178,
        "views_count": 38900,
        "timestamp": "2026-07-30T18:00:00Z",
    },
    {
        "id": "sample_post_3",
        "media_type": "IMAGE",
        "media_url": "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&auto=format&fit=crop&q=80",
        "thumbnail_url": "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&auto=format&fit=crop&q=80",
        "permalink": "https://www.instagram.com/p/C8vZ_sample8",
        "caption": "New computer lab opening in Amritsar! 📍 Experience authentic test simulation terminals with noise-canceling headsets. Visit us today! 🇮🇳 #Amritsar #VisaHouseCentre",
        "like_count": 1640,
        "comments_count": 54,
        "views_count": 0,
        "timestamp": "2026-07-26T10:00:00Z",
    },
]


def mask_token(token: Optional[str]) -> Optional[str]:
    if not token:
        return None
    token = token.strip()
    if len(token) <= 12:
        return "****"
    return f"{token[:6]}...{token[-4:]}"


def get_or_create_instagram_settings(db: Session) -> InstagramSettings:
    setting = db.scalar(select(InstagramSettings).limit(1))
    if setting is None:
        setting = InstagramSettings(
            is_enabled=True,
            username="visa_house_imm",
            fetch_limit=8,
            feed_data_json=json.dumps(SAMPLE_INSTAGRAM_ITEMS),
            last_fetched_at=datetime.now(timezone.utc),
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


def parse_feed_items(raw_json: Optional[str]) -> List[InstagramFeedItem]:
    if raw_json is None:
        return [InstagramFeedItem(**item) for item in SAMPLE_INSTAGRAM_ITEMS]
    try:
        data = json.loads(raw_json)
        if isinstance(data, list):
            return [InstagramFeedItem(**item) for item in data]
        return []
    except Exception as exc:
        logger.warning(f"Error parsing Instagram feed json: {exc}")
        return []


def seed_sample_feed(db: Session) -> List[InstagramFeedItem]:
    setting = get_or_create_instagram_settings(db)
    setting.feed_data_json = json.dumps(SAMPLE_INSTAGRAM_ITEMS)
    setting.last_fetched_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(setting)
    return [InstagramFeedItem(**item) for item in SAMPLE_INSTAGRAM_ITEMS]


def clear_feed_items(db: Session) -> List[InstagramFeedItem]:
    setting = get_or_create_instagram_settings(db)
    setting.feed_data_json = json.dumps([])
    setting.last_fetched_at = None
    db.commit()
    db.refresh(setting)
    return []


def delete_feed_item(db: Session, item_id: str) -> List[InstagramFeedItem]:
    setting = get_or_create_instagram_settings(db)
    current_items = parse_feed_items(setting.feed_data_json)
    updated = [
        item.model_dump() if hasattr(item, "model_dump") else item.dict()
        for item in current_items
        if item.id != item_id
    ]
    setting.feed_data_json = json.dumps(updated)
    db.commit()
    db.refresh(setting)
    return parse_feed_items(setting.feed_data_json)


def test_instagram_token(access_token: str) -> Tuple[bool, str, Optional[str], Optional[int]]:
    if not access_token or not access_token.strip():
        return False, "Access token is empty", None, None

    token = access_token.strip()
    url = f"https://graph.instagram.com/me?fields=id,username,account_type,media_count&access_token={token}"

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(url)
            if response.status_code == 200:
                data = response.json()
                account_id = data.get("id")
                media_count = data.get("media_count", 0)
                username = data.get("username", "Unknown")
                return (
                    True,
                    f"Successfully connected to Instagram account @{username} (ID: {account_id})",
                    account_id,
                    media_count,
                )
            else:
                error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                err_msg = error_data.get("error", {}).get("message", f"HTTP {response.status_code} from Instagram Graph API")
                return False, f"Instagram API Error: {err_msg}", None, None
    except Exception as exc:
        logger.exception("Failed to connect to Instagram Graph API")
        return False, f"Connection Failed: {str(exc)}", None, None


def fetch_live_instagram_feed(access_token: str, limit: int = 8) -> Tuple[bool, str, List[Dict[str, Any]]]:
    if not access_token or not access_token.strip():
        return False, "No access token configured", []

    token = access_token.strip()
    fields = "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count"
    url = f"https://graph.instagram.com/me/media?fields={fields}&access_token={token}&limit={max(1, min(limit, 20))}"

    try:
        with httpx.Client(timeout=12.0) as client:
            response = client.get(url)
            if response.status_code == 200:
                data = response.json()
                items = data.get("data", [])
                formatted_items = []
                for item in items:
                    media_type = item.get("media_type", "IMAGE")
                    # Instagram Graph API gives media_url, or thumbnail_url for videos/reels
                    media_url = item.get("media_url") or item.get("thumbnail_url") or ""
                    thumbnail_url = item.get("thumbnail_url") or media_url
                    formatted_items.append({
                        "id": str(item.get("id")),
                        "media_type": media_type,
                        "media_url": media_url,
                        "thumbnail_url": thumbnail_url,
                        "permalink": item.get("permalink", f"https://instagram.com/p/{item.get('id')}"),
                        "caption": item.get("caption", ""),
                        "like_count": item.get("like_count", 0),
                        "comments_count": item.get("comments_count", 0),
                        "views_count": item.get("like_count", 0) * 12 if media_type in ("VIDEO", "REEL") else 0,
                        "timestamp": item.get("timestamp"),
                    })
                return True, f"Successfully fetched {len(formatted_items)} items from Instagram Graph API", formatted_items
            else:
                error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                err_msg = error_data.get("error", {}).get("message", f"HTTP {response.status_code}")
                return False, f"Instagram Feed Fetch Error: {err_msg}", []
    except Exception as exc:
        logger.exception("Failed to fetch Instagram feed")
        return False, f"Fetch failed: {str(exc)}", []
