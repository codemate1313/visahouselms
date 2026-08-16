"""The direct-student trial is bounded by two things only: whether it is still
running, and which courses are ticked as demos.

There is deliberately no separate cap on the number of tests - a module can be
sat once, so the demo list already decides how many tests a trial student gets.
A second cap could only contradict it.
"""
import unittest
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import hash_password
from app.models import Base
from app.models.exam_module import ExamModule
from app.models.role import SA_INSTRUCTOR, STUDENT, Role
from app.models.user import User
from app.services import trial_service


class TrialDemoAccessTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        instructor_role, student_role = Role(name=SA_INSTRUCTOR), Role(name=STUDENT)
        self.db.add_all([instructor_role, student_role])
        self.db.flush()
        self.actor = User(email="owner@example.com", password_hash=hash_password("P!1"),
                          role_id=instructor_role.id, first_name="O", last_name="A", is_active=True)
        self.student = User(email="trial@example.com", password_hash=hash_password("P!1"),
                            role_id=student_role.id, first_name="T", last_name="S", is_active=True,
                            created_at=datetime.now(timezone.utc).replace(tzinfo=None))
        self.db.add_all([self.actor, self.student])
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _demo_modules(self, count: int) -> list:
        made = []
        for n in range(count):
            module = ExamModule(
                title=f"Demo {n + 1}", module_type="reading", status="published",
                duration_minutes=30, created_by_id=self.actor.id, is_demo=True, is_visible=True,
            )
            self.db.add(module)
            made.append(module)
        self.db.commit()
        trial_service.update_config(self.db, self.actor, 14, count, True, None)
        return made

    def test_the_trial_offers_every_demo_course_with_no_extra_test_cap(self):
        modules = self._demo_modules(5)
        state = trial_service.demo_state(self.db, self.student)

        self.assertEqual(state["state"], "active")
        self.assertNotIn("test_limit", state, "the trial no longer carries a separate test cap")
        self.assertEqual(len(state["module_ids"]), 5)
        for module in modules:
            self.assertTrue(
                trial_service.can_start_demo_module(self.db, self.student, module.id),
                f"{module.title} is offered as a demo, so the trial must allow it",
            )

    def test_the_course_list_is_what_decides_how_many_tests(self):
        modules = self._demo_modules(5)
        # untick two of them - the trial shrinks to match, with nothing else to set
        trial_service.set_demo_modules(self.db, self.actor, [m.id for m in modules[:3]], None)
        state = trial_service.demo_state(self.db, self.student)
        self.assertEqual(len(state["module_ids"]), 3)
        self.assertTrue(trial_service.can_start_demo_module(self.db, self.student, modules[0].id))
        self.assertFalse(trial_service.can_start_demo_module(self.db, self.student, modules[4].id))

    def test_an_expired_trial_still_locks(self):
        self._demo_modules(2)
        self.student.created_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)
        self.db.commit()
        state = trial_service.demo_state(self.db, self.student)
        self.assertEqual(state["state"], "locked")
        self.assertEqual(state["locked_reason"], "duration_expired")

    def test_a_disabled_trial_still_locks(self):
        self._demo_modules(2)
        trial_service.update_config(self.db, self.actor, None, None, False, None)
        state = trial_service.demo_state(self.db, self.student)
        self.assertEqual(state["state"], "locked")
        self.assertEqual(state["module_ids"], [])


if __name__ == "__main__":
    unittest.main()
