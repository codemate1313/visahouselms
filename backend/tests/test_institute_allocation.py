"""Provisions are allocated straight to an institute on its own form. The plan
that enforces them is derived by the server - private to that institute, never
listed, and never capping how many tests its students take.
"""
import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.models import Base
from app.models.exam_module import ExamModule, InstituteModule
from app.models.institute import Institute
from app.models.plan import AUDIENCE_DIRECT, AUDIENCE_INSTITUTES, Plan
from app.models.role import INSTITUTE_ADMIN, SA_INSTRUCTOR, SUPER_ADMIN, Role
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.institute import InstituteCreate, InstituteUpdate
from app.services import institute_service, plan_service, subscription_service


def _allocation(**overrides) -> dict:
    payload = {
        "student_limit": 20,
        "staff_limit": 2,
        "access_duration_days": 180,
        "grace_days": 7,
    }
    payload.update(overrides)
    return payload


class InstituteAllocationTests(unittest.TestCase):
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
            email="super@agreement.test", password_hash=hash_password("SuperPassword!1"),
            role_id=by_name[SUPER_ADMIN].id, first_name="Super", last_name="Admin", is_active=True,
        )
        self.instructor = User(
            email="author@agreement.test", password_hash=hash_password("AuthorPassword!1"),
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

    def _institute(self, name: str = "Agreement Academy") -> Institute:
        created = institute_service.create_institute(
            self.db, self.actor, name, None, f"admin-{name.replace(' ', '-').lower()}@agreement.test",
            "Institute", "Admin", {}, 24, None,
        )
        return institute_service.get_institute_or_404(self.db, created["id"])

    def _allocate(self, institute: Institute, **overrides) -> dict:
        return institute_service.update_institute(
            self.db, self.actor, institute.id,
            {**_allocation(module_ids=[self.module.id]), **overrides},
            None,
        )

    def test_allocation_sets_limits_courses_and_subscription(self) -> None:
        institute = self._institute()

        result = self._allocate(institute, agreed_amount=9000, currency="INR")

        self.db.refresh(institute)
        self.assertEqual(institute.student_limit, 20)
        self.assertEqual(institute.staff_limit, 2)
        self.assertEqual(institute.access_duration_days, 180)
        self.assertEqual(result["module_ids"], [self.module.id])
        self.assertEqual(result["allocation"], {
            "student_limit": 20, "staff_limit": 2, "duration_days": 180, "grace_days": 7, "module_count": 1,
        })

        links = self.db.query(InstituteModule).filter(InstituteModule.institute_id == institute.id).all()
        self.assertEqual([link.module_id for link in links], [self.module.id])

        subscription = self.db.query(Subscription).filter(Subscription.institute_id == institute.id).one()
        self.assertEqual(subscription.plan_id, institute.onboarding_plan_id)
        self.assertEqual(subscription.grace_days, 7)
        self.assertEqual(result["subscription_state"], "active")

    def test_the_backing_plan_is_derived_not_authored(self) -> None:
        institute = self._institute("Derived Plan Academy")

        self._allocate(institute, agreed_amount=9000, currency="INR")

        self.db.refresh(institute)
        plan = self.db.get(Plan, institute.onboarding_plan_id)
        # Nothing about the plan is typed in: its identity comes from the
        # institute and its price from the agreed amount.
        self.assertEqual(plan.name, f"Agreement {institute.slug} {institute.id}")
        self.assertEqual(str(plan.price), "9000.00")
        self.assertEqual(plan.currency, "INR")
        self.assertEqual(plan.duration_days, 180)

    def test_institute_students_take_unlimited_tests(self) -> None:
        institute = self._institute("Unlimited Tests Academy")

        self._allocate(institute)

        self.db.refresh(institute)
        plan = self.db.get(Plan, institute.onboarding_plan_id)
        self.assertEqual(plan.test_limit, 0)
        # NULL on the institute and None in the subscription quota both mean
        # "not metered" - nothing anywhere caps attempts.
        self.assertIsNone(institute.test_limit)
        status = subscription_service.subscription_status(self.db, institute.id)
        self.assertIsNone(status["limits"]["tests"])

    def test_the_plan_is_private_to_its_institute(self) -> None:
        institute = self._institute("Private Plan Academy")

        self._allocate(institute)

        self.db.refresh(institute)
        plan = self.db.get(Plan, institute.onboarding_plan_id)
        self.assertTrue(plan.is_internal)
        self.assertFalse(plan.is_published)
        # It backs one agreement, so it appears in no catalogue listing.
        self.assertNotIn(plan.id, {row["id"] for row in plan_service.list_plans(self.db)})
        self.assertNotIn(plan.id, {row["id"] for row in plan_service.list_plans(self.db, audience=AUDIENCE_INSTITUTES)})
        self.assertNotIn(plan.id, {row["id"] for row in plan_service.list_plans(self.db, audience=AUDIENCE_DIRECT)})

    def test_reallocating_rewrites_the_plan_in_place(self) -> None:
        institute = self._institute("Reallocate Academy")
        self._allocate(institute)
        first_plan_id = self.db.get(Institute, institute.id).onboarding_plan_id

        institute_service.update_institute(
            self.db, self.actor, institute.id,
            {**_allocation(student_limit=99), "module_ids": [self.second_module.id]},
            None,
        )

        self.db.refresh(institute)
        # Same plan row, new numbers - re-allocating must not leave a trail of
        # near-identical plans behind.
        self.assertEqual(institute.onboarding_plan_id, first_plan_id)
        self.assertEqual(self.db.query(Plan).count(), 1)
        plan = self.db.get(Plan, first_plan_id)
        self.assertEqual(plan.student_limit, 99)
        self.assertEqual([module.id for module in plan.modules], [self.second_module.id])

        self.assertEqual(institute.student_limit, 99)
        links = self.db.query(InstituteModule).filter(InstituteModule.institute_id == institute.id).all()
        self.assertEqual([link.module_id for link in links], [self.second_module.id])
        # The running subscription reads its seats from the plan, so it is kept
        # rather than reissued - editing does not restart the access clock.
        self.assertEqual(self.db.query(Subscription).filter(Subscription.institute_id == institute.id).count(), 1)

    def test_resaving_the_same_allocation_is_a_no_op(self) -> None:
        institute = self._institute("Idempotent Academy")
        self._allocate(institute)
        plan_id = self.db.get(Institute, institute.id).onboarding_plan_id

        self._allocate(institute)

        self.db.refresh(institute)
        self.assertEqual(institute.onboarding_plan_id, plan_id)
        self.assertEqual(self.db.query(Plan).count(), 1)
        self.assertEqual(self.db.query(Subscription).filter(Subscription.institute_id == institute.id).count(), 1)

    def test_renaming_the_institute_renames_its_derived_plan(self) -> None:
        institute = self._institute("Rename Academy")
        self._allocate(institute)
        plan_id = self.db.get(Institute, institute.id).onboarding_plan_id

        institute_service.update_institute(
            self.db, self.actor, institute.id, {"name": "Renamed Academy", **_allocation(module_ids=[self.module.id])}, None
        )

        self.db.refresh(institute)
        plan = self.db.get(Plan, plan_id)
        self.assertEqual(institute.onboarding_plan_id, plan_id)
        self.assertEqual(plan.name, f"Agreement {institute.slug} {institute.id}")

    def test_an_edit_without_allocation_leaves_the_plan_alone(self) -> None:
        institute = self._institute("Untouched Plan Academy")
        self._allocate(institute)
        plan_id = self.db.get(Institute, institute.id).onboarding_plan_id

        institute_service.update_institute(
            self.db, self.actor, institute.id, {"agreement_notes": "renegotiated wording"}, None
        )

        self.db.refresh(institute)
        self.assertEqual(institute.onboarding_plan_id, plan_id)
        self.assertEqual(self.db.query(Plan).count(), 1)
        self.assertEqual(self.db.query(Subscription).filter(Subscription.institute_id == institute.id).count(), 1)

    def test_a_legacy_internal_plan_is_adopted_not_duplicated(self) -> None:
        """An institute onboarded before the plan link existed already has a
        plan under the derived name; allocating must reuse it."""
        institute = self._institute("Legacy Academy")
        legacy = Plan(
            name=f"Agreement {institute.slug} {institute.id}", price=0, currency="INR", duration_days=365,
            student_limit=5, staff_limit=1, test_limit=0, grace_days=0,
            audience=AUDIENCE_INSTITUTES, is_active=True, is_internal=True, modules=[self.module],
        )
        self.db.add(legacy)
        self.db.commit()

        self._allocate(institute)

        self.db.refresh(institute)
        self.assertEqual(institute.onboarding_plan_id, legacy.id)
        self.assertEqual(self.db.query(Plan).count(), 1)
        self.assertEqual(self.db.get(Plan, legacy.id).student_limit, 20)

    def test_unpublished_course_is_refused(self) -> None:
        draft = ExamModule(
            title="Draft Course", module_type="writing", status="draft",
            duration_minutes=20, created_by_id=self.instructor.id,
        )
        self.db.add(draft)
        self.db.commit()
        institute = self._institute("Draft Course Academy")

        with self.assertRaises(HTTPException) as raised:
            institute_service.update_institute(
                self.db, self.actor, institute.id, {**_allocation(), "module_ids": [draft.id]}, None
            )
        self.assertEqual(raised.exception.status_code, 400)
        self.db.rollback()

    def test_no_plan_identity_is_accepted_over_the_wire(self) -> None:
        # The plan is derived, so nothing about it can be named or priced by a
        # caller - only the provisions themselves are settable.
        for schema in (InstituteCreate, InstituteUpdate):
            fields = set(schema.model_fields)
            self.assertNotIn("plan", fields)
            self.assertNotIn("plan_id", fields)
            self.assertNotIn("test_limit", fields)
            self.assertIn("student_limit", fields)
            self.assertIn("access_duration_days", fields)


if __name__ == "__main__":
    unittest.main()
