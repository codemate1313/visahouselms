"""Editing an institute that already has an agreement.

The first allocation is well covered (test_institute_allocation). These tests
cover the *second* save onwards - re-negotiating an agreement that is already
running - where the institute row, its derived plan and the live subscription
can drift apart from each other.
"""
import unittest
from datetime import timedelta
from decimal import Decimal

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.models import Base
from app.models.exam_module import ExamModule, InstituteModule
from app.models.institute import Institute
from app.models.plan import Plan
from app.models.role import INSTITUTE_ADMIN, SA_INSTRUCTOR, SUPER_ADMIN, Role
from app.models.subscription import Subscription
from app.models.user import User
from app.services import institute_service, onboarding_service, subscription_service


def _allocation(**overrides) -> dict:
    payload = {
        "student_limit": 20,
        "staff_limit": 2,
        "access_duration_days": 180,
        "grace_days": 7,
    }
    payload.update(overrides)
    return payload


class InstitutePlanEditTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")

        @event.listens_for(self.engine, "connect")
        def enable_foreign_keys(dbapi_connection, _connection_record) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        roles = [Role(name=name) for name in (INSTITUTE_ADMIN, SA_INSTRUCTOR, SUPER_ADMIN)]
        self.db.add_all(roles)
        self.db.flush()
        by_name = {role.name: role for role in roles}

        self.actor = User(
            email="super@edit.test", password_hash=hash_password("SuperPassword!1"),
            role_id=by_name[SUPER_ADMIN].id, first_name="Super", last_name="Admin", is_active=True,
        )
        self.instructor = User(
            email="author@edit.test", password_hash=hash_password("AuthorPassword!1"),
            role_id=by_name[SA_INSTRUCTOR].id, first_name="Course", last_name="Author", is_active=True,
        )
        self.db.add_all([self.actor, self.instructor])
        self.db.flush()

        self.module = ExamModule(
            title="Agreement Course", module_type="reading", status="published",
            duration_minutes=45, created_by_id=self.instructor.id,
        )
        self.second_module = ExamModule(
            title="Second Course", module_type="listening", status="published",
            duration_minutes=30, created_by_id=self.instructor.id,
        )
        self.db.add_all([self.module, self.second_module])
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _institute(self, name: str) -> Institute:
        created = institute_service.create_institute(
            self.db, self.actor, name, None, f"admin-{name.replace(' ', '-').lower()}@edit.test",
            "Institute", "Admin", 24, None,
        )
        return institute_service.get_institute_or_404(self.db, created["id"])

    def _allocate(self, institute: Institute, **overrides) -> dict:
        return institute_service.update_institute(
            self.db, self.actor, institute.id,
            {**_allocation(module_ids=[self.module.id]), **overrides},
            None,
        )

    def _plan(self, institute: Institute) -> Plan:
        self.db.refresh(institute)
        return self.db.get(Plan, institute.onboarding_plan_id)

    # --- partial edits -----------------------------------------------------

    def test_editing_one_provision_keeps_the_others(self) -> None:
        """PATCH is partial: raising the seat count must not silently rewrite
        the rest of the agreement."""
        institute = self._institute("Partial Edit Academy")
        self._allocate(institute, agreed_amount=9000, currency="INR")

        institute_service.update_institute(
            self.db, self.actor, institute.id, {"student_limit": 40}, None
        )

        plan = self._plan(institute)
        self.assertEqual(plan.student_limit, 40)
        self.assertEqual(plan.grace_days, 7, "grace period was wiped by an unrelated edit")
        self.assertEqual(plan.duration_days, 180)
        self.assertEqual([module.id for module in plan.modules], [self.module.id])

    def test_repricing_the_agreement_reprices_the_plan(self) -> None:
        """The plan's price is what b2b payments bill against
        (payment_service.create_b2b_plan_payment), so a re-negotiated amount
        has to reach it."""
        institute = self._institute("Reprice Academy")
        self._allocate(institute, agreed_amount=9000, currency="INR")

        institute_service.update_institute(
            self.db, self.actor, institute.id, {"agreed_amount": 25000, "currency": "USD"}, None
        )

        self.db.refresh(institute)
        plan = self._plan(institute)
        self.assertEqual(institute.agreed_amount, Decimal("25000"))
        self.assertEqual(str(plan.price), "25000.00", "plan still bills the old agreed amount")
        self.assertEqual(plan.currency, "USD")

    def test_removing_every_course_removes_it_from_the_plan_too(self) -> None:
        institute = self._institute("Empty Courses Academy")
        self._allocate(institute)

        institute_service.update_institute(
            self.db, self.actor, institute.id, {**_allocation(), "module_ids": []}, None
        )

        links = self.db.query(InstituteModule).filter(InstituteModule.institute_id == institute.id).all()
        self.assertEqual(links, [])
        self.assertEqual(
            [module.id for module in self._plan(institute).modules], [],
            "institute has no courses but its plan still grants them",
        )

    # --- the running subscription -----------------------------------------

    def test_a_longer_grace_period_reaches_the_running_subscription(self) -> None:
        """grace_days is copied onto the subscription row at assign time, and
        access_window/history read it from there - so an edited grace period
        that stays on the plan changes nothing about actual access."""
        institute = self._institute("Grace Edit Academy")
        self._allocate(institute, grace_days=7)

        institute_service.update_institute(
            self.db, self.actor, institute.id, {**_allocation(grace_days=30)}, None
        )

        self.assertEqual(self._plan(institute).grace_days, 30)
        subscription = self.db.query(Subscription).filter(Subscription.institute_id == institute.id).one()
        self.assertEqual(subscription.grace_days, 30, "subscription kept the old grace period")
        self.assertEqual(subscription_service.access_window(self.db, institute.id)["grace_days"], 30)

    def test_a_longer_agreement_moves_the_expiry_the_institute_counts_down_to(self) -> None:
        institute = self._institute("Extended Term Academy")
        self._allocate(institute, access_duration_days=30)
        subscription = self.db.query(Subscription).filter(Subscription.institute_id == institute.id).one()
        started_at = subscription.starts_at

        self._allocate(institute, access_duration_days=60)

        self.db.refresh(subscription)
        # Re-cut from where the term began, not restarted from today.
        self.assertEqual(subscription.starts_at, started_at)
        self.assertEqual(subscription.expires_at, started_at + timedelta(days=60))
        status = subscription_service.subscription_status(self.db, institute.id)
        # The full 60 on day one: the countdown reads what was granted.
        self.assertEqual(status["subscription"]["days_remaining"], 60)

    def test_a_queued_renewal_follows_the_term_it_waits_on(self) -> None:
        """Extending the running term must not leave a gap before - or an
        overlap with - the renewal queued behind it."""
        institute = self._institute("Queued Renewal Academy")
        self._allocate(institute, access_duration_days=30)
        subscription_service.renew(self.db, self.actor, institute.id, None, None)

        self._allocate(institute, access_duration_days=60)

        running, queued = sorted(
            self.db.query(Subscription).filter(Subscription.institute_id == institute.id).all(),
            key=lambda row: row.starts_at,
        )
        self.assertEqual(queued.starts_at, running.expires_at)
        self.assertEqual(queued.expires_at, running.expires_at + timedelta(days=60))

    def test_shrinking_the_catalogue_does_not_extend_a_finished_term(self) -> None:
        """A term already past its grace window stays over - re-terming it
        would hand access back."""
        institute = self._institute("Finished Term Academy")
        self._allocate(institute, access_duration_days=30, grace_days=0)
        subscription = self.db.query(Subscription).filter(Subscription.institute_id == institute.id).one()
        subscription.starts_at -= timedelta(days=90)
        subscription.expires_at -= timedelta(days=90)
        self.db.commit()

        self._allocate(institute, access_duration_days=365, grace_days=0)

        self.db.refresh(subscription)
        self.assertLess(subscription.expires_at, subscription_service._now())
        _, state = subscription_service.current_subscription(self.db, institute.id)
        self.assertEqual(state, subscription_service.STATE_EXPIRED)

    def test_quota_reports_courses_allocated_out_of_the_catalogue(self) -> None:
        institute = self._institute("Course Quota Academy")
        self._allocate(institute)  # one of the two published courses

        status = subscription_service.subscription_status(self.db, institute.id)
        self.assertEqual(status["usage"]["courses"], 1)
        self.assertEqual(status["limits"]["courses"], 2)

    # --- an agreement created by the onboarding wizard ---------------------

    def _published_onboarding(self, name: str) -> Institute:
        onboarding_service.create_draft(
            self.db, self.actor,
            {
                "name": name, "contact_email": None, "admin_email": f"wizard-{name.replace(' ', '-').lower()}@edit.test",
                "admin_first_name": "Wizard", "admin_last_name": "Admin",
                "agreed_amount": 9000, "amount_received": 9000, "currency": "INR",
                "student_limit": 20, "staff_limit": 2, "access_duration_days": 180,
                "module_ids": [self.module.id],
                "primary_color": "#e53935", "secondary_color": "#17191d",
            },
            None,
        )
        institute = self.db.query(Institute).filter(Institute.name == name).one()
        onboarding_service.publish(self.db, self.actor, institute.id, None)
        self.db.refresh(institute)
        return institute

    def test_a_published_onboarding_records_which_plan_backs_it(self) -> None:
        institute = self._published_onboarding("Wizard Academy")

        subscription = self.db.query(Subscription).filter(Subscription.institute_id == institute.id).one()
        self.assertEqual(
            institute.onboarding_plan_id, subscription.plan_id,
            "institute does not point at the plan the wizard created for it",
        )

    def test_editing_a_renamed_wizard_institute_edits_the_plan_it_runs_on(self) -> None:
        """The derived plan is found by name when the institute has no plan
        link - and renaming the institute changes that name."""
        institute = self._published_onboarding("Renamed Wizard Academy")
        subscription = self.db.query(Subscription).filter(Subscription.institute_id == institute.id).one()
        enforcing_plan_id = subscription.plan_id

        institute_service.update_institute(
            self.db, self.actor, institute.id,
            {"name": "Wizard Academy Renamed", **_allocation(student_limit=99, module_ids=[self.module.id])},
            None,
        )

        self.db.refresh(institute)
        # What the platform actually enforces (dependencies/limits) is the plan
        # the subscription points at, so the new seat count has to land there.
        self.assertEqual(
            self.db.get(Plan, enforcing_plan_id).student_limit, 99,
            "the edit did not change what is enforced for this institute",
        )
        self.assertEqual(institute.onboarding_plan_id, enforcing_plan_id)
        self.assertEqual(self.db.query(Plan).count(), 1, "the edit left a second internal plan behind")


    # --- history / renewal display ----------------------------------------

    def test_a_future_dated_renewal_is_not_reported_as_running(self) -> None:
        """Renewing before expiry starts the new term at the old expiry, so
        two rows are open at once - the history table shows both as Active."""
        institute = self._institute("Renewal Display Academy")
        self._allocate(institute)
        subscription_service.renew(self.db, self.actor, institute.id, None, None)

        rows = subscription_service.history(self.db, institute.id)
        self.assertEqual(len(rows), 2)
        active = [row for row in rows if row["state"] == "active"]
        self.assertEqual(len(active), 1, "a term that has not started yet is shown as active")

    def test_a_scheduled_term_does_not_grant_access_on_its_own(self) -> None:
        """Nothing is running yet, so the institute has no access - the term
        being paid for and dated in the future does not change that."""
        institute = self._institute("Future Start Academy")
        self._allocate(institute)
        subscription = self.db.query(Subscription).filter(Subscription.institute_id == institute.id).one()
        subscription.starts_at = subscription.starts_at + timedelta(days=10)
        subscription.expires_at = subscription.expires_at + timedelta(days=10)
        self.db.commit()

        _, state = subscription_service.current_subscription(self.db, institute.id)
        self.assertEqual(state, subscription_service.STATE_SCHEDULED)

    def test_an_expired_term_still_ends_access_when_a_renewal_is_queued(self) -> None:
        """The renewal picks up exactly where the old term stops, so there is
        no window in which the institute is treated as expired."""
        institute = self._institute("Handover Academy")
        self._allocate(institute)
        subscription_service.renew(self.db, self.actor, institute.id, None, None)
        running = min(
            self.db.query(Subscription).filter(Subscription.institute_id == institute.id).all(),
            key=lambda row: row.expires_at,
        )
        # Wind the clock past the first term by moving both terms back.
        for row in self.db.query(Subscription).filter(Subscription.institute_id == institute.id).all():
            row.starts_at -= timedelta(days=181)
            row.expires_at -= timedelta(days=181)
        self.db.commit()

        current, state = subscription_service.current_subscription(self.db, institute.id)
        self.assertEqual(state, subscription_service.STATE_ACTIVE)
        self.assertNotEqual(current.id, running.id, "handed over to the renewed term")

    def test_days_remaining_counts_the_term_that_is_running(self) -> None:
        institute = self._institute("Days Remaining Academy")
        self._allocate(institute)  # 180-day term
        subscription_service.renew(self.db, self.actor, institute.id, None, None)

        status = subscription_service.subscription_status(self.db, institute.id)
        # 180 days left on the running term, not 360 on the queued one.
        self.assertLessEqual(status["subscription"]["days_remaining"], 180)


if __name__ == "__main__":
    unittest.main()
