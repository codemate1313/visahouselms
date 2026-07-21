import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.dependencies.student_access import has_course_access
from app.models import Base
from app.models.attempt import Enrollment
from app.models.course import COURSE_PUBLISHED, Course, InstituteCourse
from app.models.institute import Institute
from app.models.plan import Plan
from app.models.role import STUDENT, Role
from app.models.subscription import Subscription
from app.models.user import User


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class EnrollmentEntitlementTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        self.student_role = Role(name=STUDENT)
        self.db.add(self.student_role)
        self.db.flush()

        self.author = User(
            email="author@example.com",
            password_hash=hash_password("Password!123"),
            role_id=self.student_role.id,
            first_name="A",
            last_name="B",
            is_active=True,
        )
        self.db.add(self.author)
        self.db.flush()

        self.course = Course(
            title="Course",
            slug="course",
            price=Decimal("999"),
            currency="INR",
            status=COURSE_PUBLISHED,
            created_by_id=self.author.id,
        )
        self.db.add(self.course)
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _make_student(self, institute_id=None) -> User:
        student = User(
            email=f"student{institute_id}@example.com",
            password_hash=hash_password("Password!123"),
            role_id=self.student_role.id,
            institute_id=institute_id,
            first_name="S",
            last_name="T",
            is_active=True,
        )
        self.db.add(student)
        self.db.commit()
        self.db.refresh(student)
        return student

    def test_b2c_student_needs_an_active_enrollment(self):
        student = self._make_student()
        self.assertFalse(has_course_access(self.db, student, self.course.id))

        self.db.add(Enrollment(user_id=student.id, course_id=self.course.id, source="b2c_purchase", is_active=True))
        self.db.commit()
        self.assertTrue(has_course_access(self.db, student, self.course.id))

    def test_b2c_inactive_enrollment_does_not_grant_access(self):
        student = self._make_student()
        self.db.add(Enrollment(user_id=student.id, course_id=self.course.id, source="b2c_purchase", is_active=False))
        self.db.commit()
        self.assertFalse(has_course_access(self.db, student, self.course.id))

    def test_b2b_student_needs_assignment_and_active_subscription(self):
        institute = Institute(name="Inst", slug="inst")
        self.db.add(institute)
        self.db.flush()
        plan = Plan(
            name="Plan", price=Decimal("0"), currency="INR", duration_days=30,
            student_limit=100, test_limit=100, staff_limit=10,
        )
        self.db.add(plan)
        self.db.flush()
        student = self._make_student(institute_id=institute.id)

        # no assignment yet -> no access
        self.assertFalse(has_course_access(self.db, student, self.course.id))

        self.db.add(
            InstituteCourse(institute_id=institute.id, course_id=self.course.id, assigned_by_id=self.author.id, is_active=True)
        )
        self.db.commit()
        # assigned, but institute has no subscription -> still no access
        self.assertFalse(has_course_access(self.db, student, self.course.id))

        self.db.add(
            Subscription(
                institute_id=institute.id, plan_id=plan.id,
                starts_at=_now() - timedelta(days=1), expires_at=_now() + timedelta(days=29),
            )
        )
        self.db.commit()
        self.assertTrue(has_course_access(self.db, student, self.course.id))

    def test_b2b_expired_subscription_blocks_access(self):
        institute = Institute(name="Inst2", slug="inst2")
        self.db.add(institute)
        self.db.flush()
        plan = Plan(
            name="Plan2", price=Decimal("0"), currency="INR", duration_days=30,
            student_limit=100, test_limit=100, staff_limit=10,
        )
        self.db.add(plan)
        self.db.flush()
        student = self._make_student(institute_id=institute.id)
        self.db.add(
            InstituteCourse(institute_id=institute.id, course_id=self.course.id, assigned_by_id=self.author.id, is_active=True)
        )
        self.db.add(
            Subscription(
                institute_id=institute.id, plan_id=plan.id,
                starts_at=_now() - timedelta(days=60), expires_at=_now() - timedelta(days=30), grace_days=0,
            )
        )
        self.db.commit()
        self.assertFalse(has_course_access(self.db, student, self.course.id))


if __name__ == "__main__":
    unittest.main()
