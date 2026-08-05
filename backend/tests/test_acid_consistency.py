import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.database import create_database_engine
from app.models import Base
from app.models.attempt import ATTEMPT_IN_PROGRESS, ATTEMPT_READY, TestAttempt
from app.models.coupon import Coupon
from app.models.exam_module import ExamModule
from app.models.institute import Institute
from app.models.payment import Payment
from app.models.plan import AUDIENCE_DIRECT, AUDIENCE_INSTITUTES, Plan
from app.models.role import INSTITUTE_ADMIN, STUDENT, SUPER_ADMIN, Role
from app.models.subscription import Subscription
from app.models.user import User
from app.services import (
    coupon_service,
    institute_service,
    payment_service,
    subscription_service,
)


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class AcidConsistencyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.storage = tempfile.TemporaryDirectory()
        self.engine = create_database_engine(
            f"sqlite:///{self.storage.name}/acid-tests.db"
        )
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine, autoflush=False)
        self.db = self.Session()

        super_role = Role(name=SUPER_ADMIN)
        student_role = Role(name=STUDENT)
        institute_admin_role = Role(name=INSTITUTE_ADMIN)
        self.db.add_all([super_role, student_role, institute_admin_role])
        self.db.flush()

        self.actor = User(
            email="owner@acid.test",
            password_hash=hash_password("OwnerPassword!1"),
            role_id=super_role.id,
            first_name="Owner",
            last_name="Admin",
            is_active=True,
        )
        self.student = User(
            email="student@acid.test",
            password_hash=hash_password("StudentPassword!1"),
            role_id=student_role.id,
            first_name="Direct",
            last_name="Student",
            is_active=True,
        )
        self.institute = Institute(
            name="Atomic Academy",
            slug="atomic-academy",
            is_active=True,
        )
        self.db.add_all([self.actor, self.student, self.institute])
        self.db.flush()

        self.institute_plan = self._plan(
            "Institute Plan", AUDIENCE_INSTITUTES
        )
        self.direct_plan = self._plan("Direct Plan", AUDIENCE_DIRECT)
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()
        self.storage.cleanup()

    def _plan(self, name: str, audience: str) -> Plan:
        plan = Plan(
            name=name,
            audience=audience,
            price=Decimal("1000"),
            currency="INR",
            duration_days=30,
            student_limit=20,
            staff_limit=5,
            test_limit=20,
            grace_days=7,
            is_active=True,
        )
        self.db.add(plan)
        self.db.flush()
        return plan

    def test_sqlite_foreign_keys_are_enforced(self) -> None:
        enabled = self.db.execute(text("PRAGMA foreign_keys")).scalar_one()
        self.assertEqual(enabled, 1)

        with self.assertRaises(IntegrityError):
            self.db.execute(
                text(
                    "INSERT INTO users "
                    "(email, password_hash, role_id, first_name, last_name, is_active, "
                    "force_password_reset, is_owner, is_developer_verified, "
                    "can_view_monetary_analytics) "
                    "VALUES ('invalid-fk@acid.test', 'hash', 99999, 'Bad', 'Role', 1, 0, 0, 0, 0)"
                )
            )
        self.db.rollback()

    def test_b2b_payment_rolls_back_when_subscription_creation_fails(self) -> None:
        with patch.object(
            subscription_service,
            "assign",
            side_effect=RuntimeError("subscription write failed"),
        ):
            with self.assertRaisesRegex(RuntimeError, "subscription write failed"):
                payment_service.create_b2b_plan_payment(
                    self.db,
                    self.actor,
                    self.institute.id,
                    self.institute_plan.id,
                    None,
                    "BANK-ATOMIC-1",
                )

        verifier = self.Session()
        try:
            self.assertEqual(verifier.query(Payment).count(), 0)
            self.assertEqual(verifier.query(Subscription).count(), 0)
        finally:
            verifier.close()

    def test_b2c_payment_rolls_back_when_subscription_creation_fails(self) -> None:
        with patch.object(
            subscription_service,
            "subscribe_user",
            side_effect=RuntimeError("subscription write failed"),
        ):
            with self.assertRaisesRegex(RuntimeError, "subscription write failed"):
                payment_service.create_user_plan_payment(
                    self.db,
                    self.student.id,
                    self.direct_plan.id,
                    None,
                    "BANK-ATOMIC-2",
                )

        verifier = self.Session()
        try:
            self.assertEqual(verifier.query(Payment).count(), 0)
            self.assertEqual(verifier.query(Subscription).count(), 0)
        finally:
            verifier.close()

    def test_first_allocation_rolls_back_if_subscription_cannot_be_created(self) -> None:
        with patch.object(
            subscription_service,
            "assign",
            side_effect=RuntimeError("subscription write failed"),
        ):
            with self.assertRaisesRegex(RuntimeError, "subscription write failed"):
                institute_service.update_institute(
                    self.db,
                    self.actor,
                    self.institute.id,
                    {
                        "student_limit": 50,
                        "staff_limit": 10,
                        "access_duration_days": 180,
                        "grace_days": 7,
                        "agreed_amount": Decimal("9000"),
                        "currency": "INR",
                        "module_ids": [],
                    },
                    None,
                )
        self.db.rollback()

        verifier = self.Session()
        try:
            institute = verifier.get(Institute, self.institute.id)
            self.assertIsNone(institute.student_limit)
            self.assertIsNone(institute.onboarding_plan_id)
            self.assertEqual(verifier.query(Subscription).count(), 0)
            self.assertEqual(verifier.query(Plan).count(), 2)
        finally:
            verifier.close()


    def test_coupon_limit_is_enforced_by_the_atomic_update(self) -> None:
        coupon = Coupon(
            code="ONCE",
            discount_type="flat",
            value=Decimal("100"),
            scope="all",
            usage_limit=1,
            usage_count=0,
            is_active=True,
        )
        self.db.add(coupon)
        self.db.commit()

        coupon_service.redeem(self.db, coupon, email="test@example.com")
        self.db.commit()

        stale = self.db.get(Coupon, coupon.id)
        stale.usage_count = 0
        with self.assertRaises(HTTPException) as raised:
            coupon_service.redeem(self.db, stale, email="test@example.com")
        self.assertEqual(raised.exception.status_code, 409)
        self.db.rollback()
        self.assertEqual(self.db.get(Coupon, coupon.id).usage_count, 1)

    def test_database_rejects_duplicate_final_and_active_attempts(self) -> None:
        final_module = ExamModule(
            title="Final",
            module_type="final_test",
            status="published",
            duration_minutes=30,
            created_by_id=self.actor.id,
        )
        practice_module = ExamModule(
            title="Practice",
            module_type="writing",
            status="published",
            duration_minutes=30,
            created_by_id=self.actor.id,
        )
        self.db.add_all([final_module, practice_module])
        self.db.flush()

        self.db.add(
            TestAttempt(
                user_id=self.student.id,
                module_id=final_module.id,
                status=ATTEMPT_READY,
                is_final=True,
                expires_at=_now() + timedelta(hours=1),
            )
        )
        self.db.add(
            TestAttempt(
                user_id=self.student.id,
                module_id=practice_module.id,
                status=ATTEMPT_IN_PROGRESS,
                is_final=False,
                expires_at=_now() + timedelta(hours=1),
            )
        )
        self.db.commit()

        self.db.add(
            TestAttempt(
                user_id=self.student.id,
                module_id=final_module.id,
                status=ATTEMPT_READY,
                is_final=True,
                expires_at=_now() + timedelta(hours=1),
            )
        )
        with self.assertRaises(IntegrityError):
            self.db.commit()
        self.db.rollback()

        self.db.add(
            TestAttempt(
                user_id=self.student.id,
                module_id=practice_module.id,
                status=ATTEMPT_IN_PROGRESS,
                is_final=False,
                expires_at=_now() + timedelta(hours=1),
            )
        )
        with self.assertRaises(IntegrityError):
            self.db.commit()
        self.db.rollback()


if __name__ == "__main__":
    unittest.main()
