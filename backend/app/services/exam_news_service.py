"""Curated exam & immigration updates shown on the student News page.

The feed is dynamically populated from a Google News search RSS feed, cached for
1 hour, and merged with a set of high-quality evergreen curated posts to ensure
a rich, up-to-date daily updates feed.
"""

import xml.etree.ElementTree as ET
import urllib.request
import re
import html
import time
from datetime import datetime
from typing import List

EXAM_NEWS: List[dict] = [
    {
        "id": 1,
        "country": "Canada",
        "flag": "🇨🇦",
        "category": "immigration",
        "title": "Canada: IELTS General and PTE Core accepted for Express Entry",
        "summary": (
            "IRCC accepts IELTS General Training, CELPIP and PTE Core for Express Entry "
            "economic immigration. CLB 9 (IELTS 8/7/7/7) earns maximum language points."
        ),
        "published_at": "2026-06-18",
        "source_name": "IRCC — Express Entry language requirements",
        "source_url": "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-requirements.html",
        "tests": ["IELTS", "PTE Core", "CELPIP"],
    },
    {
        "id": 2,
        "country": "Australia",
        "flag": "🇦🇺",
        "category": "immigration",
        "title": "Australia: skilled visas accept IELTS, PTE Academic and TOEFL iBT",
        "summary": (
            "Skilled migration points: Competent English (IELTS 6.0) is the entry bar, "
            "Proficient (7.0) adds 10 points and Superior (8.0) adds 20 points."
        ),
        "published_at": "2026-05-27",
        "source_name": "Department of Home Affairs — English language requirements",
        "source_url": "https://immi.homeaffairs.gov.au/help-support/meeting-our-requirements/english-language",
        "tests": ["IELTS", "PTE Academic", "TOEFL iBT"],
    },
    {
        "id": 3,
        "country": "United Kingdom",
        "flag": "🇬🇧",
        "category": "visa",
        "title": "UK: visas require a SELT — IELTS for UKVI or LanguageCert",
        "summary": (
            "UK study and work visas require a Secure English Language Test taken at an "
            "approved centre. IELTS for UKVI, LanguageCert SELT and PTE Academic UKVI qualify."
        ),
        "published_at": "2026-07-02",
        "source_name": "GOV.UK — Approved secure English language tests",
        "source_url": "https://www.gov.uk/guidance/prove-your-english-language-abilities-with-a-secure-english-language-test-selt",
        "tests": ["IELTS for UKVI", "LanguageCert SELT", "PTE Academic UKVI"],
    },
    {
        "id": 4,
        "country": "New Zealand",
        "flag": "🇳🇿",
        "category": "immigration",
        "title": "New Zealand: Skilled Migrant Category needs IELTS 6.5 overall",
        "summary": (
            "The Skilled Migrant Category requires IELTS 6.5 overall (or PTE Academic 58, "
            "TOEFL iBT 79). Student visas follow the enrolling institution's requirement."
        ),
        "published_at": "2026-04-15",
        "source_name": "Immigration New Zealand — English language requirements",
        "source_url": "https://www.immigration.govt.nz/new-zealand-visas/preparing-a-visa-application/english-language",
        "tests": ["IELTS", "PTE Academic", "TOEFL iBT"],
    },
    {
        "id": 5,
        "country": "United States",
        "flag": "🇺🇸",
        "category": "study",
        "title": "USA: universities accept IELTS, TOEFL and Duolingo English Test",
        "summary": (
            "Most US universities accept IELTS Academic (typically 6.5–7.0 for admission) "
            "alongside TOEFL iBT; many now also accept the Duolingo English Test."
        ),
        "published_at": "2026-06-05",
        "source_name": "IELTS — Recognising organisations (USA)",
        "source_url": "https://ielts.org/organisations/ielts-for-organisations",
        "tests": ["IELTS Academic", "TOEFL iBT", "Duolingo English Test"],
    },
    {
        "id": 6,
        "country": "Germany",
        "flag": "🇩🇪",
        "category": "study",
        "title": "Germany: English-taught programmes ask for IELTS 6.0–6.5",
        "summary": (
            "English-medium degrees at German universities commonly require IELTS 6.0–6.5 "
            "or equivalent TOEFL scores; the Opportunity Card values language proficiency."
        ),
        "published_at": "2026-03-21",
        "source_name": "DAAD — Language requirements for study in Germany",
        "source_url": "https://www.daad.de/en/study-and-research-in-germany/plan-your-studies/language-requirements/",
        "tests": ["IELTS", "TOEFL iBT"],
    },
    {
        "id": 7,
        "country": "Ireland",
        "flag": "🇮🇪",
        "category": "study",
        "title": "Ireland: study visas require IELTS 5.0+, degrees usually 6.0–6.5",
        "summary": (
            "Irish study visas require a minimum IELTS 5.0 for non-degree courses; "
            "university admission typically asks 6.0–6.5. PTE Academic is widely accepted."
        ),
        "published_at": "2026-05-09",
        "source_name": "Irish Immigration Service — English language requirements",
        "source_url": "https://www.irishimmigration.ie/coming-to-study-in-ireland/",
        "tests": ["IELTS", "PTE Academic"],
    },
    {
        "id": 8,
        "country": "General",
        "flag": "🌍",
        "category": "exam",
        "title": "One Skill Retake: PTE and IELTS now let you resit a single skill",
        "summary": (
            "IELTS One Skill Retake lets you redo one section instead of the full exam; "
            "check whether your destination institution accepts OSR results."
        ),
        "published_at": "2026-07-21",
        "source_name": "IELTS — One Skill Retake",
        "source_url": "https://ielts.org/take-a-test/test-types/ielts-one-skill-retake",
        "tests": ["IELTS", "PTE Academic"],
    },
]

# Simple 1-hour cache for the final news feed
_NEWS_CACHE = None
_NEWS_CACHE_TIME = 0
_CACHE_DURATION = 3600  # 1 hour


def fetch_real_time_news() -> List[dict]:
    """Fetch recent exam & immigration news from Google News RSS feed."""
    url = "https://news.google.com/rss/search?q=IELTS+OR+PTE+OR+TOEFL+OR+immigration&hl=en-US&gl=US&ceid=US:en"
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            xml_data = response.read()

        root = ET.fromstring(xml_data)
        items = []
        for i, item in enumerate(root.findall(".//item")[:20]):
            title_raw = item.find("title").text or ""
            link = item.find("link").text or ""
            pub_date_raw = item.find("pubDate").text or ""
            description = item.find("description").text or ""

            # Extract source name
            source_elem = item.find("source")
            source_name = source_elem.text if source_elem is not None else ""

            title = title_raw
            if " - " in title_raw:
                parts = title_raw.rsplit(" - ", 1)
                title = parts[0]
                if not source_name:
                    source_name = parts[1]

            published_at = ""
            try:
                date_str = pub_date_raw
                if "," in date_str:
                    date_str = date_str.split(",", 1)[1].strip()
                dt = datetime.strptime(" ".join(date_str.split()[:4]), "%d %b %Y %H:%M:%S")
                published_at = dt.strftime("%Y-%m-%d")
            except Exception:
                published_at = datetime.utcnow().strftime("%Y-%m-%d")

            summary = re.sub("<[^<]+?>", "", description).strip()
            summary = html.unescape(summary).replace("\xa0", " ")
            summary = re.sub(r"\s+", " ", summary).strip()
            if not summary or len(summary) < 5:
                summary = f"Latest updates on English test requirements and immigration changes from {source_name}."

            country = "General"
            flag = "🌍"
            title_lower = title.lower()
            summary_lower = summary.lower()

            countries = [
                ("Canada", "🇨🇦", ["canada", "ircc", "express entry", "celpip"]),
                ("Australia", "🇦🇺", ["australia", "skilled visa", "home affairs"]),
                ("United Kingdom", "🇬🇧", ["uk", "united kingdom", "selt", "gov.uk", "london"]),
                ("United States", "🇺🇸", ["usa", "united states", "america", "toefl"]),
                ("New Zealand", "🇳🇿", ["new zealand", "nz"]),
                ("Germany", "🇩🇪", ["germany", "german", "daad"]),
                ("Ireland", "🇮🇪", ["ireland", "irish"]),
            ]
            for c_name, c_flag, keywords in countries:
                if any(k in title_lower or k in summary_lower for k in keywords):
                    country = c_name
                    flag = c_flag
                    break

            category = "exam"
            if any(k in title_lower or k in summary_lower for k in ["visa", "student visa", "study visa"]):
                category = "visa"
            elif any(
                k in title_lower or k in summary_lower
                for k in ["immigration", "pr ", "permanent resid", "express entry", "points", "migrate"]
            ):
                category = "immigration"
            elif any(k in title_lower or k in summary_lower for k in ["university", "college", "admission", "study", "student"]):
                category = "study"

            tests = []
            if "ielts" in title_lower or "ielts" in summary_lower:
                tests.append("IELTS")
            if "pte" in title_lower or "pte" in summary_lower:
                tests.append("PTE")
            if "toefl" in title_lower or "toefl" in summary_lower:
                tests.append("TOEFL")
            if "celpip" in title_lower or "celpip" in summary_lower:
                tests.append("CELPIP")
            if not tests:
                tests = ["IELTS", "PTE"]

            items.append(
                {
                    "id": 1000 + i,
                    "country": country,
                    "flag": flag,
                    "category": category,
                    "title": title,
                    "summary": summary,
                    "published_at": published_at,
                    "source_name": source_name or "News",
                    "source_url": link,
                    "tests": tests,
                }
            )
        return items
    except Exception:
        # Silently fail and return empty list on network or parse issues to allow curated fallback
        return []


import threading

_NEWS_LOCK = threading.Lock()
_UPDATE_THREAD_ACTIVE = False
_TESTING = False

def _bg_update_news():
    global _NEWS_CACHE, _NEWS_CACHE_TIME, _UPDATE_THREAD_ACTIVE
    try:
        real_time = fetch_real_time_news()
        if real_time:
            seen = {item["title"].lower().strip() for item in real_time}
            merged = list(real_time)
            for curated in EXAM_NEWS:
                if curated["title"].lower().strip() not in seen:
                    merged.append(curated)
            sorted_news = sorted(merged, key=lambda item: item["published_at"], reverse=True)
            with _NEWS_LOCK:
                _NEWS_CACHE = sorted_news
                _NEWS_CACHE_TIME = time.time()
    except Exception:
        pass
    finally:
        with _NEWS_LOCK:
            _UPDATE_THREAD_ACTIVE = False


def list_exam_news() -> List[dict]:
    """Merged feed (real time + curated) sorted newest first, updated asynchronously in background."""
    global _NEWS_CACHE, _NEWS_CACHE_TIME, _UPDATE_THREAD_ACTIVE, _TESTING
    now = time.time()

    if _TESTING:
        # Run synchronously for unit tests
        real_time = fetch_real_time_news()
        seen = {item["title"].lower().strip() for item in real_time}
        merged = list(real_time)
        for curated in EXAM_NEWS:
            if curated["title"].lower().strip() not in seen:
                merged.append(curated)
        _NEWS_CACHE = sorted(merged, key=lambda item: item["published_at"], reverse=True)
        _NEWS_CACHE_TIME = now
        return _NEWS_CACHE

    # 1. If cache is completely empty, initialize it synchronously to ensure the user gets fresh news on first load
    if _NEWS_CACHE is None:
        try:
            real_time = fetch_real_time_news()
            if real_time:
                seen = {item["title"].lower().strip() for item in real_time}
                merged = list(real_time)
                for curated in EXAM_NEWS:
                    if curated["title"].lower().strip() not in seen:
                        merged.append(curated)
                _NEWS_CACHE = sorted(merged, key=lambda item: item["published_at"], reverse=True)
                _NEWS_CACHE_TIME = now
        except Exception:
            pass

        # Fallback to curated if fetch failed
        if _NEWS_CACHE is None:
            with _NEWS_LOCK:
                _NEWS_CACHE = sorted(EXAM_NEWS, key=lambda item: item["published_at"], reverse=True)
                _NEWS_CACHE_TIME = 0  # Retry background refresh again next time

    # 2. Check if cache needs updating and update thread is not already running
    if (now - _NEWS_CACHE_TIME) > _CACHE_DURATION:
        should_start_thread = False
        with _NEWS_LOCK:
            if not _UPDATE_THREAD_ACTIVE:
                _UPDATE_THREAD_ACTIVE = True
                should_start_thread = True

        if should_start_thread:
            t = threading.Thread(target=_bg_update_news, daemon=True)
            t.start()

    # 3. Return whatever is in cache
    with _NEWS_LOCK:
        return list(_NEWS_CACHE)


def clear_news_cache() -> None:
    """Clear memory cache (primarily for unit tests)."""
    global _NEWS_CACHE, _NEWS_CACHE_TIME, _UPDATE_THREAD_ACTIVE
    with _NEWS_LOCK:
        _NEWS_CACHE = None
        _NEWS_CACHE_TIME = 0
        _UPDATE_THREAD_ACTIVE = False
