"""Buying a second plan must add to the first, never take from it.

Two of these tests are the bugs, written as they reproduced before the fix:

  * `test_a_longer_second_plan_does_not_revoke_the_first` - a student holding
    Plan A (Reading, Writing) who bought a longer Plan B (Writing, Speaking)
    lost Reading outright, with months still paid for.
  * `test_a_shorter_second_plan_still_grants_its_modules` - the same purchase
    the other way round granted nothing at all: the shorter plan never became
    "current", so its modules stayed locked for its entire paid life.

The rest pin the rule the fix implements: a plan's duration is added to every
module it contains, from that module's own expiry.
"""
import unittest
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.dependencies.student_access import has_module_access
from app.models import Base
from app.models.attempt import CourseModule, TestAttempt
from app.models.course import Course
from app.models.exam_module import ExamModule
from app.models.module_entitlement import ModuleEntitlement
from app.models.plan import AUDIENCE_DIRECT, Plan
from app.models.role import STUDENT, Role
from app.models.subscription import Subscription
from app.models.user import User
from app.services import entitlement_service, subscription_service


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class PlanStackingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        role = Role(name=STUDENT)
        self.db.add(role)
        self.db.flush()
        self.role = role

        self.student = User(
            email="priya@example.com",
            password_hash="x",
            role_id=role.id,
            first_name="Priya",
            last_name="R",
        )
        self.db.add(self.student)
        self.db.flush()

        self.reading = self._module("Reading")
        self.writing = self._module("Writing")
        self.speaking = self._module("Speaking")

    def tearDown(self) -> None:
        self.db.close()

    # ------------------------------------------------------------ helpers

    def _module(self, title: str) -> ExamModule:
        module = ExamModule(
            title=title,
            module_type="reading",
            duration_minutes=60,
            created_by_id=self.student.id,
        )
        self.db.add(module)
        self.db.flush()
        return module

    def _plan(self, name, days, modules=(), courses=(), students=0, staff=0) -> Plan:
        plan = Plan(
            name=name,
            price=1000,
            currency="INR",
            duration_days=days,
            student_limit=students,
            staff_limit=staff,
            grace_days=0,
            is_active=True,
            audience=AUDIENCE_DIRECT,
            is_published=True,
        )
        plan.modules = list(modules)
        plan.courses = list(courses)
        self.db.add(plan)
        self.db.flush()
        return plan

    def _buy(self, plan: Plan) -> Subscription:
        return subscription_service.subscribe_user(self.db, self.student.id, plan.id, "127.0.0.1")

    def _can(self, module: ExamModule) -> bool:
        return has_module_access(self.db, self.student, module.id)

    def _expiry(self, module: ExamModule):
        return entitlement_service.module_expiry(self.db, self.student.id, module.id)

    # -------------------------------------------------- the two real bugs

    def test_a_longer_second_plan_does_not_revoke_the_first(self):
        """Reading was silently taken away with months still paid for."""
        a = self._plan("Plan A", 180, [self.reading, self.writing])
        b = self._plan("Plan B", 365, [self.writing, self.speaking])

        self._buy(a)
        self.assertTrue(self._can(self.reading))

        self._buy(b)
        self.assertTrue(self._can(self.reading), "Reading was paid for and has not expired")
        self.assertTrue(self._can(self.writing))
        self.assertTrue(self._can(self.speaking), "the new plan must grant its modules at once")

    def test_a_shorter_second_plan_still_grants_its_modules(self):
        """The student paid for Plan B and previously received nothing."""
        a = self._plan("Plan A", 365, [self.reading, self.writing])
        b = self._plan("Plan B", 90, [self.writing, self.speaking])

        self._buy(a)
        self._buy(b)

        self.assertTrue(self._can(self.speaking), "Plan B's module must open immediately")
        self.assertTrue(self._can(self.reading))
        self.assertTrue(self._can(self.writing))

    # ------------------------------------------------------ the stacking

    def test_a_module_in_both_plans_gains_the_days_of_both(self):
        a = self._plan("Plan A", 180, [self.reading, self.writing])
        b = self._plan("Plan B", 90, [self.writing, self.speaking])

        self._buy(a)
        reading_before = self._expiry(self.reading)
        writing_before = self._expiry(self.writing)

        self._buy(b)

        self.assertEqual(
            self._expiry(self.reading), reading_before,
            "a module the new plan does not contain must not move",
        )
        gained = (self._expiry(self.writing) - writing_before).days
        self.assertEqual(gained, 90, "Writing should gain Plan B's full 90 days")
        self.assertAlmostEqual(
            (self._expiry(self.writing) - _now()).days, 269, delta=1,
            msg="180 + 90 days, minus today",
        )
        self.assertAlmostEqual(
            (self._expiry(self.speaking) - _now()).days, 89, delta=1,
            msg="a brand new module starts today",
        )

    def test_buying_the_same_plan_twice_doubles_every_module(self):
        plan = self._plan("Monthly", 30, [self.reading, self.writing])
        self._buy(plan)
        self._buy(plan)
        for module in (self.reading, self.writing):
            self.assertAlmostEqual(
                (self._expiry(module) - _now()).days, 59, delta=1,
                msg=f"{module.title} should hold 60 days after two 30-day plans",
            )

    def test_a_lapsed_module_restarts_from_today_rather_than_its_old_expiry(self):
        """Long-expired days must not be resurrected and stacked on."""
        plan = self._plan("Monthly", 30, [self.reading])
        self.db.add(
            ModuleEntitlement(
                user_id=self.student.id,
                module_id=self.reading.id,
                expires_at=_now() - timedelta(days=400),
                granted_days=30,
            )
        )
        self.db.commit()

        self._buy(plan)
        self.assertAlmostEqual(
            (self._expiry(self.reading) - _now()).days, 29, delta=1,
            msg="an expired module gets a fresh 30 days, not 30 days from 400 days ago",
        )

    def test_a_plan_that_bundles_courses_grants_their_modules(self):
        course = Course(title="Full Bundle", slug="full-bundle", description="x", created_by_id=self.student.id)
        self.db.add(course)
        self.db.flush()
        self.db.add(CourseModule(course_id=course.id, module_id=self.speaking.id, sort_order=0))
        self.db.flush()

        plan = self._plan("Bundle plan", 60, [], [course])
        self._buy(plan)

        self.assertTrue(self._can(self.speaking), "course-bundled modules must be granted too")
        self.assertIsNotNone(self._expiry(self.speaking))

    # ------------------------------------------------------ term stacking

    def test_a_purchase_is_live_immediately_and_reports_the_access_it_bought(self):
        """No student should be told their purchase is "scheduled" for October.

        The term used to begin where the running one ended, which was correct
        arithmetic and a terrible message: the purchase history showed a plan
        paid for that morning as SCHEDULED, reading as "you do not have this
        yet". The stacking lives in the entitlement now; the term starts today
        and its end date reports the access the purchase resulted in.
        """
        a = self._plan("Plan A", 180, [self.reading])
        b = self._plan("Plan B", 90, [self.reading])

        first = self._buy(a)
        second = self._buy(b)

        self.assertAlmostEqual(
            (second.starts_at - _now()).total_seconds(), 0, delta=5,
            msg="a purchase is live the day it is paid for",
        )
        self.assertEqual(
            subscription_service.state_of_subscription(second), "active",
            "and must never render as 'scheduled'",
        )
        self.assertAlmostEqual(
            (second.expires_at - _now()).days, 269, delta=1,
            msg="its end date reports the combined 270 days, not just its own 90",
        )
        self.assertGreater(
            second.expires_at, first.expires_at,
            "the second purchase visibly extends the first",
        )

    def test_no_purchase_ever_shows_as_scheduled(self):
        plan = self._plan("Monthly", 30, [self.reading])
        for _ in range(3):
            self._buy(plan)
        states = {
            subscription_service.state_of_subscription(row)
            for row in self.db.query(Subscription)
            .filter(Subscription.user_id == self.student.id)
            .all()
        }
        self.assertNotIn("scheduled", states, f"got {states}")

    def test_buying_after_everything_lapsed_starts_today(self):
        plan = self._plan("Plan A", 30, [self.reading])
        old = Subscription(
            user_id=self.student.id,
            plan_id=plan.id,
            starts_at=_now() - timedelta(days=400),
            expires_at=_now() - timedelta(days=370),
            grace_days=0,
        )
        self.db.add(old)
        self.db.commit()

        fresh = self._buy(plan)
        self.assertAlmostEqual(
            (fresh.starts_at - _now()).total_seconds(), 0, delta=5,
            msg="nothing is running, so the new term starts now",
        )

    # ----------------------------------------------------------- rebuild

    def test_replaying_history_gives_back_what_was_paid_for(self):
        """The migration's arithmetic, on the exact scenario from the report."""
        a = self._plan("Plan A", 180, [self.reading, self.writing])
        b = self._plan("Plan B", 90, [self.writing, self.speaking])

        bought_a = _now() - timedelta(days=90)
        bought_b = _now() - timedelta(days=30)
        self.db.add_all([
            Subscription(user_id=self.student.id, plan_id=a.id, starts_at=bought_a,
                         expires_at=bought_a + timedelta(days=180), grace_days=0),
            Subscription(user_id=self.student.id, plan_id=b.id, starts_at=bought_b,
                         expires_at=bought_b + timedelta(days=90), grace_days=0),
        ])
        self.db.commit()

        subs = entitlement_service.subscriptions_for_user(self.db, self.student.id)
        entitlement_service.replay_subscriptions(self.db, self.student.id, subs)
        self.db.commit()

        self.assertAlmostEqual(
            (self._expiry(self.reading) - bought_a).days, 180, delta=1,
            msg="Reading keeps exactly Plan A's term",
        )
        self.assertAlmostEqual(
            (self._expiry(self.writing) - bought_a).days, 270, delta=1,
            msg="Writing gains both plans' days",
        )
        self.assertAlmostEqual(
            (self._expiry(self.speaking) - bought_b).days, 90, delta=1,
            msg="Speaking runs its own 90 days from when it was bought",
        )
        self.assertTrue(self._can(self.speaking), "and is finally open, as it should have been")


if __name__ == "__main__":
    unittest.main()


class InstituteStackingTests(unittest.TestCase):
    """A second institute plan adds seats and extends the term.

    Institute students take their modules from the institute's own assigned
    module list rather than from the plan, so there is no per-module ledger
    here - what a second plan buys an institute is capacity and time.
    """

    def setUp(self) -> None:
        from app.models.institute import Institute
        from app.models.plan import AUDIENCE_INSTITUTES
        from app.models.role import INSTITUTE_ADMIN, INST_INSTRUCTOR

        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        roles = [Role(name=n) for n in (INSTITUTE_ADMIN, INST_INSTRUCTOR, STUDENT)]
        self.db.add_all(roles)
        self.db.flush()
        self.roles = {r.name: r for r in roles}

        self.institute = Institute(
            name="Global Pathways", slug="gp", onboarding_status="published", timezone="Asia/Kolkata"
        )
        self.db.add(self.institute)
        self.db.flush()

        self.actor = User(
            email="sa@example.com", password_hash="x",
            role_id=self.roles[INSTITUTE_ADMIN].id, institute_id=self.institute.id,
            first_name="A", last_name="B",
        )
        self.db.add(self.actor)
        self.db.flush()
        self.AUDIENCE_INSTITUTES = AUDIENCE_INSTITUTES

    def tearDown(self) -> None:
        self.db.close()

    def _plan(self, name, days, students, staff=2):
        plan = Plan(
            name=name, price=1000, currency="INR", duration_days=days,
            student_limit=students, staff_limit=staff, grace_days=0,
            is_active=True, audience=self.AUDIENCE_INSTITUTES, is_published=True,
        )
        self.db.add(plan)
        self.db.flush()
        return plan

    def _assign(self, plan):
        return subscription_service.assign(
            self.db, self.actor, self.institute.id, plan.id, None, "127.0.0.1"
        )

    def test_a_second_plan_adds_its_seats(self):
        from app.dependencies.limits import plan_limit_total

        self._assign(self._plan("Starter 25", 365, 25, staff=3))
        self.assertEqual(plan_limit_total(self.db, self.institute.id, "student_limit"), 25)

        self._assign(self._plan("Top-up 25", 365, 25, staff=2))
        self.assertEqual(
            plan_limit_total(self.db, self.institute.id, "student_limit"), 50,
            "two live 25-seat plans are 50 seats, not 25",
        )
        self.assertEqual(plan_limit_total(self.db, self.institute.id, "staff_limit"), 5)

    def test_the_capacity_screen_and_the_creation_check_agree(self):
        from app.services import institute_admin_service

        self._assign(self._plan("Starter 25", 365, 25))
        self._assign(self._plan("Top-up 10", 365, 10))

        capacity = institute_admin_service.member_capacity(self.db, self.actor)
        self.assertEqual(capacity["limits"]["students"], 35)
        self.assertEqual(
            institute_admin_service._available_student_slots(self.db, self.institute.id), 35,
            "bulk import must see the same capacity the roster shows",
        )

    def test_a_second_term_extends_rather_than_overlaps(self):
        self._assign(self._plan("Year one", 365, 25))
        self._assign(self._plan("Year two", 365, 25))
        rows = (
            self.db.query(Subscription)
            .filter(Subscription.institute_id == self.institute.id)
            .order_by(Subscription.starts_at)
            .all()
        )
        self.assertGreaterEqual(len(rows), 2)
        self.assertEqual(
            rows[-1].starts_at, rows[-2].expires_at,
            "the new term begins where the running one ends",
        )

    def test_an_explicit_start_date_from_a_super_admin_still_wins(self):
        from datetime import datetime as _dt

        self._assign(self._plan("Running", 365, 25))
        backdated = _now() - timedelta(days=10)
        subscription_service.assign(
            self.db, self.actor, self.institute.id,
            self._plan("Backdated agreement", 365, 25).id, backdated, "127.0.0.1",
        )
        rows = (
            self.db.query(Subscription)
            .filter(Subscription.institute_id == self.institute.id)
            .all()
        )
        self.assertTrue(
            any(abs((r.starts_at - backdated).total_seconds()) < 5 for r in rows),
            "an explicitly chosen start date must not be overridden by stacking",
        )

    def test_seats_step_back_down_when_the_first_term_runs_out(self):
        """50 now, 25 later - and the admin can see it coming."""
        self._assign(self._plan("Year one", 365, 25))
        self._assign(self._plan("Year two", 365, 25))

        timeline = subscription_service.capacity_timeline(
            self.db, self.institute.id, "student_limit"
        )
        self.assertEqual([step["seats"] for step in timeline], [50, 25],
                         "capacity is 50 while both terms are unspent, then 25")


class SittingsTests(unittest.TestCase):
    """Paying again buys another go, not just more days.

    Before this, a test could be sat exactly once - enforced by a unique index
    on (user_id, module_id), so no service decision could override it. A student
    who bought the same plan a second time paid full price for more days to look
    at a paper they had already sat, and the only route back in was a Retake
    Request, which is staff-approved goodwill rather than something money buys.
    """

    def setUp(self) -> None:
        from app.models.attempt import ATTEMPT_SUBMITTED

        self.ATTEMPT_SUBMITTED = ATTEMPT_SUBMITTED
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        role = Role(name=STUDENT)
        self.db.add(role)
        self.db.flush()
        self.student = User(
            email="priya@example.com", password_hash="x", role_id=role.id,
            first_name="Priya", last_name="R",
        )
        self.db.add(self.student)
        self.db.flush()

        self.reading = ExamModule(
            title="Reading", module_type="reading", duration_minutes=60,
            created_by_id=self.student.id, status="published", is_visible=True,
        )
        self.db.add(self.reading)
        self.db.flush()

        self.plan = Plan(
            name="Academic 90", price=2500, currency="INR", duration_days=90,
            student_limit=0, staff_limit=0, grace_days=0, is_active=True,
            audience=AUDIENCE_DIRECT, is_published=True,
        )
        self.plan.modules = [self.reading]
        self.db.add(self.plan)
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()

    def _buy(self):
        return subscription_service.subscribe_user(
            self.db, self.student.id, self.plan.id, "127.0.0.1"
        )

    def _sit(self):
        from app.services import attempt_service

        view = attempt_service.start_attempt(self.db, self.student, self.reading)
        attempt = self.db.get(TestAttempt, view["id"] if "id" in view else view["attempt_id"])
        attempt.status = self.ATTEMPT_SUBMITTED
        attempt.submitted_at = _now()
        self.db.commit()
        return attempt

    def _remaining(self):
        return entitlement_service.sittings_remaining(
            self.db, self.student.id, self.reading.id
        )

    def test_one_purchase_gives_one_sitting(self):
        self._buy()
        self.assertEqual(self._remaining(), 1)
        self._sit()
        self.assertEqual(self._remaining(), 0, "the sitting is spent once used")

    def test_buying_again_buys_another_sitting(self):
        from fastapi import HTTPException

        self._buy()
        self._sit()

        with self.assertRaises(HTTPException) as refused:
            self._sit()
        self.assertEqual(refused.exception.status_code, 409)

        self._buy()
        self.assertEqual(self._remaining(), 1, "the second purchase restores a go")
        second = self._sit()
        self.assertEqual(second.sitting_number, 2, "and it is recorded as sitting 2")

    def test_a_third_sitting_is_not_free(self):
        from fastapi import HTTPException

        self._buy()
        self._sit()
        self._buy()
        self._sit()
        with self.assertRaises(HTTPException) as refused:
            self._sit()
        self.assertEqual(refused.exception.status_code, 409,
                         "two purchases buy two sittings, not unlimited")

    def test_the_plan_screen_stops_saying_exhausted_after_a_repeat_purchase(self):
        self._buy()
        self._sit()

        view = subscription_service.my_current_plan_view(self.db, self.student)
        row = next(m for m in view["plan"]["modules"] if m["module_id"] == self.reading.id)
        self.assertTrue(row["is_exhausted"], "with no sitting left it reads exhausted")

        self._buy()
        view = subscription_service.my_current_plan_view(self.db, self.student)
        row = next(m for m in view["plan"]["modules"] if m["module_id"] == self.reading.id)
        self.assertFalse(
            row["is_exhausted"],
            "a card must not say Attempt Exhausted over a test Start would open",
        )
        self.assertEqual(row["sittings_remaining"], 1)


class AlreadyPurchasedTests(unittest.TestCase):
    """A plan the student already holds must read as purchased, and refuse a
    second sale.

    The catalogue computed "have I bought this" from terms that had already
    STARTED. Stacking pushes a second purchase's term into the future, so a plan
    paid for seconds earlier came back as not-entitled and kept rendering a
    Choose plan button - the student could buy the same plan over and over.
    """

    def setUp(self) -> None:
        from app.services import plan_service

        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.plan_service = plan_service

        role = Role(name=STUDENT)
        self.db.add(role)
        self.db.flush()
        self.student = User(
            email="priya@example.com", password_hash="x", role_id=role.id,
            first_name="Priya", last_name="R",
        )
        self.db.add(self.student)
        self.db.flush()
        self.module = ExamModule(
            title="Reading", module_type="reading", duration_minutes=60,
            created_by_id=self.student.id, status="published", is_visible=True,
        )
        self.db.add(self.module)
        self.db.flush()

    def tearDown(self) -> None:
        self.db.close()

    def _plan(self, name, days):
        plan = Plan(
            name=name, price=1000, currency="INR", duration_days=days,
            student_limit=0, staff_limit=0, grace_days=0, is_active=True,
            audience=AUDIENCE_DIRECT, is_published=True,
        )
        plan.modules = [self.module]
        self.db.add(plan)
        self.db.flush()
        return plan

    def _catalogue(self):
        return {row["name"]: row for row in self.plan_service.list_public_plans(self.db, self.student)}

    def test_a_plan_reads_as_purchased_the_moment_it_is_bought(self):
        a = self._plan("Plan A", 90)
        b = self._plan("Plan B", 30)

        self.assertFalse(self._catalogue()["Plan A"]["entitled"])

        subscription_service.subscribe_user(self.db, self.student.id, a.id, None)
        self.assertTrue(self._catalogue()["Plan A"]["entitled"])

        # Plan B's term is SCHEDULED - it begins when Plan A ends. It must still
        # read as purchased, or the student can buy it again immediately.
        subscription_service.subscribe_user(self.db, self.student.id, b.id, None)
        self.assertTrue(
            self._catalogue()["Plan B"]["entitled"],
            "a plan whose term starts later is still bought and paid for",
        )

    def test_a_purchased_card_says_when_it_runs_out(self):
        a = self._plan("Plan A", 90)
        subscription_service.subscribe_user(self.db, self.student.id, a.id, None)
        card = self._catalogue()["Plan A"]
        self.assertIsNotNone(
            card["entitled_until"],
            "a student who cannot see an end date has no idea when to renew",
        )

    def test_buying_a_held_plan_again_is_allowed(self):
        a = self._plan("Plan A", 90)
        subscription_service.subscribe_user(self.db, self.student.id, a.id, None)

        res = self.plan_service.assert_plan_not_already_held(self.db, self.student.id, a.id)
        self.assertIsNone(res)

    def test_a_lapsed_plan_can_be_bought_again(self):
        a = self._plan("Plan A", 30)
        old = Subscription(
            user_id=self.student.id, plan_id=a.id,
            starts_at=_now() - timedelta(days=400),
            expires_at=_now() - timedelta(days=370), grace_days=0,
        )
        self.db.add(old)
        self.db.commit()

        self.assertFalse(self._catalogue()["Plan A"]["entitled"])
        # Must not raise - renewing after it ends is the whole point.
        self.plan_service.assert_plan_not_already_held(self.db, self.student.id, a.id)

    def test_a_plan_in_its_grace_period_still_counts_as_held(self):
        a = self._plan("Plan A", 30)
        a.grace_days = 7
        self.db.add(
            Subscription(
                user_id=self.student.id, plan_id=a.id,
                starts_at=_now() - timedelta(days=32),
                expires_at=_now() - timedelta(days=2), grace_days=7,
            )
        )
        self.db.commit()
        self.assertTrue(
            self._catalogue()["Plan A"]["entitled"],
            "the term is still theirs while a renewal clears",
        )

    def test_cancelled_and_ready_attempts_do_not_consume_sittings(self):
        a = self._plan("Plan A", 90)
        subscription_service.subscribe_user(self.db, self.student.id, a.id, None)

        # Confirm we have 1 sitting remaining
        self.assertEqual(entitlement_service.sittings_remaining(self.db, self.student.id, self.module.id), 1)

        # Create a ready attempt
        ready_attempt = TestAttempt(
            user_id=self.student.id,
            module_id=self.module.id,
            status="ready",
            is_retake=False,
            expires_at=_now() + timedelta(minutes=60),
            sitting_number=1,
        )
        self.db.add(ready_attempt)
        self.db.commit()

        # It should still have 1 sitting remaining, and starting a test should not raise conflict
        self.assertEqual(entitlement_service.sittings_remaining(self.db, self.student.id, self.module.id), 1)

        # Create a cancelled attempt
        cancelled_attempt = TestAttempt(
            user_id=self.student.id,
            module_id=self.module.id,
            status="cancelled",
            is_retake=False,
            expires_at=_now() + timedelta(minutes=60),
            sitting_number=2,
        )
        self.db.add(cancelled_attempt)
        self.db.commit()

        self.assertEqual(entitlement_service.sittings_remaining(self.db, self.student.id, self.module.id), 1)
