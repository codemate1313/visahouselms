import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.models import Base
from app.models.audit_log import AuditLog
from app.models.institute import Institute
from app.models.plan import Plan
from app.models.role import INSTITUTE_ADMIN, INST_INSTRUCTOR, STUDENT, SUPER_ADMIN, Role
from app.models.subscription import Subscription
from app.models.user import User
from app.models.user_session import UserSession
from app.services import subscription_service


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class SubscriptionExpirySuspensionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        roles = [Role(name=name) for name in (INSTITUTE_ADMIN, INST_INSTRUCTOR, STUDENT, SUPER_ADMIN)]
        self.db.add_all(roles)
        self.db.flush()
        self.roles = {role.name: role.id for role in roles}

        self.institute = Institute(name="North Academy", slug="north")
        self.db.add(self.institute)
        self.db.flush()

        self.members = [
            User(
                email=f"{name}@north.test",
                password_hash=hash_password("Password!1"),
                role_id=self.roles[role],
                institute_id=self.institute.id,
                first_name=name,
                last_name="User",
                is_active=True,
            )
            for name, role in (("admin", INSTITUTE_ADMIN), ("tutor", INST_INSTRUCTOR), ("sam", STUDENT))
        ]
        self.super_admin = User(
            email="super@example.com",
            password_hash=hash_password("Password!1"),
            role_id=self.roles[SUPER_ADMIN],
            first_name="Super",
            last_name="Admin",
            is_active=True,
        )
        self.db.add_all([*self.members, self.super_admin])
        self.db.flush()

        for index, member in enumerate(self.members):
            self.db.add(
                UserSession(
                    user_id=member.id,
                    session_key=f"key-{index}",
                    refresh_token_hash=f"hash-{index}",
                    created_at=_now(),
                    expires_at=_now() + timedelta(days=1),
                )
            )

        self.plan = Plan(
            name="Institute Plan",
            price=Decimal("1000"),
            currency="INR",
            duration_days=30,
            student_limit=50,
            staff_limit=5,
            test_limit=100,
            grace_days=7,
            is_active=True,
        )
        self.db.add(self.plan)
        self.db.flush()
        self.subscription = Subscription(
            institute_id=self.institute.id,
            plan_id=self.plan.id,
            starts_at=_now() - timedelta(days=40),
            expires_at=_now() - timedelta(days=10),
            grace_days=7,
        )
        self.db.add(self.subscription)
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _live_sessions(self) -> int:
        return (
            self.db.query(UserSession)
            .filter(UserSession.revoked_at.is_(None))
            .count()
        )

    def test_grace_window_is_still_full_access(self):
        self.subscription.expires_at = _now() - timedelta(days=2)
        self.db.commit()

        self.assertEqual(subscription_service.suspend_expired_institutes(self.db), 0)
        self.db.refresh(self.institute)
        self.assertTrue(self.institute.is_active)
        self.assertEqual(self._live_sessions(), 3)

    def test_past_grace_suspends_institute_and_revokes_downline_sessions(self):
        self.assertEqual(subscription_service.suspend_expired_institutes(self.db), 1)
        self.db.refresh(self.institute)
        self.assertFalse(self.institute.is_active)
        self.assertEqual(self._live_sessions(), 0)

        audit = (
            self.db.query(AuditLog)
            .filter(AuditLog.action == "institute.suspend", AuditLog.entity_id == self.institute.id)
            .one()
        )
        self.assertEqual(audit.details["reason"], subscription_service.SUSPENSION_REASON)
        self.assertEqual(audit.details["accounts_disabled"], 3)

        # sweep is idempotent - a second tick finds nothing left to suspend
        self.assertEqual(subscription_service.suspend_expired_institutes(self.db), 0)

    def test_renewal_lifts_an_automatic_suspension(self):
        subscription_service.suspend_expired_institutes(self.db)
        subscription_service.renew(self.db, self.super_admin, self.institute.id, None, "127.0.0.1")

        self.db.refresh(self.institute)
        self.assertTrue(self.institute.is_active)
        self.assertEqual(subscription_service.current_subscription(self.db, self.institute.id)[1], "active")

    def test_manual_super_admin_suspension_survives_a_renewal(self):
        self.institute.is_active = False
        self.db.add(
            AuditLog(
                user_id=self.super_admin.id,
                action="institute.suspend",
                entity_type="institute",
                entity_id=self.institute.id,
            )
        )
        self.db.commit()

        subscription_service.renew(self.db, self.super_admin, self.institute.id, None, "127.0.0.1")
        self.db.refresh(self.institute)
        self.assertFalse(self.institute.is_active)

    def test_access_window_counts_down_to_the_end_of_grace(self):
        self.subscription.expires_at = _now() + timedelta(days=3)
        self.db.commit()

        window = subscription_service.access_window(self.db, self.institute.id)
        self.assertEqual(window["state"], "active")
        self.assertEqual(window["grace_days"], 7)
        self.assertFalse(window["institute_suspended"])
        # 3 days to expiry, 10 days until access actually stops
        self.assertAlmostEqual(window["seconds_to_expiry"] / 86400, 3, places=1)
        self.assertAlmostEqual(window["seconds_remaining"] / 86400, 10, places=1)


if __name__ == "__main__":
    unittest.main()
