from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy.orm import Session, joinedload

from app.models.achievement import Badge, LeaderboardSnapshot, StudentBadge
from app.models.attempt import ATTEMPT_GRADED, TestAttempt
from app.models.user import User
from app.services.cefr_service import LEVEL_ORDER


PERIOD_ALL_TIME = "all_time"

BADGE_DEFINITIONS = (
    ("FIRST_TEST", "First Step", "Complete your first graded test.", "flag", {"graded_attempts": 1}),
    ("CEFR_B2", "Independent User", "Demonstrate CEFR B2 or higher in a graded test.", "compass", {"minimum_cefr": "B2"}),
    ("CEFR_C1", "Advanced Communicator", "Demonstrate CEFR C1 or higher in a graded test.", "spark", {"minimum_cefr": "C1"}),
    ("CEFR_C2", "Mastery", "Demonstrate CEFR C2 in a graded test.", "crown", {"minimum_cefr": "C2"}),
    ("FOUR_SKILLS", "Four Skills", "Complete assessed work in Listening, Reading, Writing, and Speaking.", "grid", {"skills": 4}),
    ("PERFECT_OBJECTIVE", "Perfect Accuracy", "Earn full marks in an auto-marked test.", "target", {"objective_percentage": 100}),
    ("TEN_TESTS", "Committed Learner", "Complete ten graded tests.", "streak", {"graded_attempts": 10}),
)


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _ensure_badges(db: Session) -> dict[str, Badge]:
    existing = {badge.code: badge for badge in db.query(Badge).all()}
    for code, name, description, icon, criteria in BADGE_DEFINITIONS:
        if code in existing:
            continue
        badge = Badge(
            code=code,
            name=name,
            description=description,
            icon=icon,
            criteria=criteria,
            is_active=True,
        )
        db.add(badge)
        existing[code] = badge
    db.flush()
    return existing


def _percentage(attempt: TestAttempt) -> Decimal:
    if attempt.raw_score is None or attempt.max_score is None or Decimal(attempt.max_score) <= 0:
        return Decimal("0")
    return (Decimal(attempt.raw_score) * Decimal("100") / Decimal(attempt.max_score)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )


def _best_level(attempts: list[TestAttempt]) -> Optional[str]:
    levels = [attempt.cefr_level for attempt in attempts if attempt.cefr_level in LEVEL_ORDER]
    return max(levels, key=lambda level: LEVEL_ORDER[level]) if levels else None


def _qualifying_badges(attempts: list[TestAttempt]) -> set[str]:
    qualified: set[str] = set()
    if attempts:
        qualified.add("FIRST_TEST")
    if len(attempts) >= 10:
        qualified.add("TEN_TESTS")

    best = _best_level(attempts)
    if best and LEVEL_ORDER[best] >= LEVEL_ORDER["B2"]:
        qualified.add("CEFR_B2")
    if best and LEVEL_ORDER[best] >= LEVEL_ORDER["C1"]:
        qualified.add("CEFR_C1")
    if best and LEVEL_ORDER[best] >= LEVEL_ORDER["C2"]:
        qualified.add("CEFR_C2")

    skills = {
        skill.get("skill")
        for attempt in attempts
        for skill in (attempt.cefr_profile or {}).get("skills", [])
        if skill.get("status") == "complete"
    }
    if {"listening", "reading", "writing", "speaking"}.issubset(skills):
        qualified.add("FOUR_SKILLS")

    if any(
        attempt.module.module_type in ("reading", "listening")
        and attempt.max_score is not None
        and Decimal(attempt.max_score) > 0
        and Decimal(attempt.raw_score or 0) == Decimal(attempt.max_score)
        for attempt in attempts
    ):
        qualified.add("PERFECT_OBJECTIVE")
    return qualified


def rebuild_institute_leaderboard(db: Session, institute_id: int) -> None:
    attempts = (
        db.query(TestAttempt)
        .join(User, TestAttempt.user_id == User.id)
        .filter(
            User.institute_id == institute_id,
            User.is_active.is_(True),
            User.deleted_at.is_(None),
            TestAttempt.status == ATTEMPT_GRADED,
            TestAttempt.max_score.is_not(None),
        )
        .all()
    )
    by_user: dict[int, list[TestAttempt]] = defaultdict(list)
    for attempt in attempts:
        if Decimal(attempt.max_score or 0) > 0:
            by_user[attempt.user_id].append(attempt)

    standings = []
    for user_id, user_attempts in by_user.items():
        average = (sum((_percentage(attempt) for attempt in user_attempts), Decimal("0")) / len(user_attempts)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        standings.append(
            {
                "user_id": user_id,
                "average": average,
                "attempts_count": len(user_attempts),
                "best_cefr_level": _best_level(user_attempts),
            }
        )
    standings.sort(key=lambda row: (-row["average"], -row["attempts_count"], row["user_id"]))

    existing = {
        row.user_id: row
        for row in db.query(LeaderboardSnapshot).filter(
            LeaderboardSnapshot.institute_id == institute_id,
            LeaderboardSnapshot.period_key == PERIOD_ALL_TIME,
        )
    }
    active_ids = set()
    previous_score = None
    rank = 0
    generated_at = _now()
    for index, standing in enumerate(standings, start=1):
        if standing["average"] != previous_score:
            rank = index
            previous_score = standing["average"]
        user_id = standing["user_id"]
        active_ids.add(user_id)
        snapshot = existing.get(user_id)
        if snapshot is None:
            snapshot = LeaderboardSnapshot(
                institute_id=institute_id,
                period_key=PERIOD_ALL_TIME,
                user_id=user_id,
            )
        snapshot.rank = rank
        snapshot.attempts_count = standing["attempts_count"]
        snapshot.average_percentage = standing["average"]
        snapshot.best_cefr_level = standing["best_cefr_level"]
        snapshot.generated_at = generated_at
        db.add(snapshot)

    for user_id, snapshot in existing.items():
        if user_id not in active_ids:
            db.delete(snapshot)
    db.flush()


def refresh_student_achievements(db: Session, user_id: int, trigger_attempt_id: Optional[int] = None) -> None:
    badges = _ensure_badges(db)
    attempts = (
        db.query(TestAttempt)
        .options(joinedload(TestAttempt.module))
        .filter(TestAttempt.user_id == user_id, TestAttempt.status == ATTEMPT_GRADED)
        .all()
    )
    qualified = _qualifying_badges(attempts)
    existing_badge_ids = {
        badge_id
        for (badge_id,) in db.query(StudentBadge.badge_id).filter(StudentBadge.user_id == user_id).all()
    }
    for code in qualified:
        badge = badges[code]
        if badge.id in existing_badge_ids:
            continue
        db.add(StudentBadge(user_id=user_id, badge_id=badge.id, attempt_id=trigger_attempt_id))

    user = db.get(User, user_id)
    if user and user.institute_id is not None:
        rebuild_institute_leaderboard(db, user.institute_id)
    db.commit()


def list_student_badges(db: Session, user: User) -> list[dict]:
    # Also backfills attempts graded before the achievement migration. The
    # award operation is idempotent because user_id + badge_id is unique.
    refresh_student_achievements(db, user.id)
    badges = _ensure_badges(db)
    awards = {
        award.badge_id: award
        for award in db.query(StudentBadge).filter(StudentBadge.user_id == user.id).all()
    }
    return [
        {
            "code": badge.code,
            "name": badge.name,
            "description": badge.description,
            "icon": badge.icon,
            "criteria": badge.criteria,
            "earned": badge.id in awards,
            "awarded_at": awards[badge.id].awarded_at if badge.id in awards else None,
            "attempt_id": awards[badge.id].attempt_id if badge.id in awards else None,
        }
        for badge in sorted(badges.values(), key=lambda item: item.id)
        if badge.is_active
    ]


def student_leaderboard(db: Session, user: User) -> dict:
    if user.institute_id is None:
        return {
            "scope": "direct_student",
            "entries": [],
            "current_student": None,
            "message": "Leaderboards are available only within an institute cohort.",
        }

    rows = (
        db.query(LeaderboardSnapshot)
        .options(joinedload(LeaderboardSnapshot.user))
        .filter(
            LeaderboardSnapshot.institute_id == user.institute_id,
            LeaderboardSnapshot.period_key == PERIOD_ALL_TIME,
        )
        .order_by(LeaderboardSnapshot.rank, LeaderboardSnapshot.user_id)
        .limit(50)
        .all()
    )
    entries = [
        {
            "rank": row.rank,
            "user_id": row.user_id,
            "display_name": f"{row.user.first_name} {row.user.last_name[:1]}.",
            "attempts_count": row.attempts_count,
            "average_percentage": str(row.average_percentage),
            "best_cefr_level": row.best_cefr_level,
            "is_current_student": row.user_id == user.id,
        }
        for row in rows
    ]
    current = next((entry for entry in entries if entry["is_current_student"]), None)
    return {
        "scope": "institute",
        "period": PERIOD_ALL_TIME,
        "entries": entries,
        "current_student": current,
        "message": None,
    }
