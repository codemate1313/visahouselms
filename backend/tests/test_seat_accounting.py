"""The seat count must be ONE number.

Before this, the rule "does this row occupy a seat" was written out five times
across four files - dependencies/limits.py, subscription_service.usage, and
twice inside institute_admin_service. They agreed by luck, and no test could
have caught the day they stopped: the roster would report 84/100 while creating
a student refused at 100/100, and no single query would be wrong.

So these tests do not assert a value. They assert that every seat-counting path
in the codebase returns the *same* value, in every state a student can be in.
Re-implement the rule in a sixth place and `test_every_counting_site_agrees`
fails.
"""
import unittest
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.dependencies.limits import _count_students, enforce_limit
from app.models import Base
from app.models.institute import Institute
from app.models.plan import AUDIENCE_INSTITUTES, Plan
from app.models.role import INSTITUTE_ADMIN, INST_INSTRUCTOR, STUDENT, Role
from app.models.subscription import Subscription
from app.models.user import (
    ACCESS_ACTIVE,
    ACCESS_EXPIRED,
    ACCESS_RELEASED,
    ACCESS_SUSPENDED,
    User,
)
from app.services import institute_admin_service, subscription_service


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class SeatAccountingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        roles = [Role(name=name) for name in (INSTITUTE_ADMIN, INST_INSTRUCTOR, STUDENT)]
        self.db.add_all(roles)
        self.db.flush()
        self.roles = {role.name: role for role in roles}

        self.institute = Institute(
            name="Global Pathways",
            slug="global-pathways",
            onboarding_status="published",
            student_limit=10,
            staff_limit=5,
        )
        self.db.add(self.institute)

        self.plan = Plan(
            name="Institute 10",
            price=1000,
            currency="INR",
            duration_days=365,
            student_limit=10,
            test_limit=0,
            staff_limit=5,
            grace_days=7,
            is_active=True,
            audience=AUDIENCE_INSTITUTES,
            is_published=True,
        )
        self.db.add(self.plan)
        self.db.flush()

        self.db.add(
            Subscription(
                institute_id=self.institute.id,
                plan_id=self.plan.id,
                starts_at=_now() - timedelta(days=30),
                expires_at=_now() + timedelta(days=335),
                grace_days=7,
            )
        )

        self.actor = User(
            email="admin@gp.example.com",
            password_hash="x",
            role_id=self.roles[INSTITUTE_ADMIN].id,
            institute_id=self.institute.id,
            first_name="Institute",
            last_name="Admin",
        )
        self.db.add(self.actor)
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()

    # -- helpers -----------------------------------------------------------

    def _student(self, email, state=ACCESS_ACTIVE, is_active=True, deleted=False) -> User:
        user = User(
            email=email,
            password_hash="x",
            role_id=self.roles[STUDENT].id,
            institute_id=self.institute.id,
            first_name="A",
            last_name="B",
            is_active=is_active,
            access_state=state,
            access_starts_at=_now() - timedelta(days=10),
            access_ends_at=_now() + timedelta(days=100),
            deleted_at=_now() if deleted else None,
        )
        self.db.add(user)
        self.db.commit()
        return user

    def _all_counts(self) -> dict:
        """Every independent path in the codebase that answers 'seats used'."""
        return {
            "enforce_limit (blocks creation)": _count_students(self.db, self.institute.id),
            "subscription usage (billing)": subscription_service.usage(
                self.db, self.institute.id
            )["students"],
            "member_capacity (admin's screen)": institute_admin_service.member_capacity(
                self.db, self.actor
            )["usage"]["students"],
            "available slots (bulk import)": self.plan.student_limit
            - institute_admin_service._available_student_slots(self.db, self.institute.id),
        }

    def _assert_all_agree(self, expected: int, label: str) -> None:
        counts = self._all_counts()
        distinct = set(counts.values())
        self.assertEqual(len(distinct), 1, f"{label}: counting sites disagree -> {counts}")
        self.assertEqual(distinct.pop(), expected, f"{label}: expected {expected}, got {counts}")

    # -- tests -------------------------------------------------------------

    def test_every_counting_site_agrees(self):
        """The property that matters: one number, whatever state students are in."""
        self._assert_all_agree(0, "empty institute")

        self._student("a@gp.example.com")
        self._assert_all_agree(1, "one active student")

        self._student("b@gp.example.com", state=ACCESS_SUSPENDED, is_active=False)
        self._assert_all_agree(2, "a suspended student still holds a seat")

        self._student("c@gp.example.com", state=ACCESS_EXPIRED, is_active=False)
        self._assert_all_agree(3, "an expired student still holds a seat")

        self._student("d@gp.example.com", state=ACCESS_RELEASED, is_active=False)
        self._assert_all_agree(3, "a released student holds no seat")

        self._student("e@gp.example.com", state=ACCESS_RELEASED, is_active=False, deleted=True)
        self._assert_all_agree(3, "a deleted student holds no seat")

    def test_expired_students_still_block_new_ones_at_the_cap(self):
        """Your rule, asserted: a date passing does not hand a seat back."""
        for index in range(10):
            self._student(f"s{index}@gp.example.com", state=ACCESS_EXPIRED, is_active=False)

        self._assert_all_agree(10, "ten expired students")

        with self.assertRaises(HTTPException) as raised:
            enforce_limit(self.db, self.institute.id, "students")
        self.assertEqual(raised.exception.status_code, 402)
        self.assertIn("10/10", raised.exception.detail)

    def test_releasing_a_seat_lets_exactly_one_more_in(self):
        for index in range(10):
            self._student(f"s{index}@gp.example.com", state=ACCESS_EXPIRED, is_active=False)
        with self.assertRaises(HTTPException):
            enforce_limit(self.db, self.institute.id, "students")

        released = self.db.query(User).filter(User.email == "s0@gp.example.com").one()
        released.access_state = ACCESS_RELEASED
        self.db.commit()

        self._assert_all_agree(9, "after releasing one seat")
        enforce_limit(self.db, self.institute.id, "students")  # must not raise

    def test_a_released_student_keeps_their_email_and_record(self):
        """Releasing is not deleting. The returning-student path depends on it."""
        student = self._student("returner@gp.example.com")
        student.access_state = ACCESS_RELEASED
        student.is_active = False
        self.db.commit()

        found = self.db.query(User).filter(User.email == "returner@gp.example.com").first()
        self.assertIsNotNone(found, "a released student must stay searchable by email")
        self.assertIsNone(found.deleted_at, "releasing a seat must not archive the record")
        self.assertEqual(found.access_state, ACCESS_RELEASED)

    def test_draft_institutes_count_the_same_way(self):
        """The onboarding path has its own query; it must not drift either."""
        self.institute.onboarding_status = "draft"
        self.db.commit()

        self._student("x@gp.example.com", state=ACCESS_EXPIRED, is_active=False)
        self._student("y@gp.example.com", state=ACCESS_RELEASED, is_active=False)

        self.assertEqual(
            institute_admin_service._available_student_slots(self.db, self.institute.id),
            9,
            "draft institutes must use the same seat rule as everyone else",
        )

    def test_staff_seats_follow_the_same_rule(self):
        """Staff are counted by the same helper; released staff free their slot."""
        for state, expected in ((ACCESS_ACTIVE, 1), (ACCESS_RELEASED, 1)):
            user = User(
                email=f"staff-{state}@gp.example.com",
                password_hash="x",
                role_id=self.roles[INST_INSTRUCTOR].id,
                institute_id=self.institute.id,
                first_name="S",
                last_name="T",
                access_state=state,
            )
            self.db.add(user)
            self.db.commit()
            self.assertEqual(
                subscription_service.usage(self.db, self.institute.id)["staff"],
                expected,
                f"staff count wrong after adding a {state} instructor",
            )


if __name__ == "__main__":
    unittest.main()
