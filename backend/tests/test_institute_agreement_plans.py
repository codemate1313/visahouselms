"""Assigning an institute plan while creating/editing an institute.

The Super Admin picks a plan from the institute catalogue - or authors one
inline, which lands in that same catalogue - and the institute's seats,
validity, courses and subscription all follow from it.
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
from app.services import institute_service, plan_service


class InstituteAgreementPlanTests(unittest.TestCase):
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
        self.db.add(self.module)
        self.db.flush()

        self.institute_plan = Plan(
            name="Campus 50", price=12000, currency="INR", duration_days=365,
            student_limit=50, staff_limit=3, test_limit=0, grace_days=5,
            audience=AUDIENCE_INSTITUTES, is_active=True, modules=[self.module],
        )
        self.db.add(self.institute_plan)
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

    def test_assigning_a_catalogue_plan_sets_limits_courses_and_subscription(self) -> None:
        institute = self._institute()

        result = institute_service.update_institute(
            self.db, self.actor, institute.id,
            {"plan_id": self.institute_plan.id, "agreed_amount": 9000, "currency": "INR"},
            None,
        )

        self.db.refresh(institute)
        self.assertEqual(institute.onboarding_plan_id, self.institute_plan.id)
        self.assertEqual(institute.student_limit, 50)
        self.assertEqual(institute.staff_limit, 3)
        self.assertEqual(institute.access_duration_days, 365)
        # test_limit 0 on the plan means the agreement does not meter attempts.
        self.assertIsNone(institute.test_limit)
        self.assertEqual(result["module_ids"], [self.module.id])
        self.assertEqual(result["plan"]["name"], "Campus 50")
        # The negotiated amount stays independent of the plan's list price.
        self.assertEqual(result["agreed_amount"], "9000.00")

        subscription = self.db.query(Subscription).filter(Subscription.institute_id == institute.id).one()
        self.assertEqual(subscription.plan_id, self.institute_plan.id)
        self.assertEqual(subscription.grace_days, 5)
        self.assertEqual(result["subscription_state"], "active")

    def test_new_plan_authored_inline_lands_in_the_institute_catalogue(self) -> None:
        institute = self._institute("Inline Plan Academy")

        result = institute_service.update_institute(
            self.db, self.actor, institute.id,
            {
                "new_plan": {
                    "name": "Inline Annual", "description": "Authored during institute setup",
                    "price": 30000, "currency": "INR", "duration_days": 180,
                    "student_limit": 20, "staff_limit": 2, "test_limit": 40, "grace_days": 7,
                    "module_ids": [self.module.id], "features": [],
                }
            },
            None,
        )

        plan = self.db.query(Plan).filter(Plan.name == "Inline Annual").one()
        self.assertFalse(plan.is_internal)
        self.assertEqual(plan.audience, AUDIENCE_INSTITUTES)
        self.assertFalse(plan.is_published)
        # Reusable for the next institute: it shows up on the Institute Plans
        # screen and nowhere near the direct-student catalogue.
        catalogue = {row["id"] for row in plan_service.list_plans(self.db, audience=AUDIENCE_INSTITUTES)}
        self.assertIn(plan.id, catalogue)
        self.assertNotIn(plan.id, {row["id"] for row in plan_service.list_plans(self.db, audience=AUDIENCE_DIRECT)})

        self.db.refresh(institute)
        self.assertEqual(institute.onboarding_plan_id, plan.id)
        self.assertEqual(institute.student_limit, 20)
        self.assertEqual(institute.access_duration_days, 180)
        self.assertEqual(institute.test_limit, 40)
        self.assertEqual(result["plan"]["module_count"], 1)
        links = self.db.query(InstituteModule).filter(InstituteModule.institute_id == institute.id).all()
        self.assertEqual([link.module_id for link in links], [self.module.id])
        self.assertEqual(
            self.db.query(Subscription).filter(Subscription.institute_id == institute.id).one().plan_id, plan.id
        )

    def test_direct_student_plan_cannot_be_assigned(self) -> None:
        direct = Plan(
            name="Direct Starter", price=999, currency="INR", duration_days=30,
            student_limit=1, staff_limit=0, test_limit=20, grace_days=0,
            audience=AUDIENCE_DIRECT, is_active=True, modules=[self.module],
        )
        self.db.add(direct)
        self.db.commit()
        institute = self._institute("Direct Refused Academy")

        with self.assertRaises(HTTPException) as raised:
            institute_service.update_institute(self.db, self.actor, institute.id, {"plan_id": direct.id}, None)
        self.assertEqual(raised.exception.status_code, 400)
        self.db.rollback()
        self.db.refresh(institute)
        self.assertIsNone(institute.onboarding_plan_id)

    def test_deactivated_plan_is_refused(self) -> None:
        self.institute_plan.is_active = False
        self.db.commit()
        institute = self._institute("Deactivated Plan Academy")

        with self.assertRaises(HTTPException) as raised:
            institute_service.update_institute(
                self.db, self.actor, institute.id, {"plan_id": self.institute_plan.id}, None
            )
        self.assertEqual(raised.exception.status_code, 400)
        self.db.rollback()

    def test_duplicate_plan_name_leaves_the_institute_untouched(self) -> None:
        institute = self._institute("Duplicate Name Academy")

        with self.assertRaises(HTTPException) as raised:
            institute_service.update_institute(
                self.db, self.actor, institute.id,
                {
                    "name": "Renamed Academy",
                    "new_plan": {
                        "name": "Campus 50", "price": 100, "currency": "INR", "duration_days": 30,
                        "student_limit": 1, "staff_limit": 0, "test_limit": 0, "grace_days": 0,
                        "module_ids": [self.module.id], "features": [],
                    },
                },
                None,
            )
        self.assertEqual(raised.exception.status_code, 409)
        self.db.rollback()
        self.db.refresh(institute)
        # The plan is resolved before anything is written, so the rename is not
        # half-applied and no second "Campus 50" exists.
        self.assertEqual(institute.name, "Duplicate Name Academy")
        self.assertEqual(self.db.query(Plan).filter(Plan.name == "Campus 50").count(), 1)

    def test_reassigning_the_same_plan_does_not_stack_subscriptions(self) -> None:
        institute = self._institute("Idempotent Academy")
        institute_service.update_institute(self.db, self.actor, institute.id, {"plan_id": self.institute_plan.id}, None)
        institute_service.update_institute(
            self.db, self.actor, institute.id, {"plan_id": self.institute_plan.id, "agreement_notes": "edited"}, None
        )

        self.assertEqual(self.db.query(Subscription).filter(Subscription.institute_id == institute.id).count(), 1)


if __name__ == "__main__":
    unittest.main()
