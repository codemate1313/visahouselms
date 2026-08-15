import tempfile, unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.core.security import hash_password
from app.models import Base, ExamModuleQuestion
from app.models.attempt import CourseModule
from app.models.course import COURSE_PUBLISHED, Course
from app.models.role import SA_INSTRUCTOR, STUDENT, Role
from app.models.user import User
from app.services import attempt_service, module_authoring_service as mas


class ClockCreditTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        ir, sr = Role(name=SA_INSTRUCTOR), Role(name=STUDENT)
        self.db.add_all([ir, sr]); self.db.flush()
        self.i = User(email="a@e.com", password_hash=hash_password("P!1"), role_id=ir.id, first_name="A", last_name="T", is_active=True)
        self.s = User(email="s@e.com", password_hash=hash_password("P!1"), role_id=sr.id, first_name="S", last_name="T", is_active=True)
        self.db.add_all([self.i, self.s]); self.db.commit()
        self.storage = tempfile.TemporaryDirectory()
        self.orig = settings.storage_dir; settings.storage_dir = self.storage.name

    def tearDown(self):
        self.db.close(); self.engine.dispose()
        settings.storage_dir = self.orig; self.storage.cleanup()

    def _speaking_attempt(self):
        created = mas.create_module(self.db, self.i, {"module_type": "speaking", "title": "S", "description": None, "instructions": None}, "127.0.0.1")
        m = mas.get_module_or_404(self.db, created["id"])
        plan = {"speaking_1": ["identity", "topic_question"], "speaking_2": ["roleplay_response", "roleplay_initiate"],
                "speaking_3": ["read_aloud"], "speaking_4": ["presentation", "follow_up"]}
        for p in m.parts:
            for n, turn in enumerate(plan[p.part_code]):
                self.db.add(ExamModuleQuestion(
                    part_id=p.id, question_type="speaking_prompt", prompt=f"{p.part_code} {turn}",
                    instructions=None, passage="Read this aloud." if turn == "read_aloud" else None,
                    options=[], correct_answers=[], explanation=None, points=Decimal("1"),
                    difficulty="medium", interaction={"turn_type": turn},
                    source_type="manual", source_filename=None, sort_order=n, created_by_id=self.i.id))
        self.db.commit()
        c = Course(title="B", slug="b", price=Decimal("0"), currency="INR", status=COURSE_PUBLISHED, created_by_id=self.i.id)
        self.db.add(c); self.db.flush()
        self.db.add(CourseModule(course_id=c.id, module_id=m.id, sort_order=0)); self.db.commit()
        self.db.expire_all()
        m = mas.get_module_or_404(self.db, m.id)
        out = attempt_service.start_attempt(self.db, self.s, m)
        return attempt_service.get_attempt_or_404(self.db, self.s, out["id"])

    def test_examiner_speech_is_credited_back_once(self):
        a = self._speaking_attempt()
        before = a.expires_at
        # The router adds CLOCK_TRANSITION_ALLOWANCE_SECONDS on top; credit_clock
        # itself grants exactly what it is handed, floored to whole seconds.
        self.assertTrue(attempt_service.credit_clock(self.db, a, "prompt:1", 12.4))
        self.assertEqual((a.expires_at - before).total_seconds(), 12)

        # replaying the same prompt buys nothing
        again = a.expires_at
        self.assertFalse(attempt_service.credit_clock(self.db, a, "prompt:1", 12.4))
        self.assertEqual(a.expires_at, again)

    def test_total_credit_is_capped(self):
        a = self._speaking_attempt()
        before = a.expires_at
        for n in range(40):
            attempt_service.credit_clock(self.db, a, f"prompt:{n}", 60)
        gained = (a.expires_at - before).total_seconds()
        self.assertEqual(gained, attempt_service.MAX_CLOCK_CREDIT_SECONDS)

    def test_no_credit_once_the_attempt_is_over(self):
        a = self._speaking_attempt()
        a.status = "submitted"; self.db.commit()
        before = a.expires_at
        self.assertFalse(attempt_service.credit_clock(self.db, a, "prompt:9", 30))
        self.assertEqual(a.expires_at, before)

    def test_a_full_sitting_now_fits(self):
        """7 prompts: examiner speech + uploads no longer eat answering time."""
        a = self._speaking_attempt()
        allowed = sum(
            (p.answer_constraints.get("preparation_seconds", 0) + p.answer_constraints.get("response_seconds", 0)) * len(p.questions)
            for p in a.module.parts
        )
        budget_before = (a.expires_at - a.started_at).total_seconds()
        for n in range(7):
            attempt_service.credit_clock(self.db, a, f"prompt:{n}", 8)
            attempt_service.credit_clock(self.db, a, f"upload:{n}", 3)
        budget_after = (a.expires_at - a.started_at).total_seconds()
        credited = 7 * (8 + 3)
        print(f"\n   candidate answering time needed : {allowed}s")
        print(f"   budget before fix               : {budget_before:.0f}s  (slack over answering time {budget_before-allowed:+.0f}s)")
        print(f"   budget after  fix               : {budget_after:.0f}s  (slack over answering time {budget_after-allowed:+.0f}s)")
        print(f"   system time handed back         : {credited}s")
        # Every second the system spent is handed back, exactly once.
        self.assertEqual(budget_after - budget_before, credited)
        # And the candidate's full answering allowance still fits inside it.
        self.assertGreaterEqual(budget_after - credited, allowed)


if __name__ == "__main__":
    unittest.main(verbosity=2)
