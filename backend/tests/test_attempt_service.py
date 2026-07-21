import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.core.security import hash_password
from app.models import Base, ExamModuleAsset, ExamModuleQuestion
from app.models.attempt import ATTEMPT_GRADED, ATTEMPT_GRADING, CourseModule, Enrollment
from app.models.course import COURSE_PUBLISHED, Course
from app.models.role import SA_INSTRUCTOR, STUDENT, Role
from app.models.user import User
from app.services import attempt_service, module_authoring_service


def _question(question_type: str, prompt: str, points: Decimal, correct: list[str]) -> dict:
    choice = question_type.startswith("mcq_")
    return {
        "question_type": question_type,
        "prompt": prompt,
        "instructions": None,
        "passage": None,
        "options": [{"key": "A", "text": "One"}, {"key": "B", "text": "Two"}] if choice else [],
        "correct_answers": correct,
        "explanation": None,
        "points": points,
        "difficulty": "medium",
    }


class AttemptServiceTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        self.instructor_role = Role(name=SA_INSTRUCTOR)
        self.student_role = Role(name=STUDENT)
        self.db.add_all([self.instructor_role, self.student_role])
        self.db.flush()

        self.instructor = User(
            email="author@example.com",
            password_hash=hash_password("TeacherPassword!1"),
            role_id=self.instructor_role.id,
            first_name="Author",
            last_name="Teacher",
            is_active=True,
        )
        self.student = User(
            email="student@example.com",
            password_hash=hash_password("StudentPassword!1"),
            role_id=self.student_role.id,
            first_name="Sam",
            last_name="Student",
            is_active=True,
        )
        self.db.add_all([self.instructor, self.student])
        self.db.commit()
        self.db.refresh(self.instructor)
        self.db.refresh(self.student)

        self.storage = tempfile.TemporaryDirectory()
        self.original_storage_dir = settings.storage_dir
        settings.storage_dir = self.storage.name

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()
        settings.storage_dir = self.original_storage_dir
        self.storage.cleanup()

    def _enroll(self, course: Course) -> None:
        self.db.add(
            Enrollment(user_id=self.student.id, course_id=course.id, source="b2c_purchase", is_active=True)
        )
        self.db.commit()

    def _course_with_module(self, module_id: int) -> Course:
        course = Course(
            title="Bundle",
            slug=f"bundle-{module_id}",
            price=Decimal("0"),
            currency="INR",
            status=COURSE_PUBLISHED,
            created_by_id=self.instructor.id,
        )
        self.db.add(course)
        self.db.flush()
        self.db.add(CourseModule(course_id=course.id, module_id=module_id, sort_order=0))
        self.db.commit()
        return course

    def _build_reading_module(self):
        created = module_authoring_service.create_module(
            self.db, self.instructor, {"module_type": "reading", "title": "Reading A", "description": None, "instructions": None}, "127.0.0.1"
        )
        module = module_authoring_service.get_module_or_404(self.db, created["id"])
        for part in module.parts:
            count = part.question_limit or part.minimum_questions
            points = Decimal(part.max_marks) / count
            for index in range(count):
                # first question of every part is answered correctly in tests, rest incorrectly
                self.db.add(
                    ExamModuleQuestion(
                        part_id=part.id,
                        **_question("mcq_single", f"{part.part_code} Q{index + 1}", points, ["A"]),
                        source_type="manual",
                        source_filename=None,
                        sort_order=index,
                        created_by_id=self.instructor.id,
                    )
                )
        self.db.commit()
        module_authoring_service.set_status(self.db, self.instructor, module.id, "published", "127.0.0.1")
        self.db.expire_all()
        return module_authoring_service.get_module_or_404(self.db, module.id)

    def _build_writing_module(self):
        created = module_authoring_service.create_module(
            self.db, self.instructor, {"module_type": "writing", "title": "Writing A", "description": None, "instructions": None}, "127.0.0.1"
        )
        module = module_authoring_service.get_module_or_404(self.db, created["id"])
        for part in module.parts:
            self.db.add(
                ExamModuleQuestion(
                    part_id=part.id,
                    **_question("essay", f"{part.part_code} prompt", Decimal(part.max_marks), []),
                    source_type="manual",
                    source_filename=None,
                    sort_order=0,
                    created_by_id=self.instructor.id,
                )
            )
        self.db.commit()
        module_authoring_service.set_status(self.db, self.instructor, module.id, "published", "127.0.0.1")
        self.db.expire_all()
        return module_authoring_service.get_module_or_404(self.db, module.id)

    def test_reading_attempt_auto_grades_and_computes_band(self):
        module = self._build_reading_module()
        self._course_with_module(module.id)

        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])

        # answer every question correctly ("A") except the very last one
        all_questions = [q for part in attempt.module.parts for q in part.questions]
        for question in all_questions[:-1]:
            attempt_service.save_answer(self.db, attempt, question.id, {"selected": "A"})
        attempt_service.save_answer(self.db, attempt, all_questions[-1].id, {"selected": "B"})

        result = attempt_service.submit_attempt(self.db, attempt)
        self.assertEqual(result["status"], ATTEMPT_GRADED)
        expected_raw = sum(Decimal(q.points) for q in all_questions[:-1])
        self.assertEqual(Decimal(result["raw_score"]), expected_raw)
        self.assertEqual(Decimal(result["max_score"]), Decimal("30"))
        self.assertIsNotNone(result["band_label"])

    def test_mcq_multiple_requires_exact_set_match(self):
        module = self._build_reading_module()
        part = next(p for p in module.parts if p.part_code == "reading_2")
        question = ExamModuleQuestion(
            part_id=part.id,
            question_type="mcq_multiple",
            prompt="pick two",
            instructions=None,
            passage=None,
            options=[{"key": "A", "text": "1"}, {"key": "B", "text": "2"}, {"key": "C", "text": "3"}],
            correct_answers=["A", "C"],
            explanation=None,
            points=Decimal("2"),
            difficulty="medium",
            source_type="manual",
            source_filename=None,
            sort_order=99,
            created_by_id=self.instructor.id,
        )
        self.db.add(question)
        self.db.commit()

        partial = attempt_service._grade_answer(question, {"selected": ["A"]})
        exact = attempt_service._grade_answer(question, {"selected": ["C", "A"]})
        wrong = attempt_service._grade_answer(question, {"selected": ["A", "B"]})
        self.assertEqual(partial, (False, Decimal("0")))
        self.assertEqual(exact, (True, Decimal("2")))
        self.assertEqual(wrong, (False, Decimal("0")))

    def test_writing_attempt_routes_to_grading_queue_and_completes(self):
        module = self._build_writing_module()
        self._course_with_module(module.id)

        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        for part in attempt.module.parts:
            for question in part.questions:
                attempt_service.save_answer(self.db, attempt, question.id, {"text": "My essay response."})

        result = attempt_service.submit_attempt(self.db, attempt)
        self.assertEqual(result["status"], ATTEMPT_GRADING)

        parts = sorted(attempt.module.parts, key=lambda p: p.sort_order)
        criteria = [{"criterion": item["criterion"], "marks_awarded": 6} for item in parts[0].rubric]
        detail = attempt_service.grade_part(self.db, self.instructor, attempt.id, parts[0].id, criteria, "Solid attempt")
        self.assertEqual(detail["status"], ATTEMPT_GRADING)  # still one part left

        criteria2 = [{"criterion": item["criterion"], "marks_awarded": 6} for item in parts[1].rubric]
        final = attempt_service.grade_part(self.db, self.instructor, attempt.id, parts[1].id, criteria2, "Good")
        self.assertEqual(final["status"], ATTEMPT_GRADED)
        self.assertEqual(Decimal(final["raw_score"]), Decimal("48"))
        self.assertEqual(Decimal(final["max_score"]), Decimal("64"))

    def test_final_test_cannot_be_retaken(self):
        created = module_authoring_service.create_module(
            self.db, self.instructor, {"module_type": "reading", "title": "R", "description": None, "instructions": None}, "127.0.0.1"
        )
        module = module_authoring_service.get_module_or_404(self.db, created["id"])
        # pretend it's a final test for the retake check without building all 15 parts
        module.module_type = "final_test"
        self.db.add(module)
        self.db.commit()

        first = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, first["id"])
        attempt_service.submit_attempt(self.db, attempt)

        with self.assertRaises(Exception):
            attempt_service.start_attempt(self.db, self.student, module)


if __name__ == "__main__":
    unittest.main()
