import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.models import Base
from app.models.exam_module import ExamModule, InstituteModule
from app.models.plan import Plan
from app.models.role import INSTITUTE_ADMIN, INST_INSTRUCTOR, SA_INSTRUCTOR, STUDENT, SUPER_ADMIN, Role
from app.models.subscription import Subscription
from app.models.user import User
from app.services import institute_admin_service, module_authoring_service, onboarding_service, plan_service


class InstituteOnboardingServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        roles = [Role(name=name) for name in (INSTITUTE_ADMIN, INST_INSTRUCTOR, SA_INSTRUCTOR, STUDENT, SUPER_ADMIN)]
        self.db.add_all(roles)
        self.db.flush()
        by_name = {role.name: role for role in roles}
        self.super_admin = User(
            email="super@onboarding.test", password_hash=hash_password("SuperPassword!1"),
            role_id=by_name[SUPER_ADMIN].id, first_name="Super", last_name="Admin", is_active=True,
        )
        self.instructor = User(
            email="author@onboarding.test", password_hash=hash_password("AuthorPassword!1"),
            role_id=by_name[SA_INSTRUCTOR].id, first_name="Course", last_name="Author", is_active=True,
        )
        self.db.add_all([self.super_admin, self.instructor])
        self.db.flush()
        self.module = ExamModule(
            title="Negotiated Course", module_type="reading", status="published",
            duration_minutes=50, created_by_id=self.instructor.id,
        )
        self.db.add(self.module)
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_draft_accounts_stay_inactive_until_publish(self) -> None:
        created = onboarding_service.create_draft(
            self.db,
            self.super_admin,
            {
                "name": "Physical Agreement Academy",
                "contact_email": "hello@physical.test",
                "admin_email": "admin@physical.test",
                "admin_first_name": "Institute",
                "admin_last_name": "Admin",
                "admin_permissions": {},
                "agreement_reference": "AGR-100",
                "agreement_notes": "Signed in person",
                "agreed_amount": 50000,
                "amount_received": 25000,
                "currency": "INR",
                "payment_method_id": None,
                "payment_reference": "Cash receipt 100",
                "student_limit": 2,
                "staff_limit": 0,
                "access_duration_days": 365,
                "primary_color": "#e53935",
                "secondary_color": "#17191d",
                "module_ids": [self.module.id],
            },
            "127.0.0.1",
        )
        institute_id = created["id"]
        admin = self.db.query(User).filter(User.email == "admin@physical.test").one()
        self.assertEqual(created["onboarding_status"], "draft")
        self.assertFalse(created["is_active"])
        self.assertFalse(admin.is_active)
        self.assertEqual(created["payment"]["status"], "partial")

        student = institute_admin_service.create_member(
            self.db, self.super_admin, email="student@physical.test", first_name="Draft",
            last_name="Student", role_name=STUDENT, phone_number=None, address=None, ip=None,
            scoped_institute_id=institute_id,
        )
        student_user = self.db.get(User, student["id"])
        self.assertFalse(student_user.is_active)

        published = onboarding_service.publish(self.db, self.super_admin, institute_id, None)
        self.db.refresh(admin)
        self.db.refresh(student_user)
        self.assertEqual(published["onboarding_status"], "published")
        self.assertTrue(published["is_active"])
        self.assertTrue(admin.is_active)
        self.assertTrue(student_user.is_active)
        subscription = self.db.query(Subscription).filter(Subscription.institute_id == institute_id).one()
        plan = self.db.get(Plan, subscription.plan_id)
        self.assertTrue(plan.is_internal)
        self.assertEqual(plan.student_limit, 2)
        self.assertEqual(plan.staff_limit, 0)
        self.assertEqual(plan.test_limit, 0)
        self.assertEqual(plan.modules[0].id, self.module.id)
        self.assertNotIn(plan.id, {row["id"] for row in plan_service.list_plans(self.db)})

        hidden = module_authoring_service.set_visibility(
            self.db, self.super_admin, self.module.id, False, None
        )
        self.assertFalse(hidden["is_visible"])
        module_authoring_service.set_visibility(
            self.db, self.super_admin, self.module.id, True, None
        )
        module_authoring_service.unassign_from_institute(
            self.db, self.super_admin, self.module.id, institute_id, None
        )
        assignment = self.db.query(InstituteModule).filter_by(
            institute_id=institute_id, module_id=self.module.id
        ).one()
        self.assertFalse(assignment.is_active)
        restored = module_authoring_service.assign_to_institute(
            self.db, self.super_admin, self.module.id, institute_id, None
        )
        self.assertTrue(restored["is_active"])
