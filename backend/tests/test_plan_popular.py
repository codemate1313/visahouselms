import unittest
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.plan import Plan, AUDIENCE_DIRECT, AUDIENCE_INSTITUTES
from app.models.user import User
from app.models.role import Role, SUPER_ADMIN
from app.services import plan_service


class TestPlanPopular(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()
        role = Role(name=SUPER_ADMIN)
        self.db.add(role)
        self.db.flush()

        self.admin = User(
            id=1,
            email="admin@test.com",
            first_name="Super",
            last_name="Admin",
            password_hash="test",
            role_id=role.id,
            is_active=True,
        )
        self.db.add(self.admin)
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_single_popular_plan_per_audience(self):
        # Create two direct student plans
        p1 = plan_service.build_plan(
            self.db,
            self.admin,
            {
                "name": "Direct Plan 1",
                "price": 100,
                "duration_days": 30,
                "student_limit": 1,
                "staff_limit": 0,
                "audience": AUDIENCE_DIRECT,
                "is_popular": True,
            },
            None,
        )
        self.db.commit()
        self.assertTrue(p1.is_popular)

        # Create second direct student plan marked as popular
        p2 = plan_service.build_plan(
            self.db,
            self.admin,
            {
                "name": "Direct Plan 2",
                "price": 200,
                "duration_days": 60,
                "student_limit": 1,
                "staff_limit": 0,
                "audience": AUDIENCE_DIRECT,
                "is_popular": True,
            },
            None,
        )
        self.db.commit()
        self.db.refresh(p1)
        self.db.refresh(p2)

        # p1 should now NOT be popular, p2 should be popular
        self.assertFalse(p1.is_popular)
        self.assertTrue(p2.is_popular)

        # Create an institute plan marked as popular
        inst1 = plan_service.build_plan(
            self.db,
            self.admin,
            {
                "name": "Institute Tier 1",
                "price": 1000,
                "duration_days": 365,
                "student_limit": 50,
                "staff_limit": 2,
                "audience": AUDIENCE_INSTITUTES,
                "is_popular": True,
            },
            None,
        )
        self.db.commit()
        self.db.refresh(p2)
        self.db.refresh(inst1)

        # Direct student popular plan remains untouched
        self.assertTrue(p2.is_popular)
        self.assertTrue(inst1.is_popular)

        # Toggle popular via set_plan_popular
        plan_service.set_plan_popular(self.db, self.admin, p1.id, True, None)
        self.db.refresh(p1)
        self.db.refresh(p2)
        self.db.refresh(inst1)

        self.assertTrue(p1.is_popular)
        self.assertFalse(p2.is_popular)
        self.assertTrue(inst1.is_popular)


if __name__ == "__main__":
    unittest.main()
