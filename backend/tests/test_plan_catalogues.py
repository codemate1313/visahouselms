import unittest
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.models import Base
from app.models.institute import Institute
from app.models.plan import AUDIENCE_DIRECT, AUDIENCE_INSTITUTES, Plan
from app.models.role import STUDENT, SUPER_ADMIN, Role
from app.models.subscription import Subscription
from app.models.user import User
from app.services import plan_service, subscription_service


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class PlanCatalogueSeparationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        roles = [Role(name=name) for name in (STUDENT, SUPER_ADMIN)]
        self.db.add_all(roles)
        self.db.flush()

        self.institute = Institute(name="North Academy", slug="north")
        self.db.add(self.institute)
        self.db.flush()

        self.actor = User(
            email="super@example.com",
            password_hash=hash_password("SuperPassword!1"),
            role_id=next(role.id for role in roles if role.name == SUPER_ADMIN),
            first_name="Super",
            last_name="Admin",
            is_active=True,
        )
        self.student = User(
            email="sam@example.com",
            password_hash=hash_password("StudentPassword!1"),
            role_id=next(role.id for role in roles if role.name == STUDENT),
            first_name="Sam",
            last_name="Student",
            is_active=True,
        )
        self.db.add_all([self.actor, self.student])
        self.db.flush()

        self.direct_plan = self._plan("Direct Starter", AUDIENCE_DIRECT, published=True)
        self.institute_plan = self._plan("Campus 50", AUDIENCE_INSTITUTES)
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _plan(self, name: str, audience: str, published: bool = False) -> Plan:
        plan = Plan(
            name=name,
            price=Decimal("1000"),
            currency="INR",
            duration_days=30,
            student_limit=50,
            staff_limit=5,
            test_limit=20,
            grace_days=7,
            is_active=True,
            audience=audience,
            is_published=published,
        )
        self.db.add(plan)
        self.db.flush()
        return plan

    def test_listing_returns_one_catalogue_at_a_time(self):
        direct = plan_service.list_plans(self.db, audience=AUDIENCE_DIRECT)
        institutes = plan_service.list_plans(self.db, audience=AUDIENCE_INSTITUTES)

        self.assertEqual([item["name"] for item in direct], ["Direct Starter"])
        self.assertEqual([item["name"] for item in institutes], ["Campus 50"])
        self.assertEqual(len(plan_service.list_plans(self.db)), 2)

    def test_unknown_audience_is_rejected(self):
        with self.assertRaises(HTTPException) as caught:
            plan_service.list_plans(self.db, audience="both")
        self.assertEqual(caught.exception.status_code, 400)

    def test_institute_cannot_be_assigned_a_direct_plan(self):
        with self.assertRaises(HTTPException) as caught:
            subscription_service.assign(
                self.db, self.actor, self.institute.id, self.direct_plan.id, None, None
            )
        self.assertEqual(caught.exception.status_code, 400)
        self.assertIn("direct-student plan", caught.exception.detail)

    def test_institute_plan_assigns_and_renews(self):
        subscription_service.assign(
            self.db, self.actor, self.institute.id, self.institute_plan.id, None, None
        )
        renewed = subscription_service.renew(self.db, self.actor, self.institute.id, None, None)
        self.assertEqual(renewed["plan_id"], self.institute_plan.id)

    def test_renewing_onto_a_direct_plan_is_refused(self):
        subscription_service.assign(
            self.db, self.actor, self.institute.id, self.institute_plan.id, None, None
        )
        with self.assertRaises(HTTPException) as caught:
            subscription_service.renew(
                self.db, self.actor, self.institute.id, self.direct_plan.id, None
            )
        self.assertEqual(caught.exception.status_code, 400)

    def test_student_cannot_subscribe_to_an_institute_plan(self):
        with self.assertRaises(HTTPException) as caught:
            subscription_service.subscribe_user(
                self.db, self.student.id, self.institute_plan.id, None
            )
        self.assertEqual(caught.exception.status_code, 400)
        self.assertIn("institute plan", caught.exception.detail)

    def test_public_pricing_page_lists_direct_plans_only(self):
        self.institute_plan.is_published = True
        self.db.commit()

        landing = plan_service.list_landing_plans(self.db)
        self.assertEqual([item["name"] for item in landing], ["Direct Starter"])

        student_view = plan_service.list_public_plans(self.db, self.student)
        self.assertEqual([item["name"] for item in student_view], ["Direct Starter"])

    def test_last_live_plan_guard_ignores_institute_plans(self):
        # the only live plan is the direct one, so taking it down is refused ...
        with self.assertRaises(HTTPException):
            plan_service.set_plan_active(self.db, self.actor, self.direct_plan.id, False, None)

        # ... while an institute plan is never "live" and comes down freely
        self.institute_plan.is_published = True
        self.db.commit()
        result = plan_service.set_plan_active(self.db, self.actor, self.institute_plan.id, False, None)
        self.assertFalse(result["is_active"])

    def test_plan_with_subscribers_cannot_switch_catalogue(self):
        subscription_service.assign(
            self.db, self.actor, self.institute.id, self.institute_plan.id, None, None
        )
        with self.assertRaises(HTTPException) as caught:
            plan_service.update_plan(
                self.db, self.actor, self.institute_plan.id, {"audience": AUDIENCE_DIRECT}, None
            )
        self.assertEqual(caught.exception.status_code, 400)

    def test_unsubscribed_plan_can_still_switch_catalogue(self):
        updated = plan_service.update_plan(
            self.db, self.actor, self.institute_plan.id, {"audience": AUDIENCE_DIRECT}, None
        )
        self.assertEqual(updated["audience"], AUDIENCE_DIRECT)

    def test_new_plans_default_to_the_direct_catalogue(self):
        created = plan_service.create_plan(
            self.db,
            self.actor,
            {
                "name": "Unspecified",
                "price": 500,
                "duration_days": 30,
                "student_limit": 1,
                "test_limit": 10,
                "staff_limit": 0,
            },
            None,
        )
        self.assertEqual(created["audience"], AUDIENCE_DIRECT)

    def test_internal_onboarding_plans_bypass_the_audience_check(self):
        internal = self._plan("Onboarding draft", AUDIENCE_INSTITUTES)
        internal.is_internal = True
        self.db.commit()

        result = subscription_service.assign(
            self.db, self.actor, self.institute.id, internal.id, None, None
        )
        self.assertEqual(result["plan_id"], internal.id)
        self.assertEqual(
            self.db.query(Subscription).filter(Subscription.plan_id == internal.id).count(), 1
        )


if __name__ == "__main__":
    unittest.main()
