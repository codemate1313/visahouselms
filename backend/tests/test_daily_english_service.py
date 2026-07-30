import unittest
from datetime import date, timedelta

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.models import Base
from app.models.role import STUDENT, Role
from app.models.user import User
from app.services import daily_english_service


class DailyEnglishServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        role = Role(name=STUDENT)
        self.db.add(role)
        self.db.flush()
        self.student = User(
            email="daily@example.com",
            password_hash=hash_password("StudentPassword!1"),
            role_id=role.id,
            first_name="Daily",
            last_name="Learner",
            is_active=True,
        )
        self.db.add(self.student)
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_daily_challenge_has_five_stable_questions_without_answer_leakage(self) -> None:
        today = date(2026, 7, 30)
        first = daily_english_service.get_daily_challenge(self.db, self.student, today=today)
        second = daily_english_service.get_daily_challenge(self.db, self.student, today=today)

        self.assertEqual(len(first["questions"]), 5)
        self.assertEqual(
            [item["id"] for item in first["questions"]],
            [item["id"] for item in second["questions"]],
        )
        self.assertTrue(all(item["correct_answer"] is None for item in first["questions"]))
        self.assertTrue(all(item["explanation"] is None for item in first["questions"]))

    def test_answer_is_locked_and_returns_feedback(self) -> None:
        today = date(2026, 7, 30)
        challenge = daily_english_service.get_daily_challenge(self.db, self.student, today=today)
        question = challenge["questions"][0]
        answered = daily_english_service.answer_daily_question(
            self.db, self.student, question["id"], 0, today=today
        )
        result = next(item for item in answered["questions"] if item["id"] == question["id"])

        self.assertIsNotNone(result["correct_answer"])
        self.assertIsNotNone(result["explanation"])
        with self.assertRaises(HTTPException) as context:
            daily_english_service.answer_daily_question(
                self.db, self.student, question["id"], 1, today=today
            )
        self.assertEqual(context.exception.status_code, 409)

    def test_completing_all_questions_advances_streak_regardless_of_score(self) -> None:
        first_day = date(2026, 7, 29)
        second_day = first_day + timedelta(days=1)
        for challenge_day in (first_day, second_day):
            challenge = daily_english_service.get_daily_challenge(
                self.db, self.student, today=challenge_day
            )
            for question in challenge["questions"]:
                result = daily_english_service.answer_daily_question(
                    self.db, self.student, question["id"], 0, today=challenge_day
                )

        self.assertTrue(result["completed"])
        self.assertEqual(result["answered_count"], 5)
        self.assertEqual(result["current_streak"], 2)
        self.assertEqual(result["longest_streak"], 2)

    def test_current_streak_survives_today_until_the_day_is_missed(self) -> None:
        completed_day = date(2026, 7, 28)
        challenge = daily_english_service.get_daily_challenge(
            self.db, self.student, today=completed_day
        )
        for question in challenge["questions"]:
            daily_english_service.answer_daily_question(
                self.db, self.student, question["id"], 0, today=completed_day
            )

        next_day = daily_english_service.get_daily_challenge(
            self.db, self.student, today=completed_day + timedelta(days=1)
        )
        missed_day = daily_english_service.get_daily_challenge(
            self.db, self.student, today=completed_day + timedelta(days=2)
        )

        self.assertEqual(next_day["current_streak"], 1)
        self.assertEqual(missed_day["current_streak"], 0)


if __name__ == "__main__":
    unittest.main()
