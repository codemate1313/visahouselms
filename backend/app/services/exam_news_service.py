"""Curated exam & immigration updates shown on the student News page.

The feed is intentionally a curated, code-reviewed list rather than a live
scrape: entries are evergreen facts about which English tests each destination
accepts, so they stay correct without a background fetcher. Edit this list (or
replace it with a DB table + admin CRUD later) to publish new items — the
endpoint and the News page will pick them up unchanged.
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


def list_exam_news() -> List[dict]:
    """Newest first, so the News page and its sidebar agree on ordering."""
    return sorted(EXAM_NEWS, key=lambda item: item["published_at"], reverse=True)
