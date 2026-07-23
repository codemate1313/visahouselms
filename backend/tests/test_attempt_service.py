import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.core.security import hash_password
from app.models import Base, ExamModuleAsset, ExamModuleQuestion, StudentNotification
from app.models.attempt import (
    ATTEMPT_GRADED,
    ATTEMPT_GRADING,
    ATTEMPT_IN_PROGRESS,
    ATTEMPT_READY,
    AiEvaluation,
    AiEvaluationLimit,
    CourseModule,
    Enrollment,
    GradingQueueEntry,
    ReevaluationRequest,
    AttemptFlag,
)
from app.models.course import COURSE_PUBLISHED, Course
from app.models.institute import Institute
from app.models.role import INSTITUTE_ADMIN, INST_INSTRUCTOR, SA_INSTRUCTOR, STUDENT, Role
from app.models.user import User
from app.services import ai_evaluation_service, attempt_service, grading_service, module_authoring_service, notification_service, student_analysis_service
from app.services import cefr_service


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
        self.assertEqual(attempt_out["started_at"].utcoffset(), timedelta(0))
        self.assertEqual(attempt_out["expires_at"].utcoffset(), timedelta(0))
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
        self.assertEqual(result["band_label"], "C2")
        self.assertEqual(result["cefr_level"], "C2")
        self.assertEqual(result["cefr_policy_version"], cefr_service.POLICY_VERSION)
        self.assertEqual(result["cefr_profile"]["status"], "complete")
        self.assertEqual(result["cefr_profile"]["skills"][0]["mapping_method"], "configured_raw_score")

        analysis = student_analysis_service.result_analysis(
            self.db,
            attempt,
            evaluator=lambda _config, _payload: {
                "summary": "A focused analysis based on the aggregate result.",
                "strengths": ["Strong completion."],
                "improvements": ["Review the missed item."],
                "next_steps": ["Practise one timed reading set."],
            },
        )
        self.assertEqual(analysis["generated_by"], "configured_ai")
        self.assertEqual(analysis["metrics"]["attempted"], len(all_questions))
        self.assertEqual(analysis["metrics"]["correct"], len(all_questions) - 1)
        self.assertEqual(analysis["metrics"]["incorrect"], 1)

        fallback_analysis = student_analysis_service.result_analysis(self.db, attempt)
        self.assertEqual(fallback_analysis["generated_by"], "cefr_analysis_engine")
        self.assertFalse(fallback_analysis["ai_enabled"])
        self.assertTrue(fallback_analysis["next_steps"])

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
        queue = self.db.query(GradingQueueEntry).filter_by(attempt_id=attempt.id).one()
        self.assertEqual(queue.status, "pending")

        claimed = grading_service.claim(self.db, self.instructor, attempt)
        self.assertEqual(claimed["status"], "claimed")
        self.assertEqual(claimed["assigned_to_id"], self.instructor.id)

        parts = sorted(attempt.module.parts, key=lambda p: p.sort_order)
        criteria = [{"criterion": item["criterion"], "marks_awarded": 6} for item in parts[0].rubric]
        detail = attempt_service.grade_part(self.db, self.instructor, attempt.id, parts[0].id, criteria, "Solid attempt")
        self.assertEqual(detail["status"], ATTEMPT_GRADING)  # still one part left

        criteria2 = [{"criterion": item["criterion"], "marks_awarded": 6} for item in parts[1].rubric]
        final = attempt_service.grade_part(self.db, self.instructor, attempt.id, parts[1].id, criteria2, "Good")
        self.assertEqual(final["status"], ATTEMPT_GRADED)
        self.assertEqual(Decimal(final["raw_score"]), Decimal("48"))
        self.assertEqual(Decimal(final["max_score"]), Decimal("64"))
        self.assertEqual(final["cefr_level"], "C1")
        self.assertEqual(final["cefr_profile"]["skills"][0]["level"], "C1")
        notification = self.db.query(StudentNotification).filter_by(attempt_id=attempt.id).one()
        self.assertEqual(notification.user_id, self.student.id)
        self.assertEqual(notification.kind, "grade_released")
        updates = notification_service.list_student_notifications(self.db, self.student)
        self.assertEqual(updates[0]["attempt_id"], attempt.id)
        self.assertIsNone(updates[0]["read_at"])
        notification_service.mark_notification_read(self.db, self.student, notification.id)
        self.assertIsNotNone(notification.read_at)
        self.db.refresh(queue)
        self.assertEqual(queue.status, "completed")
        self.assertTrue(
            all(
                criterion["cefr_level"] == "C1"
                for part in final["parts"]
                for criterion in part["grade"]["criteria"]
            )
        )

    def test_institute_student_submit_routes_to_active_institute_staff(self):
        module = self._build_writing_module()
        self._course_with_module(module.id)
        institute_role = Role(name=INST_INSTRUCTOR)
        institute = Institute(name="Staffed Academy", slug="staffed-academy", is_active=True)
        self.db.add_all([institute_role, institute])
        self.db.flush()
        self.db.add(
            User(
                email="staff@academy.test",
                password_hash=hash_password("MarkerPassword!1"),
                role_id=institute_role.id,
                institute_id=institute.id,
                first_name="Staff",
                last_name="Marker",
                is_active=True,
            )
        )
        self.student.institute_id = institute.id
        self.db.add(self.student)
        self.db.commit()

        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])

        result = attempt_service.submit_attempt(self.db, attempt)

        self.assertEqual(result["status"], ATTEMPT_GRADING)
        queue = self.db.query(GradingQueueEntry).filter_by(attempt_id=attempt.id).one()
        self.assertEqual(queue.routing_reason, "institute_instructor")

    def test_ai_draft_is_normalized_limited_and_never_publishes_a_grade(self):
        module = self._build_writing_module()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        for part in attempt.module.parts:
            for question in part.questions:
                attempt_service.save_answer(self.db, attempt, question.id, {"text": "A developed academic response."})
        attempt_service.submit_attempt(self.db, attempt)
        part = sorted(attempt.module.parts, key=lambda item: item.sort_order)[0]

        def evaluator(_config, payload):
            return {
                "criteria": [
                    {"criterion": item["criterion"], "marks_awarded": 6, "rationale": "Evidence in the response."}
                    for item in payload["rubric"]
                ],
                "comment": "Advisory draft only.",
                "confidence": 0.8,
            }

        suggestion = ai_evaluation_service.request_suggestion(
            self.db, self.instructor, attempt, part, evaluator=evaluator
        )
        self.assertTrue(suggestion["human_review_required"])
        self.assertEqual(suggestion["criteria"][0]["cefr_level"], "C1")
        self.assertEqual(self.db.query(AiEvaluation).count(), 1)
        self.assertEqual(self.db.query(AiEvaluationLimit).one().used_count, 1)
        grade = next(item for item in attempt.part_grades if item.part_id == part.id)
        self.assertEqual(grade.status, "pending")
        self.assertIsNone(grade.total_marks)

    def test_student_reevaluation_reopens_completed_queue_and_records_resolution(self):
        module = self._build_writing_module()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        for part in attempt.module.parts:
            for question in part.questions:
                attempt_service.save_answer(self.db, attempt, question.id, {"text": "Reviewable response."})
        attempt_service.submit_attempt(self.db, attempt)
        for part in sorted(attempt.module.parts, key=lambda item: item.sort_order):
            criteria = [{"criterion": item["criterion"], "marks_awarded": 5} for item in part.rubric]
            attempt_service.grade_part(self.db, self.instructor, attempt.id, part.id, criteria, "Initial grade")

        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt.id)
        request = grading_service.request_reevaluation(
            self.db,
            self.student,
            attempt,
            "Please review the task achievement criterion and examiner feedback.",
        )
        self.assertEqual(request["status"], "pending")
        queue = self.db.query(GradingQueueEntry).filter_by(attempt_id=attempt.id).one()
        self.assertEqual(queue.status, "pending")
        self.assertEqual(queue.priority, 10)

        grading_service.claim(self.db, self.instructor, attempt)
        resolved = grading_service.resolve_reevaluation(
            self.db,
            self.instructor,
            attempt,
            "resolved",
            "The complete rubric and response were reviewed; the original marks remain appropriate.",
        )
        self.assertEqual(resolved["status"], "resolved")
        self.assertEqual(self.db.query(ReevaluationRequest).count(), 1)
        self.db.refresh(queue)
        self.assertEqual(queue.status, "completed")

    def test_institute_submission_uses_institute_instructor_with_sa_fallback(self):
        module = self._build_writing_module()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        for part in attempt.module.parts:
            for question in part.questions:
                attempt_service.save_answer(self.db, attempt, question.id, {"text": "Institute response."})
        attempt_service.submit_attempt(self.db, attempt)

        institute_role = Role(name=INST_INSTRUCTOR)
        institute_admin_role = Role(name=INSTITUTE_ADMIN)
        institute = Institute(name="Routing Academy", slug="routing-academy", is_active=True)
        self.db.add_all([institute_role, institute_admin_role, institute])
        self.db.flush()
        institute_instructor = User(
            email="marker@routing.test",
            password_hash=hash_password("MarkerPassword!1"),
            role_id=institute_role.id,
            institute_id=institute.id,
            first_name="Institute",
            last_name="Marker",
            is_active=True,
        )
        institute_admin = User(
            email="admin@routing.test",
            password_hash=hash_password("AdminPassword!1"),
            role_id=institute_admin_role.id,
            institute_id=institute.id,
            first_name="Institute",
            last_name="Admin",
            is_active=True,
        )
        self.student.institute_id = institute.id
        self.db.add_all([institute_instructor, institute_admin, self.student])
        self.db.commit()

        self.assertEqual(attempt_service.list_grading_queue(self.db, self.instructor), [])
        self.assertEqual(
            [item["id"] for item in attempt_service.list_grading_queue(self.db, institute_instructor)],
            [attempt.id],
        )

        institute_instructor.is_active = False
        self.db.add(institute_instructor)
        self.db.commit()
        self.assertEqual(attempt_service.list_grading_queue(self.db, self.instructor), [])

        institute_admin.is_active = False
        self.db.add(institute_admin)
        self.db.commit()
        self.assertEqual(
            [item["id"] for item in attempt_service.list_grading_queue(self.db, self.instructor)],
            [attempt.id],
        )

    def test_cefr_percentage_policy_boundaries_are_versioned(self):
        self.assertEqual(cefr_service.level_for_percentage(Decimal("39.9")), "Below B1")
        self.assertEqual(cefr_service.level_for_percentage(Decimal("40")), "B1")
        self.assertEqual(cefr_service.level_for_percentage(Decimal("60")), "B2")
        self.assertEqual(cefr_service.level_for_percentage(Decimal("75")), "C1")
        self.assertEqual(cefr_service.level_for_percentage(Decimal("90")), "C2")
        self.assertIn("2020", cefr_service.POLICY_VERSION)

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

    def test_final_test_requires_bound_media_preflight_before_timer_and_content(self):
        module = self._build_reading_module()
        module.module_type = "final_test"
        self.db.add(module)
        self.db.commit()

        created = attempt_service.start_attempt(self.db, self.student, module)
        self.assertEqual(created["status"], ATTEMPT_READY)
        self.assertFalse(created["security_authorized"])
        self.assertTrue(all(not part["questions"] for part in created["parts"]))

        attempt = attempt_service.get_attempt_or_404(self.db, self.student, created["id"])
        provisional_expiry = attempt.expires_at
        session = SimpleNamespace(device_id=41)
        payload = {
            "client_id": "test-client-identifier-0001",
            "camera_active": True,
            "microphone_active": True,
            "screen_share_active": True,
            "fullscreen_active": True,
            "display_surface": "monitor",
        }
        preflight = attempt_service.secure_preflight(
            self.db, attempt, session, payload, "127.0.0.1"
        )
        self.assertTrue(attempt_service.security_access_valid(attempt, session, preflight["attempt_token"]))
        self.assertFalse(attempt_service.security_access_valid(attempt, session, "wrong-token"))

        view = attempt_service.begin_secure_attempt(
            self.db, attempt, session, preflight["attempt_token"]
        )
        self.assertEqual(view["status"], ATTEMPT_IN_PROGRESS)
        self.assertIsNotNone(view["security_started_at"])
        self.assertGreater(view["expires_at"].replace(tzinfo=None), provisional_expiry)
        self.assertTrue(view["parts"][0]["questions"])
        self.assertTrue(all(not part["questions"] for part in view["parts"][1:]))

    def test_final_test_heartbeat_records_media_loss_and_answer_revisions_block_stale_writes(self):
        module = self._build_reading_module()
        module.module_type = "final_test"
        self.db.add(module)
        self.db.commit()
        created = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, created["id"])
        session = SimpleNamespace(device_id=42)
        client_id = "test-client-identifier-0002"
        preflight = attempt_service.secure_preflight(
            self.db,
            attempt,
            session,
            {
                "client_id": client_id,
                "camera_active": True,
                "microphone_active": True,
                "screen_share_active": True,
                "fullscreen_active": True,
                "display_surface": "monitor",
            },
            "127.0.0.1",
        )
        attempt_service.begin_secure_attempt(self.db, attempt, session, preflight["attempt_token"])
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt.id)
        question = attempt.module.parts[0].questions[0]

        saved = attempt_service.save_answer(self.db, attempt, question.id, {"selected": "A"}, revision=1)
        self.assertEqual(saved["revision"], 1)
        with self.assertRaises(Exception):
            attempt_service.save_answer(self.db, attempt, question.id, {"selected": "B"}, revision=1)

        heartbeat = {
            "sequence": 1,
            "client_id": client_id,
            "camera_active": False,
            "microphone_active": True,
            "screen_share_active": True,
            "fullscreen_active": True,
            "visible": True,
            "focused": True,
            "display_surface": "monitor",
            "current_part_id": attempt.module.parts[0].id,
            "client_at": datetime.now(timezone.utc),
        }
        result = attempt_service.record_heartbeat(
            self.db, attempt, session, preflight["attempt_token"], heartbeat, "127.0.0.1"
        )
        self.assertGreaterEqual(result["risk_score"], 3)
        self.assertEqual(
            self.db.query(AttemptFlag).filter_by(attempt_id=attempt.id, flag_type="camera_stopped").count(),
            1,
        )
        with self.assertRaises(Exception):
            attempt_service.require_live_security(attempt)


if __name__ == "__main__":
    unittest.main()
