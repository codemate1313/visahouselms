import unittest
from io import BytesIO
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password, verify_password
from app.models import Base
from app.models.institute import Institute
from app.models.attempt import AttemptPartGrade, TestAttempt
from app.models.exam_module import ExamModule, ExamModulePart
from app.models.plan import Plan
from app.models.role import INSTITUTE_ADMIN, INST_INSTRUCTOR, SA_INSTRUCTOR, STUDENT, SUPER_ADMIN, Role
from app.models.subscription import Subscription
from app.models.user import User
from app.models.user_device import UserDevice
from app.models.user_session import UserSession
from app.services import institute_admin_service, payment_service
from openpyxl import Workbook


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class InstituteAdminServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        roles = [
            Role(name=name)
            for name in (INSTITUTE_ADMIN, INST_INSTRUCTOR, SA_INSTRUCTOR, STUDENT, SUPER_ADMIN)
        ]
        self.db.add_all(roles)
        self.db.flush()
        self.roles = {role.name: role for role in roles}

        self.institute = Institute(
            name="North Academy",
            slug="north",
            contact_email="hello@north.test",
            admin_permissions={
                "view_students": True,
                "manage_students": True,
                "view_student_activity": True,
                "manage_student_sessions": True,
                "manage_staff": True,
                "view_billing": True,
            },
        )
        self.other_institute = Institute(name="South Academy", slug="south")
        self.db.add_all([self.institute, self.other_institute])
        self.db.flush()

        self.actor = User(
            email="admin@north.test",
            password_hash=hash_password("AdminPassword!1"),
            role_id=self.roles[INSTITUTE_ADMIN].id,
            institute_id=self.institute.id,
            first_name="Nora",
            last_name="Admin",
            is_active=True,
        )
        self.other_student = User(
            email="student@south.test",
            password_hash=hash_password("StudentPassword!1"),
            role_id=self.roles[STUDENT].id,
            institute_id=self.other_institute.id,
            first_name="Other",
            last_name="Student",
            is_active=True,
        )
        self.super_actor = User(
            email="super@example.com",
            password_hash=hash_password("SuperPassword!1"),
            role_id=self.roles[SUPER_ADMIN].id,
            institute_id=None,
            first_name="Super",
            last_name="Admin",
            is_active=True,
        )
        self.db.add_all([self.actor, self.other_student, self.super_actor])
        self.db.flush()

        plan = Plan(
            name="Institute Plan",
            price=Decimal("1000"),
            currency="INR",
            duration_days=30,
            student_limit=1,
            staff_limit=2,
            test_limit=20,
            grace_days=7,
            is_active=True,
        )
        self.db.add(plan)
        self.db.flush()
        self.db.add(
            Subscription(
                institute_id=self.institute.id,
                plan_id=plan.id,
                starts_at=_now() - timedelta(days=1),
                expires_at=_now() + timedelta(days=29),
                grace_days=7,
            )
        )
        self.db.commit()
        self.db.refresh(self.actor)

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _create_student(self):
        return institute_admin_service.create_member(
            self.db,
            self.actor,
            email="student@north.test",
            first_name="Sam",
            last_name="Student",
            role_name=STUDENT,
            phone_number=None,
            address=None,
            ip="127.0.0.1",
        )

    def test_member_creation_enforces_plan_limits_and_returns_password(self):
        created = self._create_student()
        member = institute_admin_service.get_member_or_404(self.db, self.actor, created["id"])

        self.assertEqual(member.institute_id, self.institute.id)
        self.assertEqual(member.role.name, STUDENT)
        self.assertTrue(member.force_password_reset)
        self.assertTrue(verify_password(created["temporary_password"], member.password_hash))

        with self.assertRaises(HTTPException) as raised:
            institute_admin_service.create_member(
                self.db,
                self.actor,
                email="second@north.test",
                first_name="Second",
                last_name="Student",
                role_name=STUDENT,
                phone_number=None,
                address=None,
                ip=None,
            )
        self.assertEqual(raised.exception.status_code, 402)

    def test_permissions_default_to_denied_and_are_enforced(self):
        self.institute.admin_permissions = {"view_students": True}
        self.db.commit()
        self.db.refresh(self.actor)

        institute_admin_service.require_admin_permission(self.actor, "view_students")
        with self.assertRaises(HTTPException) as raised:
            institute_admin_service.require_admin_permission(self.actor, "manage_students")
        self.assertEqual(raised.exception.status_code, 403)

    def test_super_admin_can_provision_students_for_a_scoped_institute(self):
        created = institute_admin_service.create_member(
            self.db,
            self.super_actor,
            email="provisioned@north.test",
            first_name="Provisioned",
            last_name="Student",
            role_name=STUDENT,
            phone_number=None,
            address=None,
            ip=None,
            scoped_institute_id=self.institute.id,
        )

        member = institute_admin_service.get_member_or_404(
            self.db,
            self.super_actor,
            created["id"],
            scoped_institute_id=self.institute.id,
        )
        self.assertEqual(member.institute_id, self.institute.id)
        self.assertTrue(member.force_password_reset)

    def test_member_queries_are_strictly_tenant_scoped(self):
        visible = institute_admin_service.list_members(self.db, self.actor)
        self.assertEqual(visible, [])

        with self.assertRaises(HTTPException) as raised:
            institute_admin_service.get_member_or_404(self.db, self.actor, self.other_student.id)
        self.assertEqual(raised.exception.status_code, 404)

    def test_member_update_reset_status_and_delete_lifecycle(self):
        created = institute_admin_service.create_member(
            self.db,
            self.actor,
            email="teacher@north.test",
            first_name="Ivy",
            last_name="Instructor",
            role_name=INST_INSTRUCTOR,
            phone_number=None,
            address=None,
            ip=None,
        )
        member_id = created["id"]

        updated = institute_admin_service.update_member(
            self.db,
            self.actor,
            member_id,
            {"phone_number": "+91 90000 00000"},
            {"phone_number"},
            None,
        )
        self.assertEqual(updated["phone_number"], "+91 90000 00000")

        password = institute_admin_service.reset_member_password(self.db, self.actor, member_id, None)
        member = institute_admin_service.get_member_or_404(self.db, self.actor, member_id)
        self.assertTrue(verify_password(password, member.password_hash))

        inactive = institute_admin_service.set_member_active(self.db, self.actor, member_id, False, None)
        self.assertFalse(inactive["is_active"])
        active = institute_admin_service.set_member_active(self.db, self.actor, member_id, True, None)
        self.assertTrue(active["is_active"])

        institute_admin_service.delete_member(self.db, self.actor, member_id, None)
        archived = institute_admin_service.get_member_or_404(self.db, self.actor, member_id)
        self.assertFalse(archived.is_active)
        self.assertIsNotNone(archived.deleted_at)
        with self.assertRaises(HTTPException) as raised:
            institute_admin_service.set_member_active(self.db, self.actor, member_id, True, None)
        self.assertEqual(raised.exception.status_code, 409)

    def test_csv_import_reports_duplicates_and_respects_capacity(self):
        plan = self.db.query(Plan).filter(Plan.name == "Institute Plan").one()
        plan.student_limit = 2
        self.db.commit()
        content = (
            "first_name,last_name,email,phone_number\n"
            "Asha,Patel,asha.north@example.com,+919100000001\n"
            "Duplicate,Patel,asha.north@example.com,+919100000002\n"
            "Bad,Email,not-an-email,+919100000003\n"
            "Mira,Singh,mira.north@example.com,+919100000004\n"
            "Over,Limit,over.north@example.com,+919100000005\n"
        ).encode()

        result = institute_admin_service.import_students(
            self.db,
            self.actor,
            content=content,
            filename="students.csv",
            ip="127.0.0.1",
        )

        self.assertEqual(result["summary"]["created"], 2)
        self.assertEqual(result["summary"]["skipped"], 3)
        reasons = {row["reason"] for row in result["skipped"]}
        self.assertIn("Duplicate email in file", reasons)
        self.assertIn("Invalid email address", reasons)
        self.assertIn("Student plan limit reached", reasons)

    def test_xlsx_import_accepts_full_name_column(self):
        plan = self.db.query(Plan).filter(Plan.name == "Institute Plan").one()
        plan.student_limit = 2
        self.db.commit()
        workbook = Workbook()
        sheet = workbook.active
        sheet.append(["Full Name", "Email", "Mobile"])
        sheet.append(["Nina Kapoor", "nina.north@example.com", "+919100000010"])
        buffer = BytesIO()
        workbook.save(buffer)

        result = institute_admin_service.import_students(
            self.db,
            self.actor,
            content=buffer.getvalue(),
            filename="students.xlsx",
            ip=None,
        )

        self.assertEqual(result["summary"]["created"], 1)
        created = institute_admin_service.get_member_or_404(
            self.db, self.actor, result["created"][0]["id"]
        )
        self.assertEqual((created.first_name, created.last_name), ("Nina", "Kapoor"))

    def test_student_overview_reports_devices_attempts_and_graders(self):
        created = self._create_student()
        student = institute_admin_service.get_member_or_404(self.db, self.actor, created["id"])
        grader = User(
            email="grader@example.com",
            password_hash=hash_password("GraderPassword!1"),
            role_id=self.roles[SA_INSTRUCTOR].id,
            institute_id=None,
            first_name="Grace",
            last_name="Marker",
            is_active=True,
        )
        self.db.add(grader)
        self.db.flush()
        module = ExamModule(
            module_type="writing",
            title="Writing Practice",
            status="published",
            duration_minutes=45,
            created_by_id=grader.id,
        )
        self.db.add(module)
        self.db.flush()
        part = ExamModulePart(
            module_id=module.id,
            section_type="writing",
            part_code="writing-1",
            title="Writing task",
            skill_focus="Written response",
            minimum_questions=1,
            auto_marked=False,
            answer_constraints={},
            rubric=[],
            sort_order=1,
        )
        self.db.add(part)
        self.db.flush()
        attempt = TestAttempt(
            user_id=student.id,
            module_id=module.id,
            status="graded",
            is_final=False,
            expires_at=_now() + timedelta(hours=1),
            submitted_at=_now(),
            raw_score=Decimal("18"),
            max_score=Decimal("25"),
            graded_at=_now(),
        )
        self.db.add(attempt)
        device = UserDevice(
            user_id=student.id,
            identifier_hash="a" * 64,
            name="Chrome on macOS",
            login_count=3,
            first_seen_at=_now(),
            last_seen_at=_now(),
        )
        self.db.add(device)
        self.db.flush()
        self.db.add_all(
            [
                AttemptPartGrade(
                    attempt_id=attempt.id,
                    part_id=part.id,
                    criteria=[],
                    total_marks=Decimal("18"),
                    grader_id=grader.id,
                    status="graded",
                    graded_at=_now(),
                ),
                UserSession(
                    user_id=student.id,
                    device_id=device.id,
                    session_key="overview-session",
                    refresh_token_hash="b" * 64,
                    created_at=_now(),
                    expires_at=_now() + timedelta(days=1),
                ),
            ]
        )
        self.db.commit()

        overview = institute_admin_service.student_overview(self.db, self.actor, student.id)

        self.assertEqual(overview["security"]["device_count"], 1)
        self.assertEqual(overview["security"]["active_session_count"], 1)
        self.assertEqual(len(overview["attempts"]), 1)
        self.assertEqual(overview["attempts"][0]["graders"][0]["name"], "Grace Marker")
        self.assertEqual(overview["attempts"][0]["graders"][0]["part"], "Writing task")

    def test_dashboard_reports_subscription_and_tenant_counts(self):
        self._create_student()
        summary = institute_admin_service.dashboard_summary(self.db, self.actor)
        self.assertEqual(summary["institute"]["name"], "North Academy")
        self.assertEqual(summary["counts"]["students"], 1)
        self.assertEqual(summary["counts"]["instructors"], 0)
        self.assertEqual(summary["subscription"]["state"], "active")
        self.assertEqual(summary["subscription"]["limits"]["students"], 1)

    def test_self_service_checkout_creates_scoped_paid_invoice(self):
        plan = self.db.query(Plan).filter(Plan.name == "Institute Plan").one()
        previous_expiry = (
            self.db.query(Subscription)
            .filter(Subscription.institute_id == self.institute.id)
            .order_by(Subscription.expires_at.desc())
            .first()
            .expires_at
        )
        payment = payment_service.create_b2b_plan_payment(
            self.db,
            self.actor,
            self.institute.id,
            plan.id,
            coupon_code=None,
            gateway_reference="institute-self-service",
            ip="127.0.0.1",
            renew_if_current=True,
        )
        self.assertEqual(payment["institute_id"], self.institute.id)
        self.assertEqual(payment["status"], "paid")
        self.assertIsNotNone(payment["invoice_number"])
        self.assertIsNotNone(payment["subscription_id"])
        renewed = self.db.get(Subscription, payment["subscription_id"])
        self.assertGreater(renewed.expires_at, previous_expiry)


if __name__ == "__main__":
    unittest.main()
