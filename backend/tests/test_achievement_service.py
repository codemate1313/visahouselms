import unittest
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.models import Base, ExamModule, Institute, Role, TestAttempt, User
from app.models.attempt import ATTEMPT_GRADED
from app.models.role import STUDENT
from app.services import achievement_service


class AchievementServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        role = Role(name=STUDENT)
        institute = Institute(name="Progress Institute", slug="progress-institute")
        self.db.add_all([role, institute])
        self.db.flush()
        self.first = User(
            email="first@example.com",
            password_hash=hash_password("Password!123"),
            role_id=role.id,
            institute_id=institute.id,
            first_name="First",
            last_name="Student",
            is_active=True,
        )
        self.second = User(
            email="second@example.com",
            password_hash=hash_password("Password!123"),
            role_id=role.id,
            institute_id=institute.id,
            first_name="Second",
            last_name="Learner",
            is_active=True,
        )
        self.db.add_all([self.first, self.second])
        self.db.flush()
        self.module = ExamModule(
            module_type="reading",
            title="Reading Progress",
            description=None,
            instructions=None,
            status="published",
            duration_minutes=50,
            source_module_ids=[],
            created_by_id=self.first.id,
        )
        self.db.add(self.module)
        self.db.flush()
        self.institute_id = institute.id
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _attempt(self, user: User, score: str, level: str) -> TestAttempt:
        now = datetime.utcnow()
        attempt = TestAttempt(
            user_id=user.id,
            module_id=self.module.id,
            status=ATTEMPT_GRADED,
            is_final=False,
            started_at=now - timedelta(minutes=20),
            expires_at=now + timedelta(minutes=30),
            submitted_at=now,
            graded_at=now,
            raw_score=Decimal(score),
            max_score=Decimal("100"),
            cefr_level=level,
            band_label=level,
            cefr_policy_version="test-policy",
            cefr_profile={
                "status": "complete",
                "skills": [{"skill": "reading", "status": "complete", "level": level}],
            },
        )
        self.db.add(attempt)
        self.db.commit()
        return attempt

    def test_badges_are_idempotent_and_leaderboard_is_institute_scoped(self):
        first_attempt = self._attempt(self.first, "80", "C1")
        second_attempt = self._attempt(self.second, "90", "C2")

        achievement_service.refresh_student_achievements(self.db, self.first.id, first_attempt.id)
        achievement_service.refresh_student_achievements(self.db, self.first.id, first_attempt.id)
        achievement_service.refresh_student_achievements(self.db, self.second.id, second_attempt.id)

        first_badges = achievement_service.list_student_badges(self.db, self.first)
        earned_codes = {badge["code"] for badge in first_badges if badge["earned"]}
        self.assertEqual(earned_codes, {"FIRST_TEST", "CEFR_B2", "CEFR_C1"})

        leaderboard = achievement_service.student_leaderboard(self.db, self.first)
        self.assertEqual([entry["user_id"] for entry in leaderboard["entries"]], [self.second.id, self.first.id])
        self.assertEqual(leaderboard["current_student"]["rank"], 2)
        self.assertEqual(leaderboard["entries"][0]["display_name"], "Second L.")
        self.assertNotIn("email", leaderboard["entries"][0])


if __name__ == "__main__":
    unittest.main()
