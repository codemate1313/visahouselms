"""Curated exam & immigration updates shown on the student dashboard.

The feed is intentionally a curated, code-reviewed list rather than a live
scrape: entries are evergreen facts about which English tests each destination
accepts, so they stay correct without a background fetcher. Edit this list (or
replace it with a DB table + admin CRUD later) to publish new items — the
endpoint and the dashboard panel will pick them up unchanged.
"""

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
        "tests": ["IELTS", "PTE Academic"],
    },
]


def list_exam_news() -> List[dict]:
    return EXAM_NEWS
