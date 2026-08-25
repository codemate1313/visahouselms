import unittest
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password, verify_password
from app.models import Base
from app.models.attempt import ATTEMPT_GRADED, ATTEMPT_IN_PROGRESS, PART_GRADE_GRADED, AttemptPartGrade, TestAttempt
from app.models.exam_module import ExamModule, ExamModulePart
from app.models.role import SA_INSTRUCTOR, STUDENT, SUPER_ADMIN, Role
from app.models.user import User
from app.services import instructor_service


class InstructorServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        super_role = Role(name=SUPER_ADMIN)
        instructor_role = Role(name=SA_INSTRUCTOR)
        student_role = Role(name=STUDENT)
        self.db.add_all([super_role, instructor_role, student_role])
        self.db.flush()
        self.actor = User(
            email="owner@example.com",
            password_hash=hash_password("OwnerPassword!1"),
            role_id=super_role.id,
            institute_id=None,
            first_name="System",
            last_name="Owner",
            is_active=True,
        )
        self.db.add(self.actor)
        self.db.commit()
        self.db.refresh(self.actor)

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _create(self) -> dict:
        return instructor_service.create_instructor(
            self.db,
            self.actor,
            email="teacher@example.com",
            first_name="Test",
            last_name="Teacher",
            title="Senior Instructor",
            bio="Language CERT writing specialist",
            ip="127.0.0.1",
        )

    def test_create_returns_temporary_password_and_profile(self) -> None:
        created = self._create()
        user = instructor_service.get_instructor_or_404(self.db, created["id"])

        self.assertTrue(user.force_password_reset)
        self.assertIsNone(user.institute_id)
        self.assertIn("temporary_password", created)
        self.assertTrue(verify_password(created["temporary_password"], user.password_hash))
        self.assertEqual(user.role.name, SA_INSTRUCTOR)
        self.assertEqual(user.instructor_profile.title, "Senior Instructor")

    def test_update_reset_deactivate_reactivate_and_delete_lifecycle(self) -> None:
        created = self._create()
        instructor_id = created["id"]

        updated = instructor_service.update_instructor(
            self.db,
            self.actor,
            instructor_id,
            email=None,
            first_name=None,
            last_name=None,
            title="Lead Instructor",
            bio=None,
            fields_set={"title", "bio"},
            ip="127.0.0.1",
        )
        self.assertEqual(updated["title"], "Lead Instructor")
        self.assertIsNone(updated["bio"])

        new_password = instructor_service.reset_password(
            self.db, self.actor, instructor_id, "127.0.0.1"
        )
        user = instructor_service.get_instructor_or_404(self.db, instructor_id)
        self.assertTrue(user.force_password_reset)
        self.assertTrue(verify_password(new_password, user.password_hash))

        inactive = instructor_service.set_active(
            self.db, self.actor, instructor_id, False, "127.0.0.1"
        )
        self.assertFalse(inactive["is_active"])
        active = instructor_service.set_active(
            self.db, self.actor, instructor_id, True, "127.0.0.1"
        )
        self.assertTrue(active["is_active"])

        instructor_service.delete_instructor(
            self.db, self.actor, instructor_id, "127.0.0.1"
        )
        role = self.db.query(Role).filter(Role.name == SA_INSTRUCTOR).one()
        self.assertEqual(self.db.query(User).filter(User.role_id == role.id, User.deleted_at.is_(None)).count(), 0)

    def test_dashboard_exposes_stable_phase_3_contract(self) -> None:
        created = self._create()
        user = instructor_service.get_instructor_or_404(self.db, created["id"])
        summary = instructor_service.dashboard_summary(self.db, user)

        self.assertEqual(
            summary["content"],
            {
                "modules": 0,
                "drafts": 0,
                "published": 0,
                "questions": 0,
                "audio": 0,
                "reading": 0,
                "speaking": 0,
                "writing": 0,
                "listening": 0,
                "full_mock": 0,
                "final_test": 0,
            },
        )
        self.assertEqual(
            summary["grading"],
            {
                "pending": 0,
                "in_progress": 0,
                "completed_today": 0,
                "completed_this_month": 0,
                "completed_total": 0,
            },
        )
        self.assertEqual(
            summary["engagement"],
            {
                "unique_learners": 0,
                "total_attempts": 0,
                "completed_attempts": 0,
                "courses_with_usage": 0,
            },
        )
        self.assertEqual(summary["course_usage"], [])
        self.assertEqual(len(summary["grading_trend"]), 6)
        self.assertEqual(sum(point["value"] for point in summary["grading_trend"]), 0)
        self.assertGreaterEqual(summary["profile_completion"], 80)

    def test_dashboard_reports_attributed_grading_and_course_usage(self) -> None:
        created = self._create()
        instructor = instructor_service.get_instructor_or_404(self.db, created["id"])
        other_instructor = instructor_service.create_instructor(
            self.db,
            self.actor,
            email="other-teacher@example.com",
            first_name="Other",
            last_name="Teacher",
            title="Instructor",
            bio=None,
            ip="127.0.0.1",
        )
        other = instructor_service.get_instructor_or_404(self.db, other_instructor["id"])
        student_role = self.db.query(Role).filter(Role.name == STUDENT).one()
        students = [
            User(
                email=f"student-{index}@example.com",
                password_hash=hash_password("StudentPassword!1"),
                role_id=student_role.id,
                first_name="Student",
                last_name=str(index),
                is_active=True,
            )
            for index in range(1, 3)
        ]
        self.db.add_all(students)
        self.db.flush()

        modules = [
            ExamModule(
                module_type=module_type,
                title=title,
                status="published",
                duration_minutes=30,
                created_by_id=instructor.id,
            )
            for module_type, title in (
                ("writing", "Academic Writing A"),
                ("speaking", "Speaking Skills B"),
                ("reading", "Reading Practice C"),
            )
        ]
        other_module = ExamModule(
            module_type="writing",
            title="Other Instructor Module",
            status="published",
            duration_minutes=30,
            created_by_id=other.id,
        )
        self.db.add_all([*modules, other_module])
        self.db.flush()

        parts = []
        for module in [*modules, other_module]:
            part = ExamModulePart(
                module_id=module.id,
                section_type=module.module_type,
                part_code=f"{module.id}-P1",
                title="Part 1",
                skill_focus="Assessment",
                auto_marked=False,
            )
            self.db.add(part)
            parts.append(part)
        self.db.flush()

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        attempts = [
            TestAttempt(
                user_id=students[0].id,
                module_id=modules[0].id,
                status=ATTEMPT_GRADED,
                expires_at=now + timedelta(hours=1),
                graded_at=now,
            ),
            TestAttempt(
                user_id=students[1].id,
                module_id=modules[0].id,
                status=ATTEMPT_IN_PROGRESS,
                expires_at=now + timedelta(hours=1),
            ),
            TestAttempt(
                user_id=students[0].id,
                module_id=modules[1].id,
                status=ATTEMPT_GRADED,
                expires_at=now + timedelta(hours=1),
                graded_at=now,
            ),
            TestAttempt(
                user_id=students[1].id,
                module_id=other_module.id,
                status=ATTEMPT_GRADED,
                expires_at=now + timedelta(hours=1),
                graded_at=now,
            ),
        ]
        self.db.add_all(attempts)
        self.db.flush()
        self.db.add_all(
            [
                AttemptPartGrade(
                    attempt_id=attempts[0].id,
                    part_id=parts[0].id,
                    grader_id=instructor.id,
                    status=PART_GRADE_GRADED,
                    graded_at=now,
                ),
                AttemptPartGrade(
                    attempt_id=attempts[2].id,
                    part_id=parts[1].id,
                    grader_id=instructor.id,
                    status=PART_GRADE_GRADED,
                    graded_at=now,
                ),
                AttemptPartGrade(
                    attempt_id=attempts[3].id,
                    part_id=parts[3].id,
                    grader_id=other.id,
                    status=PART_GRADE_GRADED,
                    graded_at=now,
                ),
            ]
        )
        self.db.commit()

        summary = instructor_service.dashboard_summary(self.db, instructor)

        self.assertEqual(summary["grading"]["completed_total"], 2)
        self.assertEqual(summary["grading"]["completed_today"], 2)
        self.assertEqual(summary["engagement"]["unique_learners"], 2)
        self.assertEqual(summary["engagement"]["total_attempts"], 3)
        self.assertEqual(summary["engagement"]["completed_attempts"], 2)
        self.assertEqual(summary["engagement"]["courses_with_usage"], 2)
        self.assertEqual(sum(point["value"] for point in summary["grading_trend"]), 2)
        self.assertEqual(len(summary["course_usage"]), 3)
        self.assertEqual(summary["course_usage"][0]["title"], "Academic Writing A")
        self.assertEqual(summary["course_usage"][0]["learners"], 2)
        self.assertEqual(summary["course_usage"][0]["attempts"], 2)
        self.assertEqual(summary["course_usage"][0]["completion_rate"], 50)
        self.assertEqual(summary["course_usage"][2]["title"], "Reading Practice C")
        self.assertEqual(summary["course_usage"][2]["attempts"], 0)


if __name__ == "__main__":
    unittest.main()
