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
from app.models.payment_method import PaymentMethod
from app.models.plan import Plan
from app.models.role import SA_INSTRUCTOR, STUDENT, SUPER_ADMIN, Role
from app.models.subscription import Subscription
from app.models.user import User
from app.services import dashboard_service, revenue_service


class DashboardServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        super_role = Role(name=SUPER_ADMIN)
        instructor_role = Role(name=SA_INSTRUCTOR)
        student_role = Role(name=STUDENT)
        self.db.add_all([super_role, instructor_role, student_role])
        self.db.flush()
        self.instructor = User(
            email="instructor@dashboard.test",
            password_hash=hash_password("InstructorPassword!1"),
            role_id=instructor_role.id,
            first_name="Course",
            last_name="Author",
            is_active=True,
        )
        self.owner = User(
            email="owner@dashboard.test",
            password_hash=hash_password("OwnerPassword!1"),
            role_id=super_role.id,
            first_name="Owner",
            last_name="Admin",
            is_active=True,
            is_owner=True,
        )
        self.restricted_admin = User(
            email="restricted@dashboard.test",
            password_hash=hash_password("RestrictedPassword!1"),
            role_id=super_role.id,
            first_name="Restricted",
            last_name="Admin",
            is_active=True,
            can_view_monetary_analytics=False,
        )
        self.student = User(
            email="student@dashboard.test",
            password_hash=hash_password("StudentPassword!1"),
            role_id=student_role.id,
            first_name="Student",
            last_name="Learner",
            is_active=True,
            institute_id=None,
        )
        self.institute = Institute(
            name="Balance Due Academy",
            slug="balance-due-academy",
            contact_email="billing@academy.test",
            is_active=True,
            onboarding_status="published",
            student_limit=50,
        )
        self.db.add_all([self.instructor, self.owner, self.restricted_admin, self.student, self.institute])
        self.db.flush()
        self.institute_student = User(
            email="institute-student@dashboard.test",
            password_hash=hash_password("StudentPassword!1"),
            role_id=student_role.id,
            first_name="Institute",
            last_name="Learner",
            is_active=True,
            institute_id=self.institute.id,
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
        self.db.add_all([self.institute_student, self.plan])
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

    def test_revenue_drill_down_is_broken_down_by_payment_method(self) -> None:
        """Clicking Total Revenue answers "where did the money come from", so
        the detail carries the split as well as the individual payments."""
        card = PaymentMethod(name="Card")
        cash = PaymentMethod(name="Cash")
        self.db.add_all([card, cash])
        self.db.flush()
        self.db.add_all(
            [
                self._payment(Decimal("3000.00"), card.id, "INV-TEST-002"),
                self._payment(Decimal("1000.00"), cash.id, "INV-TEST-003"),
            ]
        )
        self.db.commit()

        breakdown = dashboard_service.get_metric_detail(self.db, "revenue")["breakdown"]

        # 6000 already collected on the partial invoice, plus the two above.
        self.assertEqual(breakdown["total"], "10000.00")
        by_label = {group["label"]: group for group in breakdown["groups"]}
        self.assertEqual(by_label["Card"]["total"], "3000.00")
        self.assertEqual(by_label["Cash"]["total"], "1000.00")
        # A payment recorded without a method is still counted, under its own
        # group - the parts have to add up to the headline figure.
        self.assertEqual(by_label["Unspecified"]["total"], "6000.00")
        self.assertAlmostEqual(sum(group["share"] for group in breakdown["groups"]), 100.0, places=6)
        # Largest first, so the panel reads top-down.
        self.assertEqual([group["label"] for group in breakdown["groups"]], ["Unspecified", "Card", "Cash"])

    def test_every_revenue_record_names_the_group_it_belongs_to(self) -> None:
        """Selecting a method in the panel narrows the list below it, which
        only works if each record carries its group."""
        card = PaymentMethod(name="Card")
        self.db.add(card)
        self.db.flush()
        self.db.add(self._payment(Decimal("3000.00"), card.id, "INV-TEST-004"))
        self.db.commit()

        detail = dashboard_service.get_metric_detail(self.db, "revenue")
        keys = {item["group_key"] for item in detail["items"]}
        group_keys = {group["key"] for group in detail["breakdown"]["groups"]}
        self.assertEqual(keys, group_keys)

    def test_details_without_a_breakdown_say_so(self) -> None:
        self.assertIsNone(dashboard_service.get_metric_detail(self.db, "institutes")["breakdown"])

    def test_revenue_summary_splits_and_filters_by_payment_method(self) -> None:
        card = PaymentMethod(name="Card")
        cash = PaymentMethod(name="Cash")
        self.db.add_all([card, cash])
        self.db.flush()
        self.db.add_all(
            [
                self._payment(Decimal("3000.00"), card.id, "INV-TEST-005"),
                self._payment(Decimal("1000.00"), cash.id, "INV-TEST-006"),
            ]
        )
        self.db.commit()

        summary = revenue_service.summary(self.db)
        self.assertEqual(
            {row["payment_method_name"]: row["total"] for row in summary["by_method"]},
            {"Unspecified": "6000.00", "Card": "3000.00", "Cash": "1000.00"},
        )

        # The revenue page's method filter narrows every figure on the screen,
        # not just the breakdown.
        only_card = revenue_service.summary(self.db, payment_method_id=card.id)
        self.assertEqual(only_card["total_revenue"], "3000.00")
        self.assertEqual([row["payment_method_name"] for row in only_card["by_method"]], ["Card"])

    def _payment(self, amount, method_id, invoice) -> Payment:
        return Payment(
            source="b2b",
            institute_id=self.institute.id,
            plan_id=self.plan.id,
            amount=amount,
            discount_amount=Decimal("0.00"),
            final_amount=amount,
            amount_paid=amount,
            currency="INR",
            gateway="manual",
            payment_method_id=method_id,
            status="paid",
            invoice_number=invoice,
        )

    def test_unknown_metric_is_rejected(self) -> None:
        with self.assertRaises(HTTPException) as context:
            dashboard_service.get_metric_detail(self.db, "unknown")
        self.assertEqual(context.exception.status_code, 404)

    def test_restricted_super_admin_summary_hides_monetary_analytics(self) -> None:
        summary = dashboard_service.get_summary(self.db, self.restricted_admin)

        self.assertFalse(summary["permissions"]["can_view_monetary_analytics"])
        self.assertIsNone(summary["revenue"])
        self.assertEqual(summary["revenue_by_institute"], [])
        self.assertEqual(summary["revenue_by_month"], [])
        self.assertEqual(summary["payment_status_breakdown"], [])
        self.assertEqual(summary["counts"]["students_total"], 2)
        self.assertIn("students_online", summary["counts"])
        self.assertIn("students_giving_tests", summary["counts"])

    def test_summary_includes_student_type_analytics(self) -> None:
        summary = dashboard_service.get_summary(self.db, self.owner)

        by_type = {row["type"]: row for row in summary["student_type_breakdown"]}
        self.assertEqual(by_type["direct"]["count"], 1)
        self.assertEqual(by_type["institute"]["count"], 1)
        self.assertEqual(by_type["direct"]["label"], "Direct Students")
        self.assertEqual(by_type["institute"]["label"], "Institute Students")

    def test_restricted_super_admin_cannot_open_money_metric_details(self) -> None:
        with self.assertRaises(HTTPException) as context:
            dashboard_service.get_metric_detail(self.db, "revenue", self.restricted_admin)
        self.assertEqual(context.exception.status_code, 403)

    def test_restricted_super_admin_can_open_operational_metric_details(self) -> None:
        detail = dashboard_service.get_metric_detail(self.db, "students", self.restricted_admin)

        self.assertEqual(detail["metric"], "students")
        self.assertIn("Student Learner", {item["title"] for item in detail["items"]})


if __name__ == "__main__":
    unittest.main()
