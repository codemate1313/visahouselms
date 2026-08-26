import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from typing import Optional
from unittest.mock import patch

from fastapi import HTTPException
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
    PART_GRADE_AI_GRADED,
    ReevaluationRequest,
    AttemptFlag,
)
# Aliased: pytest tries to collect any module-level name starting with "Test".
from app.models.attempt import TestAttempt as AttemptRow
from app.models.course import COURSE_PUBLISHED, Course
from app.models.job import Job
from app.models.institute import Institute
from app.models.plan import Plan
from app.models.role import INSTITUTE_ADMIN, INST_INSTRUCTOR, SA_INSTRUCTOR, STUDENT, Role
from app.models.subscription import Subscription
from app.models.user import User
from app.services import ai_evaluation_service, attempt_service, grading_service, job_service, module_authoring_service, notification_service, settings_service, student_analysis_service
from app.services import cefr_service


def _question(
    question_type: str,
    prompt: str,
    points: Decimal,
    correct: list[str],
    *,
    option_count: int = 2,
    passage: Optional[str] = None,
) -> dict:
    choice = question_type.startswith("mcq_") or question_type.startswith("matching_")
    return {
        "question_type": question_type,
        "prompt": prompt,
        "instructions": None,
        "passage": passage,
        "options": [
            {"key": chr(65 + index), "text": f"Option {index + 1}"}
            for index in range(option_count)
        ] if choice else [],
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
            constraints = part.answer_constraints or {}
            question_type = constraints["allowed_question_types"][0]
            for index in range(count):
                # first question of every part is answered correctly in tests, rest incorrectly
                prompt = f"{part.part_code} Q{index + 1}"
                if part.part_code == "reading_4" and index == 0:
                    prompt = "What does the writer imply in the first paragraph?"
                self.db.add(
                    ExamModuleQuestion(
                        part_id=part.id,
                        **_question(
                            question_type,
                            prompt,
                            points,
                            [chr(65 + index)] if constraints.get("unique_answers") else ["A"],
                            option_count=constraints.get("option_count", 2),
                            passage=(
                            " ".join([f"Word {i+1} {{{{blank:{i+1}}}}}" for i in range(count)])
                            if constraints.get("layout") == "shared_cloze"
                            else (f"Shared academic source for {part.part_code}." if constraints.get("passage_required") else None)
                        ),
                        ),
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

    def _enable_ai_evaluation(self) -> None:
        settings_service.set_setting(self.db, "ai.enabled", "true")
        settings_service.set_setting(self.db, "ai.provider", "gemini")
        settings_service.set_setting(self.db, "ai.api_key", "test-key")

    def _subscribe_student_for_ai(self, limit: int = 100) -> None:
        plan = Plan(
            name=f"AI Plan {limit}",
            price=Decimal("100.00"),
            duration_days=30,
            student_limit=1,
            staff_limit=0,
            grace_days=7,
            is_active=True,
            ai_evaluation_limit=limit,
        )
        self.db.add(plan)
        self.db.flush()
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        self.db.add(
            Subscription(
                user_id=self.student.id,
                plan_id=plan.id,
                starts_at=now - timedelta(days=1),
                expires_at=now + timedelta(days=29),
                grace_days=7,
            )
        )
        self.db.commit()

    def test_active_attempt_receives_browser_narration_text_without_a_file_url(self):
        asset = SimpleNamespace(
            id=1,
            part_id=2,
            asset_type="tts_text",
            title="Listening conversation",
            file_path="tts-text/1/conversation.txt",
            mime_type="text/plain",
            transcript="Guide: Listen carefully.",
            tts_voice="en-GB",
            tts_rate="+0%",
        )

        result = attempt_service._asset_out(asset, reveal_transcript=False)

        self.assertIsNone(result["url"])
        self.assertEqual(result["transcript"], "Guide: Listen carefully.")
        self.assertEqual(result["tts_voice"], "en-GB")
        self.assertEqual(result["tts_rate"], "+0%")

    def test_reading_attempt_auto_grades_and_computes_band(self):
        module = self._build_reading_module()
        self._course_with_module(module.id)

        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        self.assertEqual(attempt_out["started_at"].utcoffset(), timedelta(0))
        self.assertEqual(attempt_out["expires_at"].utcoffset(), timedelta(0))
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])

        # Answer every question with its authored key except the very last one.
        all_questions = [q for part in attempt.module.parts for q in part.questions]
        for question in all_questions[:-1]:
            attempt_service.save_answer(
                self.db,
                attempt,
                question.id,
                {"selected": question.correct_answers[0]},
            )
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
        self.assertEqual(result["cefr_profile"]["skills"][0]["mapping_method"], "languagecert_practice_scale")

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

    def test_analysis_breaks_the_result_down_by_part_format_and_difficulty(self):
        """The coaching has to name where the marks went, not just how many.

        A student who is perfect on Reading 1A and near-zero on Reading 3 gets
        the same overall percentage as one who is even across the paper - the
        breakdowns are what separate those two, so they are asserted here
        rather than left to the summary text.
        """
        module = self._build_reading_module()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])

        for part in attempt.module.parts:
            for index, question in enumerate(part.questions):
                if part.part_code == "reading_4" and index == 0:
                    continue  # left blank on purpose
                correct = part.part_code == "reading_1a"
                attempt_service.save_answer(
                    self.db,
                    attempt,
                    question.id,
                    {"selected": question.correct_answers[0] if correct else "Z"},
                )
        attempt_service.submit_attempt(self.db, attempt)

        analysis = student_analysis_service.result_analysis(self.db, attempt)
        self.assertEqual(analysis["generated_by"], "cefr_analysis_engine")

        parts = {row["label"]: row for row in analysis["part_breakdown"]}
        self.assertEqual(parts["Reading 1A"]["marks"], "6 / 6")
        self.assertEqual(parts["Reading 1A"]["status"], "strong")
        self.assertEqual(parts["Reading 2"]["status"], "priority")
        self.assertTrue(parts["Reading 1A"]["focus"])
        self.assertEqual(parts["Reading 4"]["unanswered"], 1)

        self.assertTrue(analysis["question_type_breakdown"])
        self.assertTrue(all(row["total"] for row in analysis["question_type_breakdown"]))
        # Weakest format first: the panel reads top-down as a priority list.
        percentages = [float(row["percentage"]) for row in analysis["question_type_breakdown"]]
        self.assertEqual(percentages, sorted(percentages))

        self.assertTrue(analysis["focus_areas"])
        self.assertTrue(all(area["title"] and area["detail"] for area in analysis["focus_areas"]))
        # The blank item is the cheapest mark on the paper, so it leads.
        self.assertIn("never received an answer", analysis["focus_areas"][0]["title"])
        self.assertEqual(analysis["progression"]["next_level"], "B1")
        self.assertIn("Reading 1A", analysis["summary"])

    def test_analysis_reports_rubric_criteria_for_examiner_marked_parts(self):
        module = self._build_writing_module()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        for part in attempt.module.parts:
            for question in part.questions:
                attempt_service.save_answer(self.db, attempt, question.id, {"text": "My essay response."})
        attempt_service.submit_attempt(self.db, attempt)

        pending = student_analysis_service.result_analysis(self.db, attempt)
        self.assertEqual(pending["criteria_breakdown"], [])
        self.assertTrue(any(row["status"] == "pending" for row in pending["part_breakdown"]))
        # No objective items to report an accuracy for: the summary must not
        # claim "0% correct" while the examiner still has the responses.
        self.assertNotIn("0% correct", pending["summary"])

        grading_service.claim(self.db, self.instructor, attempt)
        parts = sorted(attempt.module.parts, key=lambda item: item.sort_order)
        for part in parts:
            criteria = [
                {"criterion": item["criterion"], "marks_awarded": 2 if item["criterion"].lower().startswith("gram") else 7}
                for item in part.rubric
            ]
            attempt_service.save_part_draft(self.db, self.instructor, attempt.id, part.id, criteria, "note")
        attempt_service.submit_grading(self.db, self.instructor, attempt.id)
        self.db.refresh(attempt)

        analysis = student_analysis_service.result_analysis(self.db, attempt)
        criteria = analysis["criteria_breakdown"]
        self.assertTrue(criteria)
        self.assertEqual(float(criteria[0]["percentage"]), min(float(row["percentage"]) for row in criteria))
        self.assertTrue(criteria[0]["action"])
        self.assertTrue(any("criterion" in item.lower() for item in analysis["improvements"]))

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

    def test_matching_questions_grade_one_authored_key(self):
        for question_type in ("matching_unique", "matching_reusable"):
            question = ExamModuleQuestion(
                question_type=question_type,
                prompt="Match the source",
                options=[{"key": "A", "text": "Source A"}, {"key": "B", "text": "Source B"}],
                correct_answers=["B"],
                points=Decimal("1"),
            )
            self.assertEqual(attempt_service._grade_answer(question, {"selected": "B"}), (True, Decimal("1")))
            self.assertEqual(attempt_service._grade_answer(question, {"selected": "A"}), (False, Decimal("0")))

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
        draft = attempt_service.save_part_draft(self.db, self.instructor, attempt.id, parts[0].id, criteria, "Solid attempt")
        self.assertEqual(draft["status"], ATTEMPT_GRADING)  # draft only, not published yet

        criteria2 = [{"criterion": item["criterion"], "marks_awarded": 6} for item in parts[1].rubric]
        draft2 = attempt_service.save_part_draft(self.db, self.instructor, attempt.id, parts[1].id, criteria2, "Good")
        # Every part now has a complete draft, but the attempt only publishes
        # once submit_grading is called explicitly - drafting can't finalize it.
        self.assertEqual(draft2["status"], ATTEMPT_GRADING)

        final = attempt_service.submit_grading(self.db, self.instructor, attempt.id)
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

    def test_writing_profile_applies_40_60_task_weighting(self):
        module = self._build_writing_module()
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        for part in attempt.module.parts:
            for question in part.questions:
                attempt_service.save_answer(self.db, attempt, question.id, {"text": "Completed response."})
        attempt_service.submit_attempt(self.db, attempt)
        grading_service.claim(self.db, self.instructor, attempt)

        parts = sorted(attempt.module.parts, key=lambda part: part.sort_order)
        for index, part in enumerate(parts):
            marks = 8 if index == 0 else 0
            criteria = [
                {"criterion": item["criterion"], "marks_awarded": marks}
                for item in part.rubric
            ]
            attempt_service.save_part_draft(
                self.db,
                self.instructor,
                attempt.id,
                part.id,
                criteria,
                "Weighted scoring verification",
            )

        result = attempt_service.submit_grading(self.db, self.instructor, attempt.id)
        writing = result["cefr_profile"]["skills"][0]
        self.assertEqual(Decimal(writing["percentage"]), Decimal("40.0"))
        self.assertEqual(writing["scaled_score"], "40")
        self.assertEqual(writing["level"], "B1")

    def test_writing_submit_enqueues_ai_auto_grade_when_configured(self):
        self._enable_ai_evaluation()
        module = self._build_writing_module()
        self._course_with_module(module.id)

        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        for part in attempt.module.parts:
            for question in part.questions:
                attempt_service.save_answer(self.db, attempt, question.id, {"text": "My essay response."})

        result = attempt_service.submit_attempt(self.db, attempt)

        self.assertEqual(result["status"], ATTEMPT_GRADING)
        self.assertTrue(result["ai_evaluation_pending"])
        self.assertEqual(result["ai_evaluation_status"], "pending")
        job = self.db.query(Job).filter_by(type="ai_auto_grade").one()
        self.assertEqual(job.status, "pending")
        self.assertEqual(job.payload, {"attempt_id": attempt.id})

    def test_writing_submit_does_not_enqueue_ai_when_part_toggle_disabled(self):
        self._enable_ai_evaluation()
        created = module_authoring_service.create_module(
            self.db,
            self.instructor,
            {"module_type": "writing", "title": "Writing Manual", "description": None, "instructions": None},
            "127.0.0.1",
        )
        module = module_authoring_service.get_module_or_404(self.db, created["id"])
        for part in module.parts:
            module_authoring_service.update_part_ai_evaluation(
                self.db,
                self.instructor,
                module.id,
                part.id,
                False,
                None,
            )
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
        self._course_with_module(module.id)

        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        for part in attempt.module.parts:
            for question in part.questions:
                attempt_service.save_answer(self.db, attempt, question.id, {"text": "My essay response."})

        result = attempt_service.submit_attempt(self.db, attempt)

        self.assertEqual(result["status"], ATTEMPT_GRADING)
        self.assertFalse(result["ai_evaluation_pending"])
        self.assertEqual(result["ai_evaluation_status"], "disabled")
        self.assertEqual(self.db.query(Job).filter_by(type="ai_auto_grade").count(), 0)

    def test_recovery_enqueues_ai_auto_grade_for_existing_pending_attempt(self):
        self._enable_ai_evaluation()
        module = self._build_writing_module()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        for part in attempt.module.parts:
            for question in part.questions:
                attempt_service.save_answer(self.db, attempt, question.id, {"text": "My essay response."})
        attempt_service.submit_attempt(self.db, attempt)
        self.db.query(Job).delete()
        self.db.commit()

        queued = job_service.recover_missing_ai_auto_grade_jobs(self.db)

        self.assertEqual(queued, 1)
        self.assertEqual(self.db.query(Job).filter_by(type="ai_auto_grade").count(), 1)
        self.assertEqual(job_service.recover_missing_ai_auto_grade_jobs(self.db), 0)
        job = self.db.query(Job).filter_by(type="ai_auto_grade").one()
        job.status = "done"
        self.db.add(job)
        self.db.commit()
        self.assertEqual(job_service.recover_missing_ai_auto_grade_jobs(self.db), 0)

    def test_student_can_request_human_review_after_ai_grade(self):
        module = self._build_writing_module()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        for part in attempt.module.parts:
            for question in part.questions:
                attempt_service.save_answer(self.db, attempt, question.id, {"text": "Review my AI-scored essay."})
        attempt_service.submit_attempt(self.db, attempt)

        for part in sorted(attempt.module.parts, key=lambda item: item.sort_order):
            suggestion = {
                "criteria": [
                    {
                        "criterion": item["criterion"],
                        "max_marks": str(item["max_marks"]),
                        "marks_awarded": "6",
                        "cefr_level": "C1",
                        "rationale": "AI-scored evidence.",
                    }
                    for item in part.rubric
                ],
                "comment": "AI evaluation comment.",
            }
            ai_evaluation_service._apply_ai_grade(self.db, attempt, part, suggestion)
        self.db.commit()
        attempt_service._finalize_if_all_graded(self.db, attempt)
        self.db.refresh(attempt)

        self.assertEqual(attempt.status, ATTEMPT_GRADED)
        self.assertTrue(all(grade.status == PART_GRADE_AI_GRADED for grade in attempt.part_grades))

        request = grading_service.request_reevaluation(
            self.db,
            self.student,
            attempt,
            "test",
        )

        self.assertEqual(request["status"], "pending")
        queue = self.db.query(GradingQueueEntry).filter_by(attempt_id=attempt.id).one()
        self.assertEqual(queue.status, "pending")
        self.assertEqual(queue.routing_reason, "reevaluation")

    def _speaking_module_with_prompts(self):
        created = module_authoring_service.create_module(
            self.db,
            self.instructor,
            {"module_type": "speaking", "title": "Speaking A", "description": None, "instructions": None},
            "127.0.0.1",
        )
        module = module_authoring_service.get_module_or_404(self.db, created["id"])
        for part in module.parts:
            self.db.add(
                ExamModuleQuestion(
                    part_id=part.id,
                    **_question("speaking_prompt", f"{part.title} prompt", Decimal("1"), []),
                    source_type="manual",
                    source_filename=None,
                    sort_order=0,
                    created_by_id=self.instructor.id,
                )
            )
        self.db.commit()
        return module

    def test_speaking_blocks_submit_with_missing_recordings(self):
        """A live (non-expired) attempt must not be submittable while a
        Speaking response has no recording - the candidate still has time
        to provide one."""
        module = self._speaking_module_with_prompts()
        self._course_with_module(module.id)

        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        with self.assertRaises(HTTPException) as ctx:
            attempt_service.submit_attempt(self.db, attempt)
        self.assertEqual(ctx.exception.status_code, 409)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        self.assertNotEqual(attempt.status, ATTEMPT_GRADING)

    def test_speaking_allows_submit_with_missing_recordings_once_expired(self):
        """Once an attempt has expired, auto-submit must not be blocked by a
        missing Speaking recording - the candidate can no longer provide one,
        so the exam is graded on what was captured."""
        module = self._speaking_module_with_prompts()
        self._course_with_module(module.id)

        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        attempt_service.commence_attempt(self.db, self.student, attempt)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        attempt.expires_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=1)
        self.db.commit()

        result = attempt_service.submit_attempt(self.db, attempt)
        self.assertEqual(result["status"], ATTEMPT_GRADING)
        self.assertEqual(self.db.query(GradingQueueEntry).filter_by(attempt_id=attempt.id).count(), 1)

    def test_institute_student_submit_routes_to_active_institute_staff(self):
        module = self._build_writing_module()
        self._course_with_module(module.id)
        institute_role = Role(name=INST_INSTRUCTOR)
        institute = Institute(name="Staffed Academy", slug="staffed-academy", is_active=True)
        self.db.add_all([institute_role, institute])
        self.db.flush()
        # Module entitlement is resolved from the institute's subscription, so
        # a student attached to it needs a live plan before starting an attempt.
        # Sittings themselves are not metered - only access is checked.
        plan = Plan(
            name="Staffed Academy Plan",
            price=Decimal("1000.00"),
            duration_days=30,
            student_limit=10,
            staff_limit=5,
            grace_days=7,
            is_active=True,
        )
        self.db.add(plan)
        self.db.flush()
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        self.db.add(
            Subscription(
                institute_id=institute.id,
                plan_id=plan.id,
                starts_at=now - timedelta(days=1),
                expires_at=now + timedelta(days=29),
                grace_days=7,
            )
        )
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
        self._subscribe_student_for_ai()
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

    def test_ai_draft_survives_a_paraphrased_criterion_name(self):
        """A renamed criterion used to throw the whole evaluation away.

        Models return the rubric's labels in their own casing and punctuation;
        the marks are still theirs. Rejecting on an exact string match sent a
        completed provider call - and the student - to the manual queue.
        """
        self._subscribe_student_for_ai()
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
                    {
                        # lower-cased, punctuated, and marks as a string fraction
                        "criterion": item["criterion"].lower() + " ",
                        "marks_awarded": f"{6}/{item['max_marks']}",
                        "rationale": "Evidence in the response.",
                    }
                    for item in payload["rubric"]
                ],
                "comment": "Advisory draft only.",
                "confidence": 0.8,
            }

        suggestion = ai_evaluation_service.request_suggestion(
            self.db, self.instructor, attempt, part, evaluator=evaluator
        )
        authored = {item["criterion"] for item in part.rubric}
        self.assertEqual({item["criterion"] for item in suggestion["criteria"]}, authored)
        self.assertEqual(suggestion["criteria"][0]["marks_awarded"], "6")
        self.assertEqual(self.db.query(AiEvaluation).filter_by(status="failed").count(), 0)

    def test_normalize_still_rejects_a_criterion_outside_the_rubric(self):
        module = self._build_writing_module()
        part = sorted(module.parts, key=lambda item: item.sort_order)[0]
        with self.assertRaises(ValueError):
            ai_evaluation_service._normalize(
                {"criteria": [{"criterion": "Handwriting", "marks_awarded": 5}], "comment": "", "confidence": 0.5},
                part,
            )
        with self.assertRaises(ValueError):
            # every criterion must still be scored
            ai_evaluation_service._normalize(
                {
                    "criteria": [{"criterion": part.rubric[0]["criterion"], "marks_awarded": 5}],
                    "comment": "",
                    "confidence": 0.5,
                },
                part,
            )

    def test_pre_emptive_evaluation_skips_a_part_already_in_flight(self):
        """Leaving and re-entering a Writing part must not queue a second
        provider call for it - that is how a per-minute rate limit gets hit
        with duplicate work."""
        self._subscribe_student_for_ai()
        module = self._build_writing_module()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        part = sorted(attempt.module.parts, key=lambda item: item.sort_order)[0]

        self.assertFalse(ai_evaluation_service._evaluation_in_flight(self.db, attempt.id, part.id))
        running = AiEvaluation(
            attempt_id=attempt.id,
            part_id=part.id,
            requested_by_id=self.student.id,
            provider="gemini",
            model="gemini-2.0-flash",
            status="running",
        )
        self.db.add(running)
        self.db.commit()
        self.assertTrue(ai_evaluation_service._evaluation_in_flight(self.db, attempt.id, part.id))

        # A row left behind by a crashed worker must not wedge the part.
        running.created_at = datetime.now(timezone.utc) - timedelta(
            seconds=ai_evaluation_service.IN_FLIGHT_WINDOW_SECONDS + 60
        )
        self.db.commit()
        self.assertFalse(ai_evaluation_service._evaluation_in_flight(self.db, attempt.id, part.id))

        # A finished evaluation never blocks a re-run either.
        running.created_at = datetime.now(timezone.utc)
        running.status = "completed"
        self.db.commit()
        self.assertFalse(ai_evaluation_service._evaluation_in_flight(self.db, attempt.id, part.id))

    def test_gemini_response_schema_pins_the_rubric_criterion_names(self):
        module = self._build_writing_module()
        part = sorted(module.parts, key=lambda item: item.sort_order)[0]
        schema = ai_evaluation_service._gemini_response_schema(part.rubric)
        enum = schema["properties"]["criteria"]["items"]["properties"]["criterion"]["enum"]
        self.assertEqual(set(enum), {item["criterion"] for item in part.rubric})
        self.assertIsNone(ai_evaluation_service._gemini_response_schema([]))

    def test_ai_evaluation_log_records_both_halves_of_the_exchange(self):
        """The AI marking log has to answer "what did we ask, what came back".

        Both are recorded at request time, so a failure that never produced a
        grade still explains itself.
        """
        from app.services import ai_log_service

        self._subscribe_student_for_ai()
        module = self._build_writing_module()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        for part in attempt.module.parts:
            for question in part.questions:
                attempt_service.save_answer(self.db, attempt, question.id, {"text": "One two three four five."})
        attempt_service.submit_attempt(self.db, attempt)
        part = sorted(attempt.module.parts, key=lambda item: item.sort_order)[0]

        def evaluator(_config, payload):
            return {
                "criteria": [
                    {"criterion": item["criterion"], "marks_awarded": 6, "rationale": "Clear development."}
                    for item in payload["rubric"]
                ],
                "comment": "Solid draft.",
                "confidence": 0.8,
            }

        ai_evaluation_service.request_suggestion(
            self.db, self.instructor, attempt, part, evaluator=evaluator
        )

        rows, total = ai_log_service.query_evaluations(self.db)
        self.assertEqual(total, 1)
        self.assertEqual(rows[0]["status_label"], "Marked successfully")
        self.assertIn("out of", rows[0]["summary"])
        self.assertIsNotNone(rows[0]["duration_ms"])
        self.assertEqual(rows[0]["student_email"], self.student.email)

        detail = ai_log_service.evaluation_detail(self.db, rows[0]["id"])
        self.assertTrue(detail["asked"]["recorded"])
        self.assertEqual(
            {item["criterion"] for item in detail["asked"]["criteria"]},
            {item["criterion"] for item in part.rubric},
        )
        self.assertEqual(detail["asked"]["submissions"][0]["description"], "5 words of writing")
        self.assertEqual(len(detail["answered"]["scores"]), len(part.rubric))
        self.assertEqual(detail["answered"]["comment"], "Solid draft.")
        self.assertIn("criteria", detail["answered"]["raw"])
        self.assertIsNone(detail["failure"])

    def test_ai_evaluation_log_explains_a_failure_in_plain_language(self):
        from app.services import ai_log_service

        self._subscribe_student_for_ai()
        module = self._build_writing_module()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        for part in attempt.module.parts:
            for question in part.questions:
                attempt_service.save_answer(self.db, attempt, question.id, {"text": "An academic response."})
        attempt_service.submit_attempt(self.db, attempt)
        part = sorted(attempt.module.parts, key=lambda item: item.sort_order)[0]

        def rate_limited(_config, _payload):
            raise HTTPException(status_code=429, detail="Google Gemini API rate limit reached (15 RPM free tier limit).")

        with self.assertRaises(HTTPException):
            ai_evaluation_service.request_suggestion(
                self.db, self.instructor, attempt, part, evaluator=rate_limited
            )

        rows, _ = ai_log_service.query_evaluations(self.db, status="failed")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["status_label"], "Could not mark")
        self.assertIn("too many were sent", rows[0]["summary"])

        detail = ai_log_service.evaluation_detail(self.db, rows[0]["id"])
        self.assertIn("refused the request", detail["failure"]["what_happened"])
        self.assertIn("provider", detail["failure"]["what_to_do"])
        self.assertIn("rate limit", detail["failure"]["technical_detail"].lower())
        # The request half is still there even though nothing came back.
        self.assertTrue(detail["asked"]["criteria"])
        self.assertEqual(detail["answered"]["scores"], [])

    def test_failure_explanations_cover_the_common_provider_errors(self):
        from app.services import ai_log_service

        cases = {
            "ReadTimeout: timed out": "longer to answer",
            "Unexpected or duplicate criterion: Handwriting": "do not match",
            "Gemini API returned unparseable output": "could not read",
            "401 Unauthorized: invalid key": "rejected the API key",
            "No audio recording found for this Speaking part to evaluate": "nothing to mark",
        }
        for error, expected in cases.items():
            with self.subTest(error=error):
                self.assertIn(expected, ai_log_service.explain_failure(error)["what_happened"])
        self.assertIsNone(ai_log_service.explain_failure(None))

    def test_ai_evaluation_fails_over_to_next_configured_key(self):
        self._subscribe_student_for_ai()
        module = self._build_writing_module()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        for part in attempt.module.parts:
            for question in part.questions:
                attempt_service.save_answer(self.db, attempt, question.id, {"text": "A developed academic response."})
        attempt_service.submit_attempt(self.db, attempt)
        part = sorted(attempt.module.parts, key=lambda item: item.sort_order)[0]
        tried_keys: list[str] = []

        def evaluator(config, payload):
            tried_keys.append(config["api_key"])
            if config["api_key"] == "down-key":
                raise HTTPException(status_code=503, detail="provider unavailable")
            return {
                "criteria": [
                    {"criterion": item["criterion"], "marks_awarded": 6, "rationale": "Evidence in the response."}
                    for item in payload["rubric"]
                ],
                "comment": "Recovered through fallback key.",
                "confidence": 0.8,
            }

        suggestion = ai_evaluation_service.request_suggestion(
            self.db,
            self.instructor,
            attempt,
            part,
            evaluator=evaluator,
            configs=[
                {
                    "provider": "gemini",
                    "model": "gemini-2.0-flash",
                    "monthly_limit": 100,
                    "api_key": "down-key",
                },
                {
                    "provider": "gemini",
                    "model": "gemini-2.0-flash",
                    "monthly_limit": 100,
                    "api_key": "healthy-key",
                },
            ],
        )

        self.assertEqual(tried_keys, ["down-key", "healthy-key"])
        self.assertEqual(suggestion["comment"], "Recovered through fallback key.")
        records = self.db.query(AiEvaluation).order_by(AiEvaluation.id).all()
        self.assertEqual([item.status for item in records], ["failed", "completed"])
        self.assertEqual(records[0].error, "provider unavailable")
        self.assertEqual(self.db.query(AiEvaluationLimit).one().used_count, 1)

    def test_adaptive_speaking_prompt_uses_audio_and_has_authored_fallback(self):
        audio_path = settings.storage_path / "candidate.webm"
        audio_path.parent.mkdir(parents=True, exist_ok=True)
        audio_path.write_bytes(b"candidate-audio")
        captured: dict = {}

        def evaluator(config, prompt, audio_b64, mime_type):
            captured.update({"config": config, "prompt": prompt, "audio_b64": audio_b64, "mime_type": mime_type})
            return {"next_prompt": "How did that experience change your view?"}

        with patch.object(ai_evaluation_service, "config_status", return_value={"configured": True}), patch.object(
            ai_evaluation_service,
            "_candidate_configs",
            return_value=[{"provider": "gemini", "api_key": "test-key", "model": "test-model"}],
        ):
            result = ai_evaluation_service.generate_speaking_follow_up(
                self.db,
                audio_path=audio_path,
                current_prompt="Tell me about an important experience.",
                next_prompt="Why was it important?",
                next_turn_type="follow_up",
                evaluator=evaluator,
            )

        self.assertTrue(result["generated"])
        self.assertEqual(result["next_prompt"], "How did that experience change your view?")
        self.assertIn("Why was it important?", captured["prompt"])
        self.assertTrue(captured["audio_b64"])

        with patch.object(ai_evaluation_service, "config_status", return_value={"configured": False}):
            fallback = ai_evaluation_service.generate_speaking_follow_up(
                self.db,
                audio_path=audio_path,
                current_prompt="Previous",
                next_prompt="Authored fallback",
                next_turn_type="follow_up",
            )
        self.assertEqual(fallback, {"next_prompt": "Authored fallback", "generated": False})

    def test_short_answer_word_limit_is_enforced_by_server(self):
        module = self._build_reading_module()
        part = module.parts[0]
        question = part.questions[0]
        question.question_type = "short_answer"
        question.options = []
        question.correct_answers = ["TWO WORDS"]
        part.answer_constraints = {"allowed_question_types": ["short_answer"], "max_answer_words": 2}
        self.db.add_all([part, question])
        self.db.commit()
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])

        with self.assertRaises(HTTPException) as error:
            attempt_service.save_answer(self.db, attempt, question.id, {"text": "three word answer"})
        self.assertEqual(error.exception.status_code, 400)

    def test_ai_key_detection_identifies_supported_and_unsupported_providers(self):
        gemini = ai_evaluation_service._detect_provider(
            api_key="AIzaSyExampleGeminiKey",
            endpoint_url=None,
            preferred_provider=None,
        )
        self.assertEqual(gemini["provider"], "gemini")
        self.assertTrue(gemini["supported"])

        custom = ai_evaluation_service._detect_provider(
            api_key="any-agent-key",
            endpoint_url="https://evaluator.example.com/score",
            preferred_provider=None,
        )
        self.assertEqual(custom["provider"], "custom_json")
        self.assertTrue(custom["supported"])

        openai = ai_evaluation_service._detect_provider(
            api_key="sk-proj-example",
            endpoint_url=None,
            preferred_provider=None,
        )
        self.assertEqual(openai["provider"], "openai")
        self.assertTrue(openai["supported"])

        openai_with_stale_endpoint = ai_evaluation_service._detect_provider(
            api_key="sk-proj-example",
            endpoint_url="https://old-custom.example.com/evaluate",
            preferred_provider="gemini",
        )
        self.assertEqual(openai_with_stale_endpoint["provider"], "openai")

    def test_ai_model_listing_only_returns_generation_capable_evaluation_models(self):
        class Response:
            def raise_for_status(self):
                return None

            def json(self):
                return {
                    "models": [
                        {
                            "name": "models/gemini-2.0-flash",
                            "displayName": "Gemini 2.0 Flash",
                            "supportedGenerationMethods": ["generateContent"],
                        },
                        {
                            "name": "models/embedding-001",
                            "displayName": "Embedding",
                            "supportedGenerationMethods": ["embedContent"],
                        },
                    ]
                }

        class Client:
            def __init__(self, *args, **kwargs):
                pass

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return None

            def get(self, *args, **kwargs):
                return Response()

        with patch.object(ai_evaluation_service.httpx, "Client", Client):
            models = ai_evaluation_service.list_evaluation_models(
                provider="gemini",
                api_key="AIzaSyExampleGeminiKey",
                model="gemini-2.0-flash",
            )

        self.assertEqual(models, [{"value": "gemini-2.0-flash", "label": "Gemini 2.0 Flash"}])

    def test_openai_model_listing_filters_to_evaluation_models(self):
        class Response:
            def raise_for_status(self):
                return None

            def json(self):
                return {
                    "data": [
                        {"id": "gpt-4o-mini"},
                        {"id": "gpt-4o-audio-preview"},
                        {"id": "text-embedding-3-small"},
                        {"id": "gpt-5-mini"},
                    ]
                }

        class Client:
            def __init__(self, *args, **kwargs):
                pass

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return None

            def get(self, *args, **kwargs):
                return Response()

        with patch.object(ai_evaluation_service.httpx, "Client", Client):
            models = ai_evaluation_service.list_evaluation_models(
                provider="openai",
                api_key="sk-proj-example",
                model="gemini-2.0-flash",
            )

        self.assertEqual(
            models,
            [
                {"value": "gpt-4o-mini", "label": "gpt-4o-mini"},
                {"value": "gpt-5-mini", "label": "gpt-5-mini"},
            ],
        )

    def test_saved_ai_key_preserves_masked_secret_and_model_options(self):
        ai_evaluation_service.save_configured_keys(self.db, [{
            "id": "openai-1",
            "label": "OpenAI key",
            "provider": "openai",
            "model": "gpt-4o-mini",
            "api_key": "sk-proj-secret",
            "enabled": True,
            "priority": 1,
            "model_options": [
                {"value": "gpt-4o-mini", "label": "gpt-4o-mini"},
                {"value": "gpt-5-mini", "label": "gpt-5-mini"},
            ],
        }])
        ai_evaluation_service.save_configured_keys(self.db, [{
            "id": "openai-1",
            "label": "OpenAI key",
            "provider": "openai",
            "model": "gpt-5-mini",
            "api_key": "********",
            "enabled": True,
            "priority": 1,
            "model_options": [
                {"value": "gpt-4o-mini", "label": "gpt-4o-mini"},
                {"value": "gpt-5-mini", "label": "gpt-5-mini"},
            ],
        }])

        masked = ai_evaluation_service._configured_keys(self.db, mask=True)
        live = ai_evaluation_service._configured_keys(self.db, mask=False)

        self.assertEqual(masked[0]["api_key"], "********")
        self.assertEqual(live[0]["api_key"], "sk-proj-secret")
        self.assertEqual(masked[0]["model"], "gpt-5-mini")
        self.assertEqual(masked[0]["model_options"][1]["value"], "gpt-5-mini")

    def test_saved_ai_key_auto_detects_provider_without_manual_test(self):
        ai_evaluation_service.save_configured_keys(self.db, [{
            "id": "auto-openai",
            "label": "Auto OpenAI",
            "provider": "gemini",
            "model": "gemini-2.0-flash",
            "endpoint_url": "",
            "api_key": "sk-proj-secret",
            "enabled": True,
            "priority": 1,
        }])

        masked = ai_evaluation_service._configured_keys(self.db, mask=True)
        live = ai_evaluation_service._configured_keys(self.db, mask=False)

        self.assertEqual(masked[0]["provider"], "openai")
        self.assertEqual(masked[0]["model"], "gpt-4o-mini")
        self.assertEqual(masked[0]["api_key"], "********")
        self.assertEqual(live[0]["api_key"], "sk-proj-secret")

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
            attempt_service.save_part_draft(self.db, self.instructor, attempt.id, part.id, criteria, "Initial grade")
        attempt_service.submit_grading(self.db, self.instructor, attempt.id)

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
        second_sa = User(
            email="fallback.sa@routing.test",
            password_hash=hash_password("FallbackPassword!1"),
            role_id=self.instructor_role.id,
            first_name="Fallback",
            last_name="Examiner",
            is_active=True,
        )
        self.student.institute_id = institute.id
        self.db.add_all(
            [institute_instructor, institute_admin, second_sa, self.student]
        )
        self.db.commit()

        self.assertEqual(attempt_service.list_grading_queue(self.db, self.instructor), [])
        self.assertEqual(
            [item["id"] for item in attempt_service.list_grading_queue(self.db, institute_instructor)],
            [attempt.id],
        )

        institute_instructor.is_active = False
        self.db.add(institute_instructor)
        self.db.commit()
        self.assertEqual(
            [item["id"] for item in attempt_service.list_grading_queue(self.db, self.instructor)],
            [attempt.id],
        )
        self.assertEqual(
            [item["id"] for item in attempt_service.list_grading_queue(self.db, second_sa)],
            [attempt.id],
        )

        institute_admin.is_active = False
        self.db.add(institute_admin)
        self.db.commit()
        self.assertEqual(
            [item["id"] for item in attempt_service.list_grading_queue(self.db, self.instructor)],
            [attempt.id],
        )

    def test_sa_fallback_is_global_and_claimed_submission_is_locked(self):
        module = self._build_writing_module()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(
            self.db, self.student, attempt_out["id"]
        )
        for part in attempt.module.parts:
            for question in part.questions:
                attempt_service.save_answer(
                    self.db,
                    attempt,
                    question.id,
                    {"text": "Global grading bucket response."},
                )
        attempt_service.submit_attempt(self.db, attempt)

        second_sa = User(
            email="second.sa@example.com",
            password_hash=hash_password("SecondTeacherPassword!1"),
            role_id=self.instructor_role.id,
            first_name="Second",
            last_name="Examiner",
            is_active=True,
        )
        self.db.add(second_sa)
        self.db.commit()
        self.db.refresh(second_sa)

        self.assertEqual(
            [item["id"] for item in attempt_service.list_grading_queue(self.db, second_sa)],
            [attempt.id],
        )
        started = attempt_service.start_grading(self.db, self.instructor, attempt.id)
        self.assertEqual(started["queue"]["status"], "claimed")
        self.assertEqual(started["queue"]["assigned_to_name"], "Author Teacher")

        second_queue = attempt_service.list_grading_queue(self.db, second_sa)
        self.assertEqual(second_queue[0]["queue"]["assigned_to_id"], self.instructor.id)
        self.assertEqual(second_queue[0]["queue"]["assigned_to_name"], "Author Teacher")

        with self.assertRaises(Exception) as claim_error:
            grading_service.claim(self.db, second_sa, attempt)
        self.assertIn("Author Teacher", str(claim_error.exception.detail))

        with self.assertRaises(Exception) as open_error:
            attempt_service.get_grading_detail(self.db, second_sa, attempt.id)
        self.assertIn("Author Teacher", str(open_error.exception.detail))

        queue = self.db.query(GradingQueueEntry).filter_by(attempt_id=attempt.id).one()
        queue.claimed_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=6)
        self.db.add(queue)
        self.db.commit()

        restarted = attempt_service.start_grading(self.db, second_sa, attempt.id)
        self.assertEqual(restarted["queue"]["assigned_to_id"], second_sa.id)
        self.assertEqual(restarted["queue"]["assigned_to_name"], "Second Examiner")

    def test_cefr_percentage_policy_boundaries_are_versioned(self):
        self.assertEqual(cefr_service.level_for_percentage(Decimal("0")), "Pre-A1")
        self.assertEqual(cefr_service.level_for_percentage(Decimal("10")), "A1")
        self.assertEqual(cefr_service.level_for_percentage(Decimal("20")), "A2")
        self.assertEqual(cefr_service.level_for_percentage(Decimal("39.9")), "A2")
        self.assertEqual(cefr_service.level_for_percentage(Decimal("40")), "B1")
        self.assertEqual(cefr_service.level_for_percentage(Decimal("60")), "B2")
        self.assertEqual(cefr_service.level_for_percentage(Decimal("75")), "C1")
        self.assertEqual(cefr_service.level_for_percentage(Decimal("90")), "C2")
        self.assertIn("languagecert", cefr_service.POLICY_VERSION)

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
            "rules_consent": True,
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
                "rules_consent": True,
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
        resumed_view = attempt_service.get_student_view(
            self.db, attempt, security_authorized=True
        )
        self.assertEqual(resumed_view["security_heartbeat_sequence"], 1)
        self.assertEqual(
            self.db.query(AttemptFlag).filter_by(attempt_id=attempt.id, flag_type="camera_stopped").count(),
            1,
        )
        with self.assertRaises(Exception):
            attempt_service.require_live_security(attempt)

    def test_final_test_requires_consent_and_auto_submits_after_three_violations(self):
        module = self._build_reading_module()
        module.module_type = "final_test"
        self.db.add(module)
        self.db.commit()

        created = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, created["id"])
        session = SimpleNamespace(device_id=43)
        client_id = "test-client-identifier-0003"
        base_payload = {
            "client_id": client_id,
            "camera_active": True,
            "microphone_active": True,
            "screen_share_active": True,
            "fullscreen_active": True,
            "display_surface": "monitor",
        }

        with self.assertRaises(Exception):
            attempt_service.secure_preflight(
                self.db, attempt, session, {**base_payload, "rules_consent": False}, "127.0.0.1"
            )

        preflight = attempt_service.secure_preflight(
            self.db, attempt, session, {**base_payload, "rules_consent": True}, "127.0.0.1"
        )
        attempt_service.begin_secure_attempt(self.db, attempt, session, preflight["attempt_token"])
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt.id)

        first = attempt_service.record_flag(self.db, attempt, "blur", None, client_sequence=1)
        second = attempt_service.record_flag(self.db, attempt, "visibility_change", None, client_sequence=2)
        self.assertEqual(first["violation_count"], 1)
        self.assertEqual(second["violation_count"], 2)
        self.assertFalse(second["auto_submitted"])

        third = attempt_service.record_flag(self.db, attempt, "fullscreen_exit", None, client_sequence=3)
        self.assertEqual(third["violation_count"], 3)
        self.assertTrue(third["auto_submitted"])

        self.db.refresh(attempt)
        self.assertIn(attempt.status, {ATTEMPT_GRADED, ATTEMPT_GRADING})
        self.assertTrue(attempt.security_media_state["auto_submitted_for_violations"])

    def test_student_speaking_question_receives_candidate_material_url(self):
        question = SimpleNamespace(
            id=91,
            question_type="speaking_prompt",
            prompt="Private Sonia script",
            instructions=None,
            passage=None,
            image_path=None,
            options=[],
            interaction={
                "candidate_material_type": "pdf",
                "candidate_material_path": "exam-modules/4/speaking-materials/card.pdf",
                "candidate_material_name": "card.pdf",
            },
            points=Decimal("1"),
            sort_order=0,
        )

        out = attempt_service._redacted_question(question, None)

        # Candidate material is exam content, so it is handed out as a
        # short-lived signed URL rather than a permanent public /storage path -
        # otherwise one candidate could copy the link and pass the material to
        # the next. (Was: a plain /storage URL that worked for anyone, forever.)
        material_url = out["interaction"]["candidate_material_url"]
        self.assertTrue(material_url.startswith("/media/exam-modules/4/speaking-materials/card.pdf?"))
        self.assertIn("sig=", material_url)
        self.assertIn("exp=", material_url)
        self.assertFalse(material_url.startswith("/storage/"))
        self.assertEqual(out["interaction"]["candidate_material_name"], "card.pdf")

        from app.core.media_signing import is_private

        self.assertTrue(is_private("exam-modules/4/speaking-materials/card.pdf"))
        # Listening audio and question images stay public - unchanged.
        self.assertFalse(is_private("exam-modules/4/questions/diagram.webp"))
        self.assertFalse(is_private("exam-modules/4/listening.mp3"))

    def test_a_practice_attempt_waits_at_onboarding_before_it_costs_anything(self):
        """Pressing Start opens pre-exam onboarding, not the paper. Until the
        candidate commences, no sitting is spent and no clock runs - backing out
        of onboarding has to leave them exactly where they were."""
        module = self._build_reading_module()
        self._course_with_module(module.id)

        created = attempt_service.start_attempt(self.db, self.student, module)
        self.assertEqual(created["status"], ATTEMPT_READY)
        # Nothing in the student's history yet, and nothing counted as used.
        self.assertEqual(attempt_service.list_my_attempts(self.db, self.student), [])

        # Backing out returns the sitting, and the next Start is a clean one.
        cancelled = attempt_service.cancel_onboarding_attempt(self.db, self.student, created["id"])
        self.assertTrue(cancelled["cancelled"])
        second = attempt_service.start_attempt(self.db, self.student, module)
        self.assertEqual(second["status"], ATTEMPT_READY)
        # One attempt row, still unspent: the cancelled one was discarded rather
        # than left behind to count against the student.
        remaining = (
            self.db.query(AttemptRow)
            .filter(AttemptRow.user_id == self.student.id, AttemptRow.module_id == module.id)
            .all()
        )
        self.assertEqual([item.status for item in remaining], [ATTEMPT_READY])
        self.assertEqual(remaining[0].sitting_number, 1)

    def test_the_clock_starts_when_the_candidate_enters_the_paper(self):
        """The timer is the paper's, not the onboarding screen's: it is set when
        the attempt commences, however long the candidate spent reading the
        instructions first."""
        module = self._build_reading_module()
        self._course_with_module(module.id)

        created = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, created["id"])
        provisional_expiry = attempt.expires_at
        # Time spent at onboarding, which must not come out of the paper.
        attempt.started_at = attempt.started_at - timedelta(minutes=10)
        attempt.expires_at = attempt.expires_at - timedelta(minutes=10)
        self.db.commit()

        commenced = attempt_service.commence_attempt(self.db, self.student, attempt)

        self.assertEqual(commenced["status"], ATTEMPT_IN_PROGRESS)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, created["id"])
        self.assertGreaterEqual(attempt.expires_at, provisional_expiry - timedelta(seconds=5))
        self.assertAlmostEqual(
            (attempt.expires_at - attempt.started_at).total_seconds(),
            (module.duration_minutes + attempt_service.EXPIRY_BUFFER_MINUTES) * 60,
            delta=5,
        )

    def test_a_second_start_returns_the_attempt_already_at_onboarding(self):
        """A double-click, or a candidate who reopened the tab, is the same
        start - not a second sitting, and not a collision with the unique index
        that would tell them they had already attempted the test."""
        module = self._build_reading_module()
        self._course_with_module(module.id)

        first = attempt_service.start_attempt(self.db, self.student, module)
        second = attempt_service.start_attempt(self.db, self.student, module)

        self.assertEqual(first["id"], second["id"])
        self.assertEqual(second["status"], ATTEMPT_READY)


if __name__ == "__main__":
    unittest.main()
