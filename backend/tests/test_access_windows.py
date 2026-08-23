"""Every loophole in the per-student seat model, asserted.

There is one test here for each hole found in the design review, named after the
hole rather than after the function, because the function is not the thing worth
protecting - the property is. If someone later "simplifies" reactivation back
into a flag flip, `test_reactivating_at_the_cap_is_refused` is what stops it
shipping.
"""
import unittest
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base
from app.models.attempt import ATTEMPT_IN_PROGRESS, ATTEMPT_SUBMITTED, TestAttempt
from app.models.exam_module import ExamModule
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
from app.services import access_window_service, institute_admin_service, subscription_service


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _today() -> date:
    return _now().date()


class AccessWindowTests(unittest.TestCase):
    STUDENT_LIMIT = 3

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
            student_limit=self.STUDENT_LIMIT,
            staff_limit=5,
            timezone="Asia/Kolkata",
        )
        self.db.add(self.institute)

        self.plan = Plan(
            name="Institute 3",
            price=1000,
            currency="INR",
            duration_days=365,
            student_limit=self.STUDENT_LIMIT,
            staff_limit=5,
            grace_days=7,
            is_active=True,
            audience=AUDIENCE_INSTITUTES,
            is_published=True,
        )
        self.db.add(self.plan)
        self.db.flush()

        self.subscription_ends = _now() + timedelta(days=200)
        self.db.add(
            Subscription(
                institute_id=self.institute.id,
                plan_id=self.plan.id,
                starts_at=_now() - timedelta(days=165),
                expires_at=self.subscription_ends,
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

    # ------------------------------------------------------------ helpers

    def _create(self, email, days=30, start_offset=0):
        return institute_admin_service.create_member(
            self.db,
            self.actor,
            email=email,
            first_name="A",
            last_name="B",
            role_name=STUDENT,
            phone_number="9810000000",
            address=None,
            ip="127.0.0.1",
            access_starts_on=_today() + timedelta(days=start_offset),
            access_ends_on=_today() + timedelta(days=start_offset + days),
        )

    def _user(self, email) -> User:
        return self.db.query(User).filter(User.email == email).one()

    def _module(self, module_type: str) -> ExamModule:
        module = ExamModule(
            title=f"Mock {module_type}",
            module_type=module_type,
            duration_minutes=60,
            created_by_id=self.actor.id,
        )
        self.db.add(module)
        self.db.flush()
        return module

    def _seats_used(self):
        return institute_admin_service.member_capacity(self.db, self.actor)["usage"]["students"]

    # ------------------------------------------------- loophole 1 + 2 + 11

    def test_reactivating_at_the_cap_is_refused(self):
        """Hole 1: deactivate 3, create 3, reactivate 3 -> 6 on a 3-seat plan."""
        for index in range(self.STUDENT_LIMIT):
            self._create(f"old{index}@gp.example.com")

        # Free every seat the honest way.
        for index in range(self.STUDENT_LIMIT):
            user = self._user(f"old{index}@gp.example.com")
            institute_admin_service.set_member_active(self.db, self.actor, user.id, False, None)
            institute_admin_service.release_seat(self.db, self.actor, user.id, None)

        self.assertEqual(self._seats_used(), 0)

        for index in range(self.STUDENT_LIMIT):
            self._create(f"new{index}@gp.example.com")
        self.assertEqual(self._seats_used(), self.STUDENT_LIMIT)

        # The old cohort tries to come back. There is nowhere to put them.
        with self.assertRaises(HTTPException) as raised:
            institute_admin_service.reactivate_seat(
                self.db,
                self.actor,
                self._user("old0@gp.example.com").id,
                access_starts_on=_today(),
                access_ends_on=_today() + timedelta(days=30),
                ip=None,
            )
        self.assertEqual(raised.exception.status_code, 402)
        self.assertEqual(self._seats_used(), self.STUDENT_LIMIT, "must never exceed the plan")

    def test_moving_an_end_date_can_never_free_a_seat(self):
        """Hole 2: the end-date pump. Shorten, sweep, refill, lengthen."""
        student = self._user(self._create("pump@gp.example.com")["email"])

        institute_admin_service.set_member_window(
            self.db,
            self.actor,
            student.id,
            access_starts_on=_today() - timedelta(days=10),
            access_ends_on=_today() - timedelta(days=1),
            ip=None,
        )
        access_window_service.expire_due_students(self.db)

        self.db.refresh(student)
        self.assertEqual(student.access_state, ACCESS_EXPIRED, "should be locked out")
        self.assertEqual(self._seats_used(), 1, "but the seat must NOT have come back")

    def test_extending_an_expired_window_restores_access_without_a_second_seat(self):
        """Hole 11: reactivation that leaves a dead date behind is a lie."""
        student = self._user(self._create("ext@gp.example.com", days=1)["email"])
        institute_admin_service.set_member_window(
            self.db, self.actor, student.id,
            access_starts_on=_today() - timedelta(days=10),
            access_ends_on=_today() - timedelta(days=1), ip=None,
        )
        access_window_service.expire_due_students(self.db)

        result = institute_admin_service.set_member_window(
            self.db, self.actor, student.id,
            access_starts_on=_today(),
            access_ends_on=_today() + timedelta(days=60), ip=None,
        )
        self.assertEqual(result["access_state"], ACCESS_ACTIVE)
        self.assertIsNone(access_window_service.access_denied_reason(self._user("ext@gp.example.com")))
        self.assertEqual(self._seats_used(), 1, "an extension costs nothing")

    def test_student_plan_view_uses_personal_window_not_institute_subscription(self):
        student = self._user(self._create("window@gp.example.com", days=30)["email"])

        view = subscription_service.my_current_plan_view(self.db, student)

        self.assertEqual(view["starts_at"], student.access_starts_at)
        self.assertEqual(view["expires_at"], student.access_ends_at)
        self.assertNotEqual(
            view["expires_at"],
            self.subscription_ends,
            "student dashboard must show the student's allotted window, not the institute subscription expiry",
        )

    # -------------------------------------------------------- loophole 4

    def test_releasing_a_seat_keeps_the_student_findable(self):
        """Hole 4: the retention requirement. Release must not behave like delete."""
        created = self._create("returner@gp.example.com")
        student = self._user(created["email"])
        institute_admin_service.set_member_active(self.db, self.actor, student.id, False, None)
        institute_admin_service.release_seat(self.db, self.actor, student.id, None)

        self.db.refresh(student)
        self.assertEqual(student.access_state, ACCESS_RELEASED)
        self.assertEqual(student.email, "returner@gp.example.com", "email must survive")
        self.assertIsNone(student.deleted_at, "release is not archive")
        self.assertEqual(self._seats_used(), 0, "the seat is genuinely back")

        found = institute_admin_service.list_members(
            self.db, self.actor, search="returner", status_filter="released"
        )
        self.assertEqual(len(found), 1, "a past student must be searchable")

        back = institute_admin_service.reactivate_seat(
            self.db, self.actor, student.id,
            access_starts_on=_today(), access_ends_on=_today() + timedelta(days=90), ip=None,
        )
        self.assertEqual(back["access_state"], ACCESS_ACTIVE)
        self.assertEqual(self._seats_used(), 1)

    def test_a_seat_cannot_be_pulled_from_a_student_who_still_has_access(self):
        student = self._user(self._create("live@gp.example.com")["email"])
        with self.assertRaises(HTTPException) as raised:
            institute_admin_service.release_seat(self.db, self.actor, student.id, None)
        self.assertEqual(raised.exception.status_code, 409)

    # -------------------------------------------------------- loophole 5

    def test_the_sweep_never_expires_a_student_mid_exam(self):
        """Hole 5: flipping the flag mid-attempt 401s the next autosave."""
        module = self._module("reading")

        sitting = self._user(self._create("sitting@gp.example.com")["email"])
        safe = self._user(self._create("safe@gp.example.com")["email"])
        for student in (sitting, safe):
            student.access_ends_at = _now() - timedelta(minutes=1)
        self.db.add(
            TestAttempt(
                user_id=sitting.id, module_id=module.id, status=ATTEMPT_IN_PROGRESS,
                started_at=_now() - timedelta(minutes=40),
                expires_at=_now() + timedelta(minutes=80),
            )
        )
        self.db.commit()

        result = access_window_service.expire_due_students(self.db)

        self.db.refresh(sitting)
        self.db.refresh(safe)
        self.assertEqual(sitting.access_state, ACCESS_ACTIVE, "mid-exam must be left alone")
        self.assertTrue(sitting.is_active, "and must still be able to submit")
        self.assertEqual(safe.access_state, ACCESS_EXPIRED)
        self.assertEqual(result["skipped_in_exam"], 1)

        # Once the sitting is submitted, the next sweep picks them up.
        self.db.query(TestAttempt).filter(TestAttempt.user_id == sitting.id).one().status = (
            ATTEMPT_SUBMITTED
        )
        self.db.commit()
        access_window_service.expire_due_students(self.db)
        self.db.refresh(sitting)
        self.assertEqual(sitting.access_state, ACCESS_EXPIRED)

    # -------------------------------------------------------- loophole 6

    def test_the_last_day_is_a_whole_day_in_the_institutes_timezone(self):
        """Hole 6: UTC midnight cuts a Delhi institute off at 05:30."""
        tz = ZoneInfo("Asia/Kolkata")
        last_day = date(2027, 3, 31)
        ends_at = access_window_service.end_of_day_utc(last_day, tz)

        # 23:00 IST on the last day is still inside the window.
        late_that_night = datetime(2027, 3, 31, 17, 30, tzinfo=timezone.utc).replace(tzinfo=None)
        self.assertGreater(ends_at, late_that_night, "the last day must be a full day")

        # And 05:30 IST that morning - what UTC midnight would have meant - is not the end.
        utc_midnight = datetime(2027, 3, 31, 0, 0)
        self.assertGreater(ends_at, utc_midnight)

        # Start of the next day picks up exactly where the window stops.
        next_start = access_window_service.start_of_day_utc(date(2027, 4, 1), tz)
        self.assertLess(ends_at, next_start)
        self.assertLess((next_start - ends_at).total_seconds(), 1.0, "no gap between days")

    # -------------------------------------------------------- loophole 7

    def test_a_window_cannot_outlive_the_subscription(self):
        """Hole 7: 21 months of access after the institute stopped paying."""
        ends_on = (self.subscription_ends + timedelta(days=400)).date()
        with self.assertRaises(HTTPException) as raised:
            institute_admin_service.create_member(
                self.db, self.actor,
                email="toolong@gp.example.com", first_name="A", last_name="B",
                role_name=STUDENT, phone_number="98", address=None, ip=None,
                access_starts_on=_today(), access_ends_on=ends_on,
            )
        self.assertEqual(raised.exception.status_code, 400)
        self.assertIn("subscription", raised.exception.detail.lower())

    # ------------------------------------------------------- loophole 12

    def test_a_student_cannot_be_created_without_a_window(self):
        """Hole 12: no default means no silently immortal students."""
        with self.assertRaises(HTTPException) as raised:
            institute_admin_service.create_member(
                self.db, self.actor,
                email="nodates@gp.example.com", first_name="A", last_name="B",
                role_name=STUDENT, phone_number="98", address=None, ip=None,
            )
        self.assertEqual(raised.exception.status_code, 400)

    def test_staff_do_not_get_windows(self):
        member = institute_admin_service.create_member(
            self.db, self.actor,
            email="tutor@gp.example.com", first_name="T", last_name="R",
            role_name=INST_INSTRUCTOR, phone_number="98", address=None, ip=None,
        )
        self.assertIsNone(member["access_ends_on"])
        self.assertIsNone(
            access_window_service.access_denied_reason(self._user("tutor@gp.example.com"))
        )

    # -------------------------------------------- what the student is told

    def test_an_expired_student_is_locked_out_with_a_reason_they_can_act_on(self):
        student = self._user(self._create("locked@gp.example.com")["email"])
        student.access_ends_at = _now() - timedelta(days=1)
        self.db.commit()
        access_window_service.expire_due_students(self.db)

        reason = access_window_service.access_denied_reason(self._user("locked@gp.example.com"))
        self.assertIsNotNone(reason)
        self.assertIn("ended", reason)
        self.assertIn("institute", reason.lower())

    def test_a_student_whose_window_has_not_opened_yet_is_told_when_it_does(self):
        student = self._user(self._create("early@gp.example.com", start_offset=7)["email"])
        reason = access_window_service.access_denied_reason(student)
        self.assertIsNotNone(reason)
        self.assertIn("starts on", reason)

    def test_a_deactivated_student_is_told_it_was_their_institute(self):
        student = self._user(self._create("off@gp.example.com")["email"])
        institute_admin_service.set_member_active(self.db, self.actor, student.id, False, None)
        reason = access_window_service.access_denied_reason(self._user("off@gp.example.com"))
        self.assertIn("deactivated", reason)

    # ----------------------------------------------- the capacity payload

    def test_the_seat_panel_adds_up(self):
        active = self._user(self._create("p1@gp.example.com")["email"])
        expired = self._user(self._create("p2@gp.example.com")["email"])
        released = self._user(self._create("p3@gp.example.com")["email"])

        expired.access_ends_at = _now() - timedelta(days=1)
        self.db.commit()
        access_window_service.expire_due_students(self.db)

        institute_admin_service.set_member_active(self.db, self.actor, released.id, False, None)
        institute_admin_service.release_seat(self.db, self.actor, released.id, None)

        seats = institute_admin_service.member_capacity(self.db, self.actor)["seats"]
        self.assertEqual(seats["total"], self.STUDENT_LIMIT)
        self.assertEqual(seats["used"], 2, "active + expired hold seats")
        self.assertEqual(seats["free"], 1)
        self.assertEqual(seats["expired"], 1)
        self.assertEqual(seats["past_students"], 1)
        self.assertEqual(seats["active"] + seats["expired"] + seats["suspended"], seats["used"])

    def test_an_expired_students_work_is_still_gradable(self):
        """Their access ends; their submitted work does not disappear."""
        module = self._module("writing")
        student = self._user(self._create("graded@gp.example.com")["email"])
        self.db.add(
            TestAttempt(
                user_id=student.id, module_id=module.id, status=ATTEMPT_SUBMITTED,
                started_at=_now() - timedelta(hours=3),
                expires_at=_now() - timedelta(hours=2),
                submitted_at=_now() - timedelta(hours=2),
            )
        )
        student.access_ends_at = _now() - timedelta(days=1)
        self.db.commit()
        access_window_service.expire_due_students(self.db)

        still_there = (
            self.db.query(TestAttempt)
            .filter(TestAttempt.user_id == student.id, TestAttempt.status == ATTEMPT_SUBMITTED)
            .count()
        )
        self.assertEqual(still_there, 1, "submitted work must survive expiry")


if __name__ == "__main__":
    unittest.main()
