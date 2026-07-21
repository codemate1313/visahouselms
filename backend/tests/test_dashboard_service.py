import unittest
from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.models import Base
from app.models.demo_account import DemoAccount
from app.models.exam_module import ExamModule
from app.models.institute import Institute
from app.models.payment import Payment
from app.models.plan import Plan
from app.models.role import SA_INSTRUCTOR, SUPER_ADMIN, Role
from app.models.subscription import Subscription
from app.models.user import User
from app.services import dashboard_service


class DashboardServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        super_role = Role(name=SUPER_ADMIN)
        instructor_role = Role(name=SA_INSTRUCTOR)
        self.db.add_all([super_role, instructor_role])
        self.db.flush()
        self.instructor = User(
            email="instructor@dashboard.test",
            password_hash=hash_password("InstructorPassword!1"),
            role_id=instructor_role.id,
            first_name="Course",
            last_name="Author",
            is_active=True,
        )
        self.db.add(self.instructor)
        self.db.flush()
        self.institute = Institute(
            name="Balance Due Academy",
            slug="balance-due-academy",
            contact_email="billing@academy.test",
            is_active=True,
            onboarding_status="published",
            student_limit=50,
        )
        self.plan = Plan(
            name="Dashboard Access",
            description="Test plan",
            price=Decimal("10000.00"),
            currency="INR",
            duration_days=365,
            student_limit=50,
            test_limit=0,
            staff_limit=2,
            grace_days=7,
            is_active=True,
            is_published=False,
            is_internal=True,
        )
        self.db.add_all([self.institute, self.plan])
        self.db.flush()

        now = datetime.utcnow()
        self.db.add_all(
            [
                Subscription(
                    institute_id=self.institute.id,
                    plan_id=self.plan.id,
                    starts_at=now,
                    expires_at=now + timedelta(days=365),
                    grace_days=7,
                ),
                Payment(
                    source="b2b",
                    institute_id=self.institute.id,
                    plan_id=self.plan.id,
                    amount=Decimal("10000.00"),
                    discount_amount=Decimal("0.00"),
                    final_amount=Decimal("10000.00"),
                    amount_paid=Decimal("6000.00"),
                    currency="INR",
                    gateway="manual",
                    status="partial",
                    invoice_number="INV-TEST-001",
                ),
                DemoAccount(
                    institute_id=self.institute.id,
                    duration_days=14,
                    course_limit=2,
                    test_limit=3,
                    expires_at=now + timedelta(days=14),
                ),
                ExamModule(
                    module_type="reading",
                    title="Published Reading Course",
                    status="published",
                    is_visible=True,
                    duration_minutes=50,
                    created_by_id=self.instructor.id,
                    published_at=now,
                ),
            ]
        )
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_each_dashboard_metric_has_real_drill_down_data(self) -> None:
        expected_titles = {
            "institutes": "Balance Due Academy",
            "subscriptions": "Balance Due Academy",
            "revenue": "Balance Due Academy",
            "dues": "Balance Due Academy",
            "transactions": "Balance Due Academy",
            "demos": "Balance Due Academy",
            "instructors": "Course Author",
            "modules": "Published Reading Course",
        }

        for metric, expected_title in expected_titles.items():
            with self.subTest(metric=metric):
                detail = dashboard_service.get_metric_detail(self.db, metric)
                self.assertEqual(detail["metric"], metric)
                self.assertEqual(detail["items"][0]["title"], expected_title)

        due = dashboard_service.get_metric_detail(self.db, "dues")["items"][0]
        self.assertEqual(due["value"], "4000.00")
        self.assertEqual(due["value_label"], "Outstanding")
        self.assertEqual(due["subtitle"], "INV-TEST-001 · Dashboard Access")

    def test_unknown_metric_is_rejected(self) -> None:
        with self.assertRaises(HTTPException) as context:
            dashboard_service.get_metric_detail(self.db, "unknown")
        self.assertEqual(context.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
