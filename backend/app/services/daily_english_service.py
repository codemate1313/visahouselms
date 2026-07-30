import random
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.daily_english import DailyEnglishChallenge
from app.models.user import User


CHALLENGE_SIZE = 5
ACTIVITY_DAYS = 84
CHALLENGE_TIMEZONE = ZoneInfo("Asia/Kolkata")

QUESTION_POOL = (
    {"id": "grammar-01", "category": "Grammar", "prompt": "Choose the correct sentence.", "options": ["She don't like coffee.", "She doesn't likes coffee.", "She doesn't like coffee.", "She not like coffee."], "correct": 2, "explanation": "After 'doesn't', use the base form of the verb."},
    {"id": "grammar-02", "category": "Grammar", "prompt": "Complete the sentence: If I ___ more time, I would learn Spanish.", "options": ["have", "had", "will have", "am having"], "correct": 1, "explanation": "The second conditional uses the past simple in the if-clause."},
    {"id": "grammar-03", "category": "Grammar", "prompt": "Which word completes the sentence? The report ___ by Friday.", "options": ["will finish", "will be finished", "is finishing", "has finish"], "correct": 1, "explanation": "The future passive is formed with 'will be' plus the past participle."},
    {"id": "grammar-04", "category": "Grammar", "prompt": "Choose the correct article: She is ___ honest person.", "options": ["a", "an", "the", "no article"], "correct": 1, "explanation": "'Honest' begins with a vowel sound, so it takes 'an'."},
    {"id": "grammar-05", "category": "Grammar", "prompt": "Complete the sentence: Neither the teacher nor the students ___ ready.", "options": ["was", "is", "are", "be"], "correct": 2, "explanation": "With 'neither...nor', the verb agrees with the nearer subject, 'students'."},
    {"id": "vocab-01", "category": "Vocabulary", "prompt": "What is the closest meaning of 'concise'?", "options": ["Confusing", "Brief and clear", "Very detailed", "Uncertain"], "correct": 1, "explanation": "Concise language expresses an idea clearly in few words."},
    {"id": "vocab-02", "category": "Vocabulary", "prompt": "Choose the best word: The new evidence may ___ the original conclusion.", "options": ["contradict", "decorate", "postpone", "translate"], "correct": 0, "explanation": "To contradict is to conflict with or show the opposite of a claim."},
    {"id": "vocab-03", "category": "Vocabulary", "prompt": "Which word is an antonym of 'scarce'?", "options": ["Rare", "Limited", "Abundant", "Costly"], "correct": 2, "explanation": "Scarce means insufficient; abundant means plentiful."},
    {"id": "vocab-04", "category": "Vocabulary", "prompt": "Choose the correct collocation.", "options": ["do a decision", "make a decision", "build a decision", "perform a decision"], "correct": 1, "explanation": "In English, we say 'make a decision'."},
    {"id": "usage-01", "category": "Usage", "prompt": "Choose the correct preposition: She is responsible ___ training the team.", "options": ["at", "for", "on", "with"], "correct": 1, "explanation": "'Responsible' is followed by 'for'."},
    {"id": "usage-02", "category": "Usage", "prompt": "Which sentence uses 'affect' correctly?", "options": ["The weather may affect our plans.", "The affect was immediate.", "It had a good affect.", "The result will effect my mood."], "correct": 0, "explanation": "'Affect' is usually a verb meaning to influence."},
    {"id": "usage-03", "category": "Usage", "prompt": "Complete the sentence: I look forward to ___ from you.", "options": ["hear", "hearing", "heard", "be hearing"], "correct": 1, "explanation": "'Look forward to' is followed by a noun or gerund."},
    {"id": "reading-01", "category": "Reading", "prompt": "Maya left early because the roads were flooding. Why did Maya leave early?", "options": ["She was tired.", "She wanted to avoid dangerous roads.", "She finished all her work.", "She missed the bus."], "correct": 1, "explanation": "Flooding made the roads potentially dangerous, so she left before conditions worsened."},
    {"id": "reading-02", "category": "Reading", "prompt": "The library extended its hours during exams. What can be inferred?", "options": ["The library had fewer books.", "Students needed more study time.", "Exams were cancelled.", "Staff wanted shorter shifts."], "correct": 1, "explanation": "Longer opening hours during exams support increased student study needs."},
    {"id": "punctuation-01", "category": "Punctuation", "prompt": "Choose the correctly punctuated sentence.", "options": ["However we decided to continue.", "However, we decided to continue.", "However we, decided to continue.", "However; we decided, to continue."], "correct": 1, "explanation": "An introductory conjunctive adverb is followed by a comma."},
)
QUESTIONS_BY_ID = {item["id"]: item for item in QUESTION_POOL}


def _today() -> date:
    return datetime.now(timezone.utc).astimezone(CHALLENGE_TIMEZONE).date()


def _selected_keys(challenge_date: date) -> list[str]:
    generator = random.Random(challenge_date.toordinal())
    return [item["id"] for item in generator.sample(list(QUESTION_POOL), CHALLENGE_SIZE)]


def _get_or_create(db: Session, user_id: int, challenge_date: date) -> DailyEnglishChallenge:
    challenge = db.query(DailyEnglishChallenge).filter_by(
        user_id=user_id, challenge_date=challenge_date
    ).first()
    if challenge is None:
        challenge = DailyEnglishChallenge(
            user_id=user_id,
            challenge_date=challenge_date,
            question_keys=_selected_keys(challenge_date),
            answers={},
            score=0,
        )
        db.add(challenge)
        db.commit()
        db.refresh(challenge)
    return challenge


def _streaks(db: Session, user_id: int, today: date) -> tuple[int, int]:
    completed = {
        row[0]
        for row in db.query(DailyEnglishChallenge.challenge_date).filter(
            DailyEnglishChallenge.user_id == user_id,
            DailyEnglishChallenge.completed_at.is_not(None),
        )
    }
    cursor = today if today in completed else today - timedelta(days=1)
    current = 0
    while cursor in completed:
        current += 1
        cursor -= timedelta(days=1)

    longest = 0
    run = 0
    previous: Optional[date] = None
    for completed_date in sorted(completed):
        run = run + 1 if previous and completed_date == previous + timedelta(days=1) else 1
        longest = max(longest, run)
        previous = completed_date
    return current, longest


def _serialize(db: Session, challenge: DailyEnglishChallenge) -> dict:
    answers = challenge.answers or {}
    questions = []
    for key in challenge.question_keys:
        item = QUESTIONS_BY_ID[key]
        selected = answers.get(key)
        answered = selected is not None
        questions.append({
            "id": key,
            "category": item["category"],
            "prompt": item["prompt"],
            "options": item["options"],
            "selected_answer": selected,
            "is_correct": selected == item["correct"] if answered else None,
            "correct_answer": item["correct"] if answered else None,
            "explanation": item["explanation"] if answered else None,
        })
    current, longest = _streaks(db, challenge.user_id, challenge.challenge_date)
    start = challenge.challenge_date - timedelta(days=ACTIVITY_DAYS - 1)
    history = {
        row.challenge_date: row
        for row in db.query(DailyEnglishChallenge).filter(
            DailyEnglishChallenge.user_id == challenge.user_id,
            DailyEnglishChallenge.challenge_date >= start,
            DailyEnglishChallenge.challenge_date <= challenge.challenge_date,
        )
    }
    activity = []
    for offset in range(ACTIVITY_DAYS):
        day = start + timedelta(days=offset)
        row = history.get(day)
        activity.append({
            "date": day.isoformat(),
            "completed": bool(row and row.completed_at),
            "answered_count": len((row.answers or {})) if row else 0,
            "score": row.score if row else 0,
        })
    return {
        "date": challenge.challenge_date.isoformat(),
        "questions": questions,
        "answered_count": len(answers),
        "total_questions": CHALLENGE_SIZE,
        "score": challenge.score,
        "completed": challenge.completed_at is not None,
        "completed_at": challenge.completed_at,
        "current_streak": current,
        "longest_streak": longest,
        "activity": activity,
        "timezone": str(CHALLENGE_TIMEZONE),
    }


def get_daily_challenge(db: Session, user: User, *, today: Optional[date] = None) -> dict:
    challenge = _get_or_create(db, user.id, today or _today())
    return _serialize(db, challenge)


def answer_daily_question(
    db: Session,
    user: User,
    question_id: str,
    answer_index: int,
    *,
    today: Optional[date] = None,
) -> dict:
    challenge = _get_or_create(db, user.id, today or _today())
    if question_id not in challenge.question_keys:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Daily question not found")
    answers = dict(challenge.answers or {})
    if question_id in answers:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This question has already been answered")
    question = QUESTIONS_BY_ID[question_id]
    if answer_index >= len(question["options"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid answer option")
    answers[question_id] = answer_index
    challenge.answers = answers
    challenge.score = sum(
        1 for key, selected in answers.items() if QUESTIONS_BY_ID[key]["correct"] == selected
    )
    if len(answers) == CHALLENGE_SIZE:
        challenge.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    return _serialize(db, challenge)
