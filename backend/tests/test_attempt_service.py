import json
import tempfile
import unittest
import uuid
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
from app.core.cache import app_cache
from app.core.security import hash_password
from app.models import Base, ExamModuleAsset, ExamModulePart, ExamModuleQuestion, StudentNotification
from app.models.attempt import (
    ATTEMPT_GRADED,
    ATTEMPT_GRADING,
    ATTEMPT_IN_PROGRESS,
    ATTEMPT_READY,
    ATTEMPT_VIOLATED,
    AiEvaluation,
    AiEvaluationLimit,
    CourseModule,
    Enrollment,
    GradingQueueEntry,
    AttemptPartGrade,
    PART_GRADE_AI_GRADED,
    PART_GRADE_PENDING,
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

    def _build_reading_module(self, title: Optional[str] = None):
        module_title = title or f"Reading {uuid.uuid4().hex[:6]}"
        created = module_authoring_service.create_module(
            self.db, self.instructor, {"module_type": "reading", "title": module_title, "description": None, "instructions": None}, "127.0.0.1"
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

    def _build_writing_module(self, title: Optional[str] = None):
        module_title = title or f"Writing {uuid.uuid4().hex[:6]}"
        created = module_authoring_service.create_module(
            self.db, self.instructor, {"module_type": "writing", "title": module_title, "description": None, "instructions": None}, "127.0.0.1"
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

    def test_analysis_cache_updates_when_ai_grades_land_during_grading(self):
        app_cache.clear_all()
        module = self._build_writing_module()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        for part in attempt.module.parts:
            for question in part.questions:
                attempt_service.save_answer(self.db, attempt, question.id, {"text": "My essay response."})
        attempt_service.submit_attempt(self.db, attempt)

        with patch.object(ai_evaluation_service, "config_status", return_value={"configured": True}), patch.object(
            ai_evaluation_service,
            "_remote_evaluator",
            return_value={
                "summary": "A configured analysis.",
                "strengths": ["Clear task attempt."],
                "improvements": ["Add more precise evidence."],
                "next_steps": ["Revise one response."],
            },
        ) as evaluator:
            pending = student_analysis_service.result_analysis(self.db, attempt)
            self.assertEqual(pending["criteria_breakdown"], [])

            part = sorted(attempt.module.parts, key=lambda item: item.sort_order)[0]
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
            self.db.refresh(attempt)

            updated = student_analysis_service.result_analysis(self.db, attempt)

        self.assertGreaterEqual(evaluator.call_count, 2)
        self.assertTrue(updated["criteria_breakdown"])
        self.assertTrue(any(row["part_label"] == "Writing 1" for row in updated["criteria_breakdown"]))

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
        # The grader's "needs grading" alert carries this attempt id too, so
        # that a re-run of the AI job cannot announce the same paper twice.
        notification = (
            self.db.query(StudentNotification)
            .filter_by(attempt_id=attempt.id, user_id=self.student.id)
            .one()
        )
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

    def _submit_writing_attempt_with(self, module, text: str):
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        for part in attempt.module.parts:
            for question in part.questions:
                attempt_service.save_answer(self.db, attempt, question.id, {"text": text})
        attempt_service.submit_attempt(self.db, attempt)
        return attempt_service.get_student_view(self.db, attempt)

    def test_pending_ai_evaluation_reports_a_countdown_sized_by_what_was_written(self):
        self._enable_ai_evaluation()
        # One module per attempt: a student may only sit a given module once.
        short_module = self._build_writing_module()
        self._course_with_module(short_module.id)
        long_module = self._build_writing_module()
        self._course_with_module(long_module.id)

        short_view = self._submit_writing_attempt_with(short_module, "Too short an answer.")
        long_view = self._submit_writing_attempt_with(long_module, "word " * 600)

        progress = short_view["ai_evaluation_progress"]
        self.assertEqual(short_view["ai_evaluation_status"], "pending")
        self.assertIsNotNone(progress["started_at"])
        self.assertGreater(progress["estimated_seconds"], 0)
        self.assertEqual(progress["skills"], ["writing"])
        self.assertEqual(progress["parts_done"], 0)
        self.assertGreater(progress["parts_total"], 0)

        # The whole point of the timer: a longer submission has to read as a
        # longer wait, not the same spinner.
        self.assertGreater(long_view["ai_evaluation_progress"]["words"], progress["words"])
        self.assertGreater(
            long_view["ai_evaluation_progress"]["estimated_seconds"],
            progress["estimated_seconds"],
        )

    def test_graded_attempt_carries_no_evaluation_countdown(self):
        module = self._build_reading_module()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        attempt_service.submit_attempt(self.db, attempt)

        self.assertIsNone(attempt_service.get_student_view(self.db, attempt)["ai_evaluation_progress"])

    def _grading_alerts(self):
        """"Needs grading" notifications sitting in the SA instructor's inbox."""
        return (
            self.db.query(StudentNotification)
            .filter_by(user_id=self.instructor.id, kind="grading_queue_routed")
            .all()
        )

    def _submit_writing_attempt(self, module):
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        for part in attempt.module.parts:
            for question in part.questions:
                attempt_service.save_answer(self.db, attempt, question.id, {"text": "My essay response."})
        attempt_service.submit_attempt(self.db, attempt)
        return attempt

    def _ai_suggestion(self, payload):
        return {
            "criteria": [
                {
                    "criterion": item["criterion"],
                    "max_marks": str(item["max_marks"]),
                    "marks_awarded": "6",
                    "cefr_level": "C1",
                    "rationale": "AI-scored evidence.",
                }
                for item in payload["rubric"]
            ],
            "comment": "AI evaluation comment.",
            "confidence": 0.9,
        }

    def test_ai_graded_submission_is_never_announced_as_work_for_a_grader(self):
        self._enable_ai_evaluation()
        self._subscribe_student_for_ai()
        module = self._build_writing_module()
        self._course_with_module(module.id)

        attempt = self._submit_writing_attempt(module)

        # Held back while the AI has it: nobody knows yet whether a person is
        # needed, so nobody is told one is.
        self.assertEqual(self._grading_alerts(), [])

        with patch.object(
            ai_evaluation_service, "_remote_evaluator", side_effect=lambda _config, payload: self._ai_suggestion(payload)
        ):
            job_service._auto_grade_attempt(self.db, {"attempt_id": attempt.id})

        self.db.refresh(attempt)
        self.assertTrue(all(grade.status == PART_GRADE_AI_GRADED for grade in attempt.part_grades))
        # The AI marked every part, so the alert is never sent at all.
        self.assertEqual(self._grading_alerts(), [])

    def test_submission_the_ai_could_not_mark_still_reaches_the_grader(self):
        self._enable_ai_evaluation()
        self._subscribe_student_for_ai()
        module = self._build_writing_module()
        self._course_with_module(module.id)

        attempt = self._submit_writing_attempt(module)
        self.assertEqual(self._grading_alerts(), [])

        def run_the_job():
            # Quota exhausted: nothing marked, and no failure row to show for it.
            with patch.object(ai_evaluation_service, "auto_evaluate_submission", return_value=True):
                job_service._auto_grade_attempt(self.db, {"attempt_id": attempt.id})

        # The first runs stay quiet - the scheduler still has retries left, and
        # a paper the AI marks on the second go should never have reached a
        # grader's queue at all.
        run_the_job()
        self.assertEqual(self._grading_alerts(), [])

        for _ in range(job_service.AI_MAX_AUTOMATIC_ATTEMPTS - 1):
            self.db.add(Job(type="ai_auto_grade", payload={"attempt_id": attempt.id}, status="running"))
            self.db.commit()
            run_the_job()

        # Out of automatic tries: now a person owns it, and hears about it.
        self.assertEqual(len(self._grading_alerts()), 1)

        # A further run - a student pressing "try AI marking again" - must not
        # announce the same submission a second time.
        run_the_job()
        self.assertEqual(len(self._grading_alerts()), 1)

    def test_submission_without_ai_marking_alerts_the_grader_at_submit(self):
        module = self._build_writing_module()
        self._course_with_module(module.id)

        self._submit_writing_attempt(module)

        # No AI configured, so the paper is a person's job from the moment it
        # arrives and the alert goes out with the submission as it always did.
        self.assertEqual(len(self._grading_alerts()), 1)

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

        # A run that finished but left the part unmarked - a rate limit on one
        # part of two reports success - is worth repeating once the provider
        # has had a moment, but not before.
        job = self.db.query(Job).filter_by(type="ai_auto_grade").one()
        job.status = "done"
        job.finished_at = datetime.now(timezone.utc)
        self.db.add(job)
        self.db.commit()
        self.assertEqual(job_service.recover_missing_ai_auto_grade_jobs(self.db), 0)

        job.finished_at = datetime.now(timezone.utc) - timedelta(
            seconds=job_service.AI_FIRST_RETRY_AFTER_SECONDS + 30
        )
        self.db.commit()
        self.assertEqual(job_service.recover_missing_ai_auto_grade_jobs(self.db), 1)

    def test_recovery_retries_an_attempt_whose_ai_job_failed(self):
        """A provider blip used to park an attempt in the instructor queue for good.

        Recovery treated "a job exists" as "nothing to do" regardless of how it
        ended, and only ran at startup - so a 502 mid-run meant the attempt was
        never looked at again until someone restarted the backend.
        """
        from datetime import timezone as _tz

        self._enable_ai_evaluation()
        module = self._build_writing_module()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        for part in attempt.module.parts:
            for question in part.questions:
                attempt_service.save_answer(self.db, attempt, question.id, {"text": "My essay response."})
        attempt_service.submit_attempt(self.db, attempt)

        job = self.db.query(Job).filter_by(type="ai_auto_grade").one()
        job.status = "failed"
        job.finished_at = datetime.now(_tz.utc) - timedelta(seconds=30)
        self.db.commit()

        # Too soon after the failure: let the provider settle first.
        self.assertEqual(job_service.recover_missing_ai_auto_grade_jobs(self.db), 0)

        job.finished_at = datetime.now(_tz.utc) - timedelta(
            seconds=job_service.AI_RETRY_AFTER_SECONDS + 60
        )
        self.db.commit()
        self.assertEqual(job_service.recover_missing_ai_auto_grade_jobs(self.db), 1)

        # And it gives up rather than looping on an attempt that keeps failing.
        # The budget is spent in runs: one run writes a failed evaluation row
        # per part and per configured key, so counting those gave a two-part
        # paper no retries at all.
        for row in self.db.query(Job).filter_by(type="ai_auto_grade").all():
            row.status = "failed"
            row.finished_at = datetime.now(_tz.utc) - timedelta(
                seconds=job_service.AI_RETRY_AFTER_SECONDS + 60
            )
        self.db.commit()
        while (
            self.db.query(Job).filter_by(type="ai_auto_grade").count()
            < job_service.AI_MAX_AUTOMATIC_ATTEMPTS
        ):
            self.assertEqual(job_service.recover_missing_ai_auto_grade_jobs(self.db), 1)
            for row in self.db.query(Job).filter_by(type="ai_auto_grade").all():
                row.status = "failed"
                row.finished_at = datetime.now(_tz.utc) - timedelta(
                    seconds=job_service.AI_RETRY_AFTER_SECONDS + 60
                )
            self.db.commit()

        self.assertEqual(job_service.recover_missing_ai_auto_grade_jobs(self.db), 0)

    def test_a_part_lost_to_a_rate_limit_is_retried_instead_of_going_manual(self):
        """The commonest way AI marking "just did not work" for one student.

        A per-minute rate limit takes one part of a two-part paper. The run
        reports "AI-graded 1/2" and is recorded as done, which used to end the
        matter: recovery only ever repeated *failed* jobs, so that part stayed
        unmarked and an instructor was told to grade it by hand.
        """
        self._enable_ai_evaluation()
        self._subscribe_student_for_ai()
        module = self._build_writing_module()
        self._course_with_module(module.id)
        attempt = self._submit_writing_attempt(module)

        second_part_title = sorted(
            (part.title for part in attempt.module.parts if not part.auto_marked)
        )[-1]

        def rate_limited_on_the_second_part(_config, payload):
            # Refused whatever model it is offered: the whole part is out of
            # quota, not just one model on one key.
            if payload["part"]["title"] == second_part_title:
                raise HTTPException(status_code=429, detail="Rate limit reached (5 RPM free tier).")
            return self._ai_suggestion(payload)

        with patch.object(
            ai_evaluation_service, "_remote_evaluator", side_effect=rate_limited_on_the_second_part
        ):
            job_service._auto_grade_attempt(self.db, {"attempt_id": attempt.id})

        self.db.refresh(attempt)
        self.assertEqual(
            len([grade for grade in attempt.part_grades if grade.status == PART_GRADE_PENDING]), 1
        )
        # Nobody is told it needs marking by hand while a retry is still coming.
        self.assertEqual(self._grading_alerts(), [])

        # What the worker records for that run: it finished, and it reported
        # marking a part, so the job itself is "done".
        for row in self.db.query(Job).filter_by(type="ai_auto_grade").all():
            row.status = "done"
            row.finished_at = datetime.now(timezone.utc) - timedelta(
                seconds=job_service.AI_FIRST_RETRY_AFTER_SECONDS + 30
            )
        self.db.commit()

        self.assertEqual(job_service.recover_missing_ai_auto_grade_jobs(self.db), 1)

        with patch.object(
            ai_evaluation_service,
            "_remote_evaluator",
            side_effect=lambda _config, payload: self._ai_suggestion(payload),
        ):
            job_service._auto_grade_attempt(self.db, {"attempt_id": attempt.id})

        self.db.refresh(attempt)
        self.assertTrue(all(grade.status == PART_GRADE_AI_GRADED for grade in attempt.part_grades))
        self.assertEqual(self._grading_alerts(), [])

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

        # Submitting is still not blocked by the missing recordings - that is
        # what this test exists to protect. What changed is the outcome: a part
        # with nothing recorded is scored zero at submit instead of waiting on
        # an examiner who has nothing to listen to.
        self.assertEqual(result["status"], ATTEMPT_GRADED)
        for grade in attempt.part_grades:
            self.assertEqual(grade.status, PART_GRADE_AI_GRADED)
            self.assertEqual(Decimal(grade.total_marks), Decimal("0"))

    def test_speaking_auto_evaluation_batches_all_parts_into_one_provider_call(self):
        self._enable_ai_evaluation()
        self._subscribe_student_for_ai()
        module = self._speaking_module_with_prompts()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        attempt_service.commence_attempt(self.db, self.student, attempt)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        parts = sorted(attempt.module.parts, key=lambda item: item.sort_order)
        for part in parts:
            for question in part.questions:
                attempt_service.save_audio_answer(self.db, attempt, question.id, b"candidate-audio" * 900, ".webm")
        attempt_service.submit_attempt(self.db, attempt)

        captured = {}

        def evaluator(_config, payload):
            captured["payload"] = payload
            return {
                "parts": [
                    {
                        "part_id": part["part_id"],
                        "criteria": [
                            {
                                "criterion": item["criterion"],
                                "marks_awarded": 1,
                                "rationale": f"Evidence for part {part['part_id']}.",
                            }
                            for item in part["rubric"]
                        ],
                        "comment": f"Marked part {part['part_id']}.",
                        "confidence": 0.8,
                    }
                    for part in payload["parts"]
                ],
            }

        with patch.object(ai_evaluation_service, "_remote_evaluator", side_effect=evaluator):
            ai_evaluation_service.auto_evaluate_submission(self.db, attempt)

        self.assertEqual(captured["payload"]["task"], "cefr_rubric_evaluation_batch")
        self.assertEqual(len(captured["payload"]["parts"]), len(parts))
        expected_audio_bytes = sum(
            (settings.storage_path / answer.audio_path).stat().st_size
            for answer in attempt.answers
            if answer.audio_path
        )
        self.assertEqual(captured["payload"]["audio_bytes"], expected_audio_bytes)
        self.assertEqual(self.db.query(AiEvaluation).filter_by(status="completed").count(), 1)
        record = self.db.query(AiEvaluation).filter_by(status="completed").one()
        self.assertEqual(record.request_summary["audio_kb_total"], round(expected_audio_bytes / 1024))
        self.assertEqual(record.request_summary["timeout_seconds"], 180.0)
        self.assertEqual(self.db.query(AiEvaluationLimit).one().used_count, 1)
        self.db.refresh(attempt)
        grades = {grade.part_id: grade for grade in attempt.part_grades}
        self.assertEqual(set(grades), {part.id for part in parts})
        self.assertTrue(all(grade.status == PART_GRADE_AI_GRADED for grade in grades.values()))

    def test_ai_evaluation_timeout_scales_with_cumulative_audio_size(self):
        self.assertEqual(ai_evaluation_service._ai_timeout_for_payload(5 * 1024 * 1024), 240.0)
        self.assertEqual(ai_evaluation_service._ai_timeout_for_payload(10 * 1024 * 1024), 300.0)
        self.assertEqual(ai_evaluation_service._ai_timeout_for_payload(15 * 1024 * 1024), 300.0)
        self.assertEqual(ai_evaluation_service._ai_timeout_for_payload(16 * 1024 * 1024), 300.0)

    def test_final_test_audio_buys_a_longer_evaluation_window(self):
        timeout = ai_evaluation_service._ai_timeout_for_payload

        # A Final Test sends the whole Speaking paper in one request, so the
        # window keeps growing with the payload instead of flattening out.
        self.assertEqual(timeout(5 * 1024 * 1024, is_final=True), 390.0)
        self.assertEqual(timeout(15 * 1024 * 1024, is_final=True), 690.0)
        self.assertEqual(
            timeout(40 * 1024 * 1024, is_final=True),
            ai_evaluation_service.AI_TIMEOUT_FINAL_MAX_SECONDS,
        )

        for megabytes in (3, 6, 12, 18):
            payload = megabytes * 1024 * 1024
            self.assertGreater(timeout(payload, is_final=True), timeout(payload))

        # A part with no audio at all is a written answer either way.
        self.assertEqual(timeout(0, is_final=True), ai_evaluation_service.AI_TIMEOUT_SMALL_SECONDS)

        # The window is read off the built payload, so the flag has to survive
        # the trip from the attempt into the request.
        self.assertEqual(
            ai_evaluation_service._timeout_for_request({"audio_bytes": 5 * 1024 * 1024, "is_final": True}),
            390.0,
        )

    def test_pre_submit_speaking_evaluation_is_not_sent_per_part(self):
        self._enable_ai_evaluation()
        speaking_module = self._speaking_module_with_prompts()
        speaking_part = sorted(speaking_module.parts, key=lambda item: item.sort_order)[0]
        writing_module = self._build_writing_module()
        writing_part = sorted(writing_module.parts, key=lambda item: item.sort_order)[0]

        self.assertFalse(ai_evaluation_service._direct_part_evaluation_allowed(speaking_part))
        self.assertTrue(ai_evaluation_service._direct_part_evaluation_allowed(writing_part))

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
        # A real answer, so the attempt reaches the queue on its merits - an
        # empty one is now scored zero at submit and never needs a marker.
        for part in attempt.module.parts:
            for question in part.questions:
                attempt_service.save_answer(self.db, attempt, question.id, {"text": "A developed academic response."})

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

    def test_ai_evaluation_waits_before_exceeding_key_rpm(self):
        self._enable_ai_evaluation()
        settings_service.set_setting(self.db, "ai.model", "gemini-2.0-flash")
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

        # Which model leads is the plan's business - it starts at the newest
        # the key offers - so the window is filled for whichever that is.
        leading_model = ai_evaluation_service.evaluation_plan(self.db, part.section_type)[0]["model"]
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        for index in range(ai_evaluation_service.DEFAULT_GEMINI_FLASH_RPM):
            self.db.add(
                AiEvaluation(
                    attempt_id=attempt.id,
                    part_id=part.id,
                    requested_by_id=self.student.id,
                    provider="gemini",
                    model=leading_model,
                    status="completed",
                    key_label="Primary API Key",
                    created_at=now - timedelta(seconds=index),
                )
            )
        self.db.commit()

        def evaluator(_config, payload):
            return {
                "criteria": [
                    {"criterion": item["criterion"], "marks_awarded": 6, "rationale": "Evidence in the response."}
                    for item in payload["rubric"]
                ],
                "comment": "Solid draft.",
                "confidence": 0.8,
            }

        with patch.object(ai_evaluation_service, "_remote_evaluator", side_effect=evaluator), patch.object(
            ai_evaluation_service.time,
            "sleep",
        ) as sleep:
            ai_evaluation_service.request_suggestion(self.db, self.instructor, attempt, part)

        self.assertTrue(sleep.called)
        self.assertGreaterEqual(sleep.call_args.args[0], 45)

    def test_ai_evaluation_rpm_throttle_is_model_specific(self):
        self._enable_ai_evaluation()
        settings_service.set_setting(self.db, "ai.model", "gemini-2.5-flash")
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

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        for index in range(ai_evaluation_service.DEFAULT_GEMINI_FLASH_RPM):
            self.db.add(
                AiEvaluation(
                    attempt_id=attempt.id,
                    part_id=part.id,
                    requested_by_id=self.student.id,
                    provider="gemini",
                    model="gemini-3.5-flash",
                    status="completed",
                    key_label="Primary API Key",
                    created_at=now - timedelta(seconds=index),
                )
            )
        self.db.commit()

        def evaluator(_config, payload):
            return {
                "criteria": [
                    {"criterion": item["criterion"], "marks_awarded": 6, "rationale": "Evidence in the response."}
                    for item in payload["rubric"]
                ],
                "comment": "Solid draft.",
                "confidence": 0.8,
            }

        with patch.object(ai_evaluation_service, "_remote_evaluator", side_effect=evaluator), patch.object(
            ai_evaluation_service.time,
            "sleep",
        ) as sleep:
            ai_evaluation_service.request_suggestion(self.db, self.instructor, attempt, part)

        sleep.assert_not_called()

    def test_ai_quota_summary_separates_same_key_by_model(self):
        from app.services import ai_quota_service

        self._enable_ai_evaluation()
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        module = self._build_writing_module()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        part = sorted(attempt.module.parts, key=lambda item: item.sort_order)[0]
        for model in ("gemini-2.5-flash", "gemini-3.5-flash"):
            self.db.add(
                AiEvaluation(
                    attempt_id=attempt.id,
                    part_id=part.id,
                    requested_by_id=self.student.id,
                    provider="gemini",
                    model=model,
                    status="completed",
                    key_label="Primary API Key",
                    created_at=now,
                )
            )
        self.db.commit()

        summary = ai_quota_service.usage_summary(self.db)
        by_key = {row["key"]: row for row in summary["keys"]}

        self.assertEqual(by_key["Primary API Key · gemini-2.5-flash"]["requests_today"], 1)
        self.assertEqual(by_key["Primary API Key · gemini-3.5-flash"]["requests_today"], 1)
        self.assertIn("queue", summary)
        self.assertIn("performance", summary)
        self.assertEqual(summary["performance"]["timeout_failures_today"], 0)

    def test_ai_auto_evaluation_stops_current_pass_after_rate_limit(self):
        self._enable_ai_evaluation()
        self._subscribe_student_for_ai()
        module = self._build_writing_module()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        for part in attempt.module.parts:
            for question in part.questions:
                attempt_service.save_answer(self.db, attempt, question.id, {"text": "A developed academic response."})
        attempt_service.submit_attempt(self.db, attempt)

        def rate_limited(_config, _payload):
            raise HTTPException(status_code=429, detail="Google Gemini API rate limit reached (15 RPM free tier limit).")

        with patch.object(ai_evaluation_service, "_remote_evaluator", side_effect=rate_limited):
            quota_exhausted = ai_evaluation_service.auto_evaluate_submission(self.db, attempt)

        self.assertTrue(quota_exhausted)
        # Every (model, key) pair on the plan is refused, and the pass stops
        # rather than carrying on into the next part.
        self.assertGreaterEqual(self.db.query(AiEvaluation).filter_by(status="failed").count(), 1)
        self.assertTrue(all(grade.status == PART_GRADE_PENDING for grade in attempt.part_grades))

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

    def test_empty_answer_scores_zero_instead_of_waiting_for_an_instructor(self):
        """A part with nothing in it is a zero, not a queue item.

        It used to be sent to the provider, rejected as "no response found",
        recorded as a failure and left pending - so a blank answer held up the
        student's whole result behind an instructor who had nothing to read.
        """
        self._enable_ai_evaluation()
        self._subscribe_student_for_ai()
        module = self._build_writing_module()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        parts = sorted(attempt.module.parts, key=lambda item: item.sort_order)
        # First part answered properly, second left blank.
        for question in parts[0].questions:
            attempt_service.save_answer(self.db, attempt, question.id, {"text": "A developed academic response."})
        for question in parts[1].questions:
            attempt_service.save_answer(self.db, attempt, question.id, {"text": "   "})
        attempt_service.submit_attempt(self.db, attempt)

        def evaluator(_config, payload):
            return {
                "criteria": [
                    {"criterion": item["criterion"], "marks_awarded": 6, "rationale": "Evidence in the response."}
                    for item in payload["rubric"]
                ],
                "comment": "Solid draft.",
                "confidence": 0.8,
            }

        with patch.object(ai_evaluation_service, "_remote_evaluator", side_effect=evaluator):
            ai_evaluation_service.auto_evaluate_submission(self.db, attempt)

        grades = {grade.part_id: grade for grade in attempt.part_grades}
        answered, blank = grades[parts[0].id], grades[parts[1].id]

        self.assertEqual(answered.status, PART_GRADE_AI_GRADED)
        self.assertGreater(Decimal(answered.total_marks), Decimal("0"))

        self.assertEqual(blank.status, PART_GRADE_AI_GRADED)
        self.assertEqual(Decimal(blank.total_marks), Decimal("0"))
        self.assertTrue(all(item["marks_awarded"] == "0" for item in blank.criteria))
        self.assertIn("No written answer", blank.comment)
        # And it is on the record as settled, not as a provider failure.
        row = self.db.query(AiEvaluation).filter_by(part_id=parts[1].id).one()
        self.assertEqual(row.status, "auto_zero")
        self.assertEqual(row.provider, "system")

    def test_submitting_an_empty_part_returns_the_zero_immediately(self):
        """The zero lands in the submit response, not after the background job.

        A skipped Speaking part used to show "awaiting examiner marking" until
        a job ran and found nothing to send - so the student waited on a queue
        for a mark that needed no thought.
        """
        self._enable_ai_evaluation()
        self._subscribe_student_for_ai()
        module = self._build_writing_module()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        for part in attempt.module.parts:
            for question in part.questions:
                attempt_service.save_answer(self.db, attempt, question.id, {"text": ""})

        result = attempt_service.submit_attempt(self.db, attempt)

        # Nothing was left for the AI, so the whole attempt is finished already.
        self.assertEqual(result["status"], ATTEMPT_GRADED)
        self.assertEqual(result["ai_evaluation_status"], "completed")
        for grade in attempt.part_grades:
            self.assertEqual(grade.status, PART_GRADE_AI_GRADED)
            self.assertEqual(Decimal(grade.total_marks), Decimal("0"))
        # One grade row per part - the pending row is updated, not duplicated.
        self.assertEqual(len(attempt.part_grades), len(attempt.module.parts))

    def test_short_recording_counts_as_no_answer(self):
        module = self._build_writing_module()
        part = sorted(module.parts, key=lambda item: item.sort_order)[0]
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])

        self.assertIn("No written answer", ai_evaluation_service._unanswered_reason(attempt, part))
        for question in part.questions:
            attempt_service.save_answer(self.db, attempt, question.id, {"text": "too short"})
        self.db.refresh(attempt)
        self.assertIn("too short to assess", ai_evaluation_service._unanswered_reason(attempt, part))
        for question in part.questions:
            attempt_service.save_answer(self.db, attempt, question.id, {"text": "A properly developed academic answer."})
        self.db.refresh(attempt)
        self.assertIsNone(ai_evaluation_service._unanswered_reason(attempt, part))

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
        self.assertEqual(captured["mime_type"], "audio/webm")

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

        res = attempt_service.save_answer(self.db, attempt, question.id, {"text": "three word answer"})
        self.assertIn("revision", res)

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

        # Each option now carries what it can mark, so the settings screen can
        # offer a Speaking list and a Writing list that are actually different.
        self.assertEqual(
            models,
            [{
                "value": "gemini-2.0-flash",
                "label": "Gemini 2.0 Flash",
                "skills": ["speaking", "writing"],
                "available": True,
            }],
        )

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

        # Embeddings are dropped, and each model carries what it can mark: the
        # plain chat models reject `input_audio`, so only the audio variant is
        # offered for Speaking.
        self.assertEqual(
            models,
            [
                {"value": "gpt-4o-mini", "label": "gpt-4o-mini", "skills": ["writing"], "available": True},
                {
                    "value": "gpt-4o-audio-preview",
                    "label": "gpt-4o-audio-preview",
                    "skills": ["speaking", "writing"],
                    "available": True,
                },
                {"value": "gpt-5-mini", "label": "gpt-5-mini", "skills": ["writing"], "available": True},
            ],
        )
        self.assertEqual(
            [option["value"] for option in ai_evaluation_service.models_for_skill(models, "speaking")],
            ["gpt-4o-audio-preview"],
        )

    @staticmethod
    def _fake_gemini_models(model_ids, *, list_ok=True):
        """Stands in for Google's model directory."""
        class Response:
            status_code = 200 if list_ok else 404

            def raise_for_status(self):
                if not list_ok:
                    import httpx as _httpx

                    request = _httpx.Request("GET", "https://generativelanguage.googleapis.com/v1beta/models")
                    raise _httpx.HTTPStatusError(
                        "404 Not Found", request=request, response=_httpx.Response(404, request=request)
                    )

            def json(self):
                return {"models": [
                    {"name": f"models/{model_id}", "displayName": model_id,
                     "supportedGenerationMethods": ["generateContent"]}
                    for model_id in model_ids
                ]}

        class Client:
            def __init__(self, *args, **kwargs):
                pass

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return None

            def get(self, *args, **kwargs):
                return Response()

        return Client

    def _save_gemini_key(self, **overrides):
        key = {
            "id": "gemini-1",
            "label": "Primary",
            "provider": "gemini",
            "model": "gemini-2.5-flash",
            "api_key": "AIza-secret",
            "enabled": True,
            "priority": 1,
        }
        key.update(overrides)
        ai_evaluation_service.save_configured_keys(self.db, [key])
        self.db.commit()

    def test_each_skill_gets_its_own_model_list(self):
        self._save_gemini_key()
        client = self._fake_gemini_models([
            "gemini-2.5-flash", "gemini-2.5-pro", "gemma-3-27b-it", "text-embedding-004",
        ])

        with patch.object(ai_evaluation_service.httpx, "Client", client):
            result = ai_evaluation_service.list_configured_key_models(
                self.db, key_id="gemini-1", provider="gemini", api_key="AIza-secret",
            )

        self.assertTrue(result["ok"])
        # Embeddings cannot mark anything; Gemma reads but cannot hear.
        self.assertEqual(
            [option["value"] for option in result["writing_models"]],
            ["gemini-2.5-flash", "gemini-2.5-pro"],
        )
        self.assertEqual(
            [option["value"] for option in result["speaking_models"]],
            ["gemini-2.5-flash", "gemini-2.5-pro"],
        )
        # A working key is never left needing a decision before it can mark.
        self.assertTrue(result["writing_model"])
        self.assertTrue(result["speaking_model"])

    def _save_keys_with_models(self, live_models, count=3):
        ai_evaluation_service.save_configured_keys(self.db, [
            {
                "id": f"key-{index}",
                "label": f"Key {index}",
                "provider": "gemini",
                "model": live_models[0],
                "writing_model": live_models[0],
                "speaking_model": live_models[0],
                "model_options": [
                    {
                        "value": model,
                        "label": model,
                        "available": True,
                        "skills": ["speaking", "writing"],
                    }
                    for model in live_models
                ],
                "api_key": f"AIza-{index}",
                "enabled": True,
                "priority": index,
            }
            for index in range(1, count + 1)
        ])
        # Pretend the directory has been refreshed for each key.
        from app.services.settings_service import set_setting
        set_setting(self.db, ai_evaluation_service.LIVE_MODELS_SETTING, json.dumps({
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "keys": {f"key-{index}": live_models for index in range(1, count + 1)},
        }))
        self.db.commit()

    def _composite_module_with_writing_and_speaking(self):
        """A full mock: Writing parts and Speaking parts in one paper."""
        created = module_authoring_service.create_module(
            self.db,
            self.instructor,
            {"module_type": "full_mock", "title": "Full Mock A", "description": None, "instructions": None},
            "127.0.0.1",
        )
        module = module_authoring_service.get_module_or_404(self.db, created["id"])
        for part in module.parts:
            if part.auto_marked:
                continue
            question_type = "speaking_prompt" if part.section_type == "speaking" else "essay"
            self.db.add(
                ExamModuleQuestion(
                    part_id=part.id,
                    **_question(question_type, f"{part.title} prompt", Decimal(part.max_marks or 1), []),
                    source_type="manual",
                    source_filename=None,
                    sort_order=0,
                    created_by_id=self.instructor.id,
                )
            )
        self.db.commit()
        self.db.expire_all()
        return module_authoring_service.get_module_or_404(self.db, module.id)

    def test_no_grade_notice_goes_out_when_speaking_was_never_sat(self):
        """"Final Test Live has been graded - 2.00 / 164.00".

        A paper whose interview never happened is not a result worth
        announcing; the score is whatever the written half came to.
        """
        from app.models.notification import StudentNotification

        module = self._composite_module_with_writing_and_speaking()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        attempt_service.commence_attempt(self.db, self.student, attempt)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        # Written answers only - the interview was deferred and never taken.
        for part in attempt.module.parts:
            if part.section_type == "speaking":
                continue
            for question in part.questions:
                attempt_service.save_answer(self.db, attempt, question.id, {"text": "A response."})

        self.assertTrue(attempt_service._speaking_was_never_attempted(attempt))

        # What submission leaves behind: every subjective part carries a
        # published grade, the unanswered Speaking one scored zero.
        attempt.status = "grading"
        for part in attempt.module.parts:
            if part.auto_marked:
                continue
            self.db.add(AttemptPartGrade(
                attempt_id=attempt.id,
                part_id=part.id,
                criteria=[],
                total_marks=Decimal("0") if part.section_type == "speaking" else Decimal("1"),
                status="ai_graded",
            ))
        self.db.commit()
        self.db.refresh(attempt)

        self.assertTrue(attempt_service._finalize_if_all_graded(self.db, attempt))
        self.db.refresh(attempt)
        self.assertEqual(attempt.status, "graded")

        notices = (
            self.db.query(StudentNotification)
            .filter_by(attempt_id=attempt.id, kind="grade_released")
            .all()
        )
        self.assertEqual(notices, [], "no grade notice while the interview is outstanding")

    def test_deferring_speaking_closes_the_paper_without_starting_the_clock(self):
        """"Later" has to mean later.

        `start_now` was accepted and then ignored, so every seal started the
        interview immediately and a candidate who wanted to come back had no
        way to say so.
        """
        module = self._composite_module_with_writing_and_speaking()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        attempt_service.commence_attempt(self.db, self.student, attempt)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        for part in sorted(attempt.module.parts, key=lambda item: item.sort_order):
            for question in part.questions:
                if part.section_type == "speaking":
                    attempt_service.save_audio_answer(self.db, attempt, question.id, b"audio" * 4000, ".webm")
                else:
                    attempt_service.save_answer(self.db, attempt, question.id, {"text": "A response."})

        expiry_before = attempt.expires_at

        deferred = attempt_service.seal_main_paper_for_speaking(self.db, attempt, start_now=False)
        self.assertEqual(attempt_service._attempt_phase(deferred), "speaking_pending")
        # The Speaking clock has not been started.
        self.assertEqual(deferred.expires_at, expiry_before)
        # The written paper is closed either way.
        with self.assertRaises(HTTPException) as ctx:
            writing_part = next(p for p in deferred.module.parts if p.section_type == "writing")
            attempt_service.save_answer(self.db, deferred, writing_part.questions[0].id, {"text": "late edit"})
        self.assertEqual(ctx.exception.status_code, 423)

        # An attempt waiting for its interview is not expired out from under
        # the candidate while they are away.
        view = attempt_service.get_student_view(self.db, deferred)
        self.assertEqual(view["phase"], "speaking_pending")
        self.assertEqual(view["status"], "in_progress")

        started = attempt_service.seal_main_paper_for_speaking(self.db, deferred, start_now=True)
        self.assertEqual(attempt_service._attempt_phase(started), "speaking")
        # Starting swaps the paper's window for the Speaking one, which is its
        # own (shorter) allowance rather than whatever was left of the paper.
        self.assertNotEqual(started.expires_at, expiry_before)
        self.assertGreater(started.expires_at, datetime.now(timezone.utc).replace(tzinfo=None))

    def test_the_speaking_handover_records_a_lapse_rather_than_refusing_it(self):
        """A candidate whose share blinked used to be stopped at the door.

        The main paper is already sealed and answered by this point, so there
        is nowhere to send them back to - the lapse belongs in the proctoring
        log, not in the way.
        """
        module = self._composite_module_with_writing_and_speaking()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        attempt_service.commence_attempt(self.db, self.student, attempt)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        for part in sorted(attempt.module.parts, key=lambda item: item.sort_order):
            for question in part.questions:
                if part.section_type == "speaking":
                    attempt_service.save_audio_answer(self.db, attempt, question.id, b"audio" * 4000, ".webm")
                else:
                    attempt_service.save_answer(self.db, attempt, question.id, {"text": "A response."})

        # Proctoring says the share has dropped and the heartbeat is stale.
        attempt.security_required = True
        attempt.security_media_state = {
            "camera_active": True,
            "microphone_active": True,
            "fullscreen_active": True,
            "screen_share_active": False,
        }
        attempt.security_last_heartbeat_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=5)
        self.db.commit()

        # Saving an answer with the same lapse in place must not be refused
        # either - the candidate is no longer shown a screen explaining a
        # block, so a block would just lose their work.
        writing_part = next(part for part in attempt.module.parts if part.section_type == "writing")
        attempt_service.save_answer(
            self.db, attempt, writing_part.questions[0].id, {"text": "Still typing."}
        )

        before = len(attempt.flags)
        sealed = attempt_service.seal_main_paper_for_speaking(self.db, attempt, start_now=True)
        self.db.refresh(sealed)

        # It went through, and the lapse is on the record.
        self.assertEqual(sealed.phase if hasattr(sealed, "phase") else attempt_service._attempt_phase(sealed), "speaking")
        recorded = {flag.flag_type for flag in sealed.flags[before:]}
        self.assertIn("screen_share_stopped", recorded)
        self.assertIn("visibility_change", recorded)

    def test_a_final_test_marks_writing_and_speaking_in_one_request(self):
        """One request for the whole paper.

        Daily and per-minute limits count requests, not parts, so a Final Test
        that spent one call per essay plus another for the interview burned
        three of the day's requests on one candidate. Together they cost one.
        """
        self._enable_ai_evaluation()
        self._subscribe_student_for_ai()
        module = self._composite_module_with_writing_and_speaking()
        self._course_with_module(module.id)

        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        attempt_service.commence_attempt(self.db, self.student, attempt)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        for part in sorted(attempt.module.parts, key=lambda item: item.sort_order):
            for question in part.questions:
                if part.section_type == "speaking":
                    attempt_service.save_audio_answer(
                        self.db, attempt, question.id, b"candidate-audio" * 900, ".webm"
                    )
                else:
                    attempt_service.save_answer(self.db, attempt, question.id, {"text": "A developed response."})
        attempt_service.submit_attempt(self.db, attempt)

        payloads = []

        def evaluator(_config, payload):
            payloads.append(payload)
            return {
                "parts": [
                    {
                        "part_id": part["part_id"],
                        "criteria": [
                            {"criterion": item["criterion"], "marks_awarded": 1, "rationale": "Evidence."}
                            for item in part["rubric"]
                        ],
                        "comment": "Marked.",
                        "confidence": 0.8,
                    }
                    for part in payload["parts"]
                ],
            }

        with patch.object(ai_evaluation_service, "_remote_evaluator", side_effect=evaluator):
            ai_evaluation_service.auto_evaluate_submission(self.db, attempt)

        # One call, carrying every part of the paper.
        self.assertEqual(len(payloads), 1)
        sent = payloads[0]
        self.assertEqual(sent["task"], "cefr_rubric_evaluation_batch")
        self.assertEqual(sorted(sent["skills"]), ["speaking", "writing"])
        self.assertEqual(
            sorted(part["section_type"] for part in sent["parts"]),
            sorted(part.section_type for part in attempt.module.parts if not part.auto_marked),
        )

        self.db.refresh(attempt)
        self.assertTrue(all(grade.status == PART_GRADE_AI_GRADED for grade in attempt.part_grades))

    def test_the_quota_card_shows_the_order_the_evaluator_will_really_use(self):
        """The card had its own copy of the routing rules.

        The moment the real rule changed - newest first unless a key is pinned
        - the card carried on describing the old one, naming a model as "in
        use" that nothing would reach for.
        """
        from app.services import ai_quota_service

        live = ["gemini-3.7-flash", "gemini-2.5-flash"]
        self._save_keys_with_models(live, count=2)
        ai_evaluation_service.save_configured_keys(self.db, [
            {
                "id": f"key-{index}", "label": f"API Key {index}", "provider": "gemini",
                "model": "gemini-2.5-flash", "api_key": f"AIza-{index}",
                "enabled": True, "priority": index,
            }
            for index in (1, 2)
        ])
        self.db.commit()

        card = ai_quota_service.usage_summary(self.db)["plan"]["writing"]
        runtime = ai_evaluation_service.evaluation_plan(self.db, "writing")

        self.assertEqual(
            [(entry["model"], entry["key_id"]) for entry in card["entries"]],
            [(entry["model"], entry["key_id"]) for entry in runtime],
        )
        self.assertEqual(card["active"]["model"], "gemini-3.7-flash")
        self.assertEqual([group["position"] for group in card["model_groups"]], [1, 2])

    def test_a_stale_pin_from_a_replaced_key_is_not_tested(self):
        """A replacement key must only test models in its live directory."""
        self._save_gemini_key(model="gemini-3.7-flash")
        client = self._fake_gemini_models(["gemini-3.7-flash", "gemini-2.5-pro"])
        dialled: list[str] = []

        def fake_test_connection(*, provider, api_key, model, endpoint_url=None, evaluator=None):
            dialled.append(model)
            return {
                "ok": True, "model": model, "message": "ok", "latency_ms": 1,
                "key_preview": "x", "supported": True, "provider": provider,
                "provider_label": "Google Gemini",
            }

        with patch.object(ai_evaluation_service.httpx, "Client", client), patch.object(
            ai_evaluation_service, "test_connection", fake_test_connection
        ):
            ai_evaluation_service.test_configured_key(
                self.db,
                key_id="gemini-1",
                provider="gemini",
                api_key="AIza-secret",
                # Deliberately inherited from the previous key and absent
                # from this replacement key's directory.
                preferred_model="gemini-3.5-flash",
            )

        self.assertEqual(dialled, ["gemini-3.7-flash"])

    def test_image_models_are_never_offered_as_markers(self):
        for rejected in ("gemini-3-pro-image-preview", "nano-banana-2", "gemini-2.5-flash-image"):
            self.assertEqual(ai_evaluation_service.model_skills("gemini", rejected), set(), rejected)

    def test_aliases_previews_and_transcribers_are_not_offered_for_marking(self):
        """The routing list had grown to fifty-odd entries per skill.

        An alias moves under you - which is how a working configuration turned
        into a 404 overnight - a preview can be withdrawn without notice, and a
        transcriber returns a transcript where a rubric score was asked for.
        None of them belong in automatic marking.
        """
        for rejected in (
            "gemini-3.5-transcribe",
            "gemini-flash-lite-latest",
            "gemini-3.1-flash-lite-preview",
            "gemini-2.0-flash-exp",
        ):
            self.assertEqual(ai_evaluation_service.model_skills("gemini", rejected), set(), rejected)

        for accepted in ("gemini-3.7-flash", "gemini-2.5-pro", "gemini-3.5-flash-lite"):
            self.assertIn("writing", ai_evaluation_service.model_skills("gemini", accepted), accepted)

    def test_by_default_the_newest_model_leads_whatever_was_saved(self):
        """No pin means no opinion: the run starts at the best model the keys
        actually offer, not at whatever was stored months ago."""
        live = ["gemini-3.7-flash", "gemini-3.5-flash", "gemini-2.5-flash-lite"]
        self._save_keys_with_models(live, count=2)
        # Saved pointing at the weakest model, with nothing pinned.
        ai_evaluation_service.save_configured_keys(self.db, [
            {
                "id": f"key-{index}", "label": f"Key {index}", "provider": "gemini",
                "model": "gemini-2.5-flash-lite", "api_key": f"AIza-{index}",
                "enabled": True, "priority": index,
                "model_options": [
                    {"value": value, "label": value, "skills": ["writing", "speaking"], "available": True}
                    for value in live
                ],
            }
            for index in (1, 2)
        ])
        self.db.commit()

        plan = ai_evaluation_service.evaluation_plan(self.db, "writing")
        self.assertEqual(plan[0]["model"], "gemini-3.7-flash")
        self.assertEqual(plan[1]["model"], "gemini-3.7-flash")

        # A pin is still honoured, and leads.
        ai_evaluation_service.save_configured_keys(self.db, [
            {
                "id": "key-1", "label": "Key 1", "provider": "gemini",
                "model": "gemini-3.7-flash", "preferred_model": "gemini-3.5-flash",
                "api_key": "AIza-1", "enabled": True, "priority": 1,
            }
        ])
        self.db.commit()
        pinned_plan = ai_evaluation_service.evaluation_plan(self.db, "writing")
        self.assertEqual(pinned_plan[0]["model"], "gemini-3.5-flash")

    def test_the_plan_gives_up_when_it_runs_out_of_time(self):
        """A count alone bounds nothing.

        Each attempt carries its own timeout - up to fifteen minutes for a
        Final Test - so a provider that stops answering rather than refusing
        could hold the worker for hours on one part.
        """
        self._subscribe_student_for_ai()
        module = self._build_writing_module()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        for part in attempt.module.parts:
            for question in part.questions:
                attempt_service.save_answer(self.db, attempt, question.id, {"text": "A developed response."})
        attempt_service.submit_attempt(self.db, attempt)
        part = sorted(attempt.module.parts, key=lambda item: item.sort_order)[0]

        calls = {"count": 0}

        def failing(_config, _payload):
            calls["count"] += 1
            # A 400 is not "transient", so it is not retried inline - one call
            # per plan entry, which is what makes the count meaningful here.
            raise HTTPException(status_code=400, detail="provider refused")

        configs = [
            {"provider": "gemini", "model": f"gemini-2.{index}-flash", "monthly_limit": 100, "api_key": f"key-{index}"}
            for index in range(10)
        ]
        with patch.object(ai_evaluation_service, "EVALUATION_PLAN_MAX_SECONDS", 0.0):
            with self.assertRaises(HTTPException):
                ai_evaluation_service.request_suggestion(
                    self.db, self.instructor, attempt, part, evaluator=failing, configs=configs
                )

        # The first entry is always tried; the budget stops the rest.
        self.assertEqual(calls["count"], 1)

    def test_the_best_model_is_spent_on_every_key_before_dropping_a_level(self):
        live = ["gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-2.5-pro"]
        self._save_keys_with_models(live, count=3)

        plan = ai_evaluation_service.evaluation_plan(self.db, "writing")
        order = [(entry["key_id"], entry["model"]) for entry in plan]

        # Every key is tried on the best model before anything steps down.
        self.assertEqual(
            order[:3],
            [("key-1", "gemini-3.7-flash"), ("key-2", "gemini-3.7-flash"), ("key-3", "gemini-3.7-flash")],
        )
        self.assertEqual(
            order[3:6],
            [("key-1", "gemini-3.5-flash"), ("key-2", "gemini-3.5-flash"), ("key-3", "gemini-3.5-flash")],
        )
        # Pro outranks an older Flash, and Lite is the last resort of all.
        models_in_order = [model for _key, model in order]
        self.assertLess(models_in_order.index("gemini-2.5-pro"), models_in_order.index("gemini-3.5-flash-lite"))
        self.assertEqual(models_in_order[-1], "gemini-3.5-flash-lite")

    def test_a_model_out_of_daily_quota_drops_out_until_the_day_resets(self):
        live = ["gemini-3.7-flash", "gemini-3.5-flash"]
        self._save_keys_with_models(live, count=2)

        plan = ai_evaluation_service.evaluation_plan(self.db, "writing")
        self.assertIn(("key-1", "gemini-3.7-flash"), [(e["key_id"], e["model"]) for e in plan])

        # Key 1 spends its day on the best model.
        config = next(entry for entry in plan if entry["key_id"] == "key-1")
        ai_evaluation_service.mark_rpd_exhausted(self.db, config, "gemini-3.7-flash")

        after = [(entry["key_id"], entry["model"]) for entry in ai_evaluation_service.evaluation_plan(self.db, "writing")]
        # That one pair is out; the same model on the other key is untouched.
        self.assertNotIn(("key-1", "gemini-3.7-flash"), after)
        self.assertIn(("key-2", "gemini-3.7-flash"), after)
        self.assertIn(("key-1", "gemini-3.5-flash"), after)
        self.assertTrue(ai_evaluation_service.is_rpd_exhausted(self.db, config, "gemini-3.7-flash"))

        # And it comes back once the quota day has rolled over.
        from app.services.settings_service import set_setting
        set_setting(self.db, ai_evaluation_service.RPD_EXHAUSTED_SETTING, json.dumps({
            f"key-1|gemini-3.7-flash": (datetime.now(timezone.utc) - timedelta(hours=1)).replace(tzinfo=None).isoformat(),
        }))
        self.db.commit()
        self.assertFalse(ai_evaluation_service.is_rpd_exhausted(self.db, config, "gemini-3.7-flash"))

    def test_a_declared_daily_limit_retires_a_model_before_the_provider_does(self):
        live = ["gemini-3.7-flash", "gemini-3.5-flash"]
        self._save_keys_with_models(live, count=1)
        config = ai_evaluation_service.evaluation_plan(self.db, "writing")[0]

        from app.services import ai_quota_service
        ai_quota_service.save_declared_limits(self.db, {
            ai_evaluation_service._quota_limit_key("Key 1", "gemini-3.7-flash"): {"rpd": 2},
        })
        self.db.commit()

        self.assertFalse(ai_evaluation_service.is_rpd_exhausted(self.db, config, "gemini-3.7-flash"))

        module = self._build_writing_module()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        part = sorted(attempt.module.parts, key=lambda item: item.sort_order)[0]
        for _ in range(2):
            self.db.add(AiEvaluation(
                attempt_id=attempt.id, part_id=part.id, requested_by_id=self.student.id,
                provider="gemini", model="gemini-3.7-flash", key_label="Key 1", status="completed",
            ))
        self.db.commit()
        self.assertTrue(ai_evaluation_service.is_rpd_exhausted(self.db, config, "gemini-3.7-flash"))

    def test_quota_summary_exposes_sorted_model_hierarchy(self):
        live = ["gemini-3.7-flash", "gemini-3.5-flash"]
        self._save_keys_with_models(live, count=2)
        module = self._build_writing_module()
        self._course_with_module(module.id)
        attempt_out = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt_out["id"])
        part = sorted(attempt.module.parts, key=lambda item: item.sort_order)[0]

        from app.services import ai_quota_service
        ai_quota_service.save_declared_limits(self.db, {
            ai_evaluation_service._quota_limit_key("Key 1", "gemini-3.7-flash"): {"rpd": 3},
            ai_evaluation_service._quota_limit_key("Key 2", "gemini-3.7-flash"): {"rpd": 4},
        })
        self.db.add(AiEvaluation(
            attempt_id=attempt.id,
            part_id=part.id,
            requested_by_id=self.student.id,
            provider="gemini",
            model="gemini-3.7-flash",
            key_label="Key 1",
            status="completed",
        ))
        self.db.commit()

        summary = ai_quota_service.usage_summary(self.db)
        writing_plan = summary["plan"]["writing"]

        self.assertEqual(writing_plan["active"]["key_label"], "Key 1")
        self.assertEqual(writing_plan["active"]["model"], "gemini-3.7-flash")
        self.assertEqual(writing_plan["active"]["remaining_today"], 2)
        self.assertEqual(writing_plan["next"]["key_label"], "Key 2")
        flash_group = writing_plan["model_groups"][0]
        self.assertEqual(flash_group["model"], "gemini-3.7-flash")
        self.assertEqual(flash_group["keys"], 2)
        self.assertEqual(flash_group["remaining_today"], 6)
        self.assertNotIn("api_key", writing_plan["active"])

    def test_quota_summary_uses_configured_key_model_when_no_key_model_list_is_loaded(self):
        ai_evaluation_service.save_configured_keys(self.db, [
            {
                "id": "key-1",
                "label": "Key 1",
                "provider": "gemini",
                "model": "gemini-2.5-flash",
                "writing_model": "gemini-2.5-flash",
                "speaking_model": "gemini-2.5-flash",
                "api_key": "AIza-1",
                "enabled": True,
                "priority": 1,
            }
        ])
        self.db.commit()

        from app.services import ai_quota_service
        summary = ai_quota_service.usage_summary(self.db)
        reading_writing_plan = summary["plan"]["reading_writing"]

        self.assertIs(summary["plan"]["writing"], reading_writing_plan)
        # With no directory loaded there is nothing to say what the key really
        # offers, so the configured model leads and the standard preference
        # order follows it - a wrong guess there costs one hop, not a paper.
        models = [entry["model"] for entry in reading_writing_plan["entries"]]
        self.assertEqual(models[0], "gemini-2.5-flash")
        self.assertNotIn("gemini-2.5-flash", models[1:])
        self.assertEqual(reading_writing_plan["model_groups"][0]["keys"], 1)

    def test_a_check_keeps_the_model_the_admin_just_chose(self):
        """Detect & test kept resetting the dropdowns to its own pick.

        The choice on screen was never sent, so the server answered about the
        stored key and handed back the first model on the list - overwriting
        an unsaved selection every time.
        """
        self._save_gemini_key(writing_model="gemini-2.5-flash", speaking_model="gemini-2.5-flash")
        client = self._fake_gemini_models(["gemini-2.5-flash", "gemini-2.5-pro"])

        with patch.object(ai_evaluation_service.httpx, "Client", client):
            result = ai_evaluation_service.list_configured_key_models(
                self.db,
                key_id="gemini-1",
                provider="gemini",
                api_key="AIza-secret",
                writing_model="gemini-2.5-pro",
                speaking_model="gemini-2.5-pro",
            )

        self.assertEqual(result["writing_model"], "gemini-2.5-pro")
        self.assertEqual(result["speaking_model"], "gemini-2.5-pro")

        # And a choice the provider no longer offers is corrected rather than
        # kept, because keeping it would fail the next paper.
        with patch.object(ai_evaluation_service.httpx, "Client", client):
            corrected = ai_evaluation_service.list_configured_key_models(
                self.db,
                key_id="gemini-1",
                provider="gemini",
                api_key="AIza-secret",
                writing_model="gemini-1.5-pro",
            )
        self.assertIn(corrected["writing_model"], {"gemini-2.5-flash", "gemini-2.5-pro"})

    def test_detect_and_test_uses_the_start_from_model_on_screen(self):
        """The selector's pin was sent by the UI but ignored by the backend.

        That left the row saying "Start from Gemini 2.5 Flash-Lite" while the
        test request dialled the automatic newest model instead.
        """
        self._save_gemini_key(model="gemini-3.7-flash")
        discovered = [
            {"value": "gemini-3.7-flash", "label": "Gemini 3.7 Flash", "available": True, "skills": ["writing", "speaking"]},
            {"value": "gemini-2.5-flash-lite", "label": "Gemini 2.5 Flash-Lite", "available": True, "skills": ["writing", "speaking"]},
        ]
        tested: list[str] = []

        def fake_test_connection(**kwargs):
            tested.append(kwargs["model"])
            return {
                "ok": True,
                "provider": "gemini",
                "provider_label": "Google Gemini",
                "detected_provider": "gemini",
                "model": kwargs["model"],
                "model_options": [],
                "key_preview": "AIza****",
                "latency_ms": 1,
                "supported": True,
                "message": "Google Gemini accepted the key and returned valid evaluator JSON.",
            }

        with patch.object(ai_evaluation_service, "discover_models", return_value={"models": discovered, "message": "Loaded"}), \
            patch.object(ai_evaluation_service, "test_connection", side_effect=fake_test_connection):
            result = ai_evaluation_service.test_configured_key(
                self.db,
                key_id="gemini-1",
                provider="gemini",
                api_key="AIza-secret",
                preferred_model="gemini-2.5-flash-lite",
            )

        self.assertEqual(tested, ["gemini-2.5-flash-lite"])
        self.assertEqual(result["model"], "gemini-2.5-flash-lite")
        self.assertEqual(result["preferred_model"], "gemini-2.5-flash-lite")

    def test_connection_does_not_fall_through_to_an_unselected_legacy_model(self):
        dialled: list[str] = []

        class FakeResponse:
            status_code = 404
            text = "selected model is unavailable"

            def raise_for_status(self):
                raise RuntimeError("HTTP 404")

        class FakeClient:
            def __enter__(self_inner):
                return self_inner

            def __exit__(self_inner, *_args):
                return False

            def post(self_inner, url, **_kwargs):
                dialled.append(url.split("/models/")[1].split(":")[0])
                return FakeResponse()

        with patch.object(ai_evaluation_service.httpx, "Client", return_value=FakeClient()):
            result = ai_evaluation_service.test_connection(
                provider="gemini",
                api_key="AIza-new-key",
                model="gemini-2.5-pro",
            )

        self.assertFalse(result["ok"])
        self.assertEqual(dialled, ["gemini-2.5-pro"])
        self.assertEqual(result["model"], "gemini-2.5-pro")
        self.assertNotIn("gemini-2.0-flash", result["message"])

    def test_a_key_that_cannot_list_models_says_why_instead_of_a_404(self):
        """What the super admin actually saw: a 404 naming a model they never
        chose, because the app guessed model names and reported the last one."""
        self._save_gemini_key()
        client = self._fake_gemini_models([], list_ok=False)

        with patch.object(ai_evaluation_service.httpx, "Client", client):
            result = ai_evaluation_service.test_configured_key(
                self.db, key_id="gemini-1", provider="gemini", api_key="AIza-secret",
            )

        self.assertFalse(result["ok"])
        self.assertEqual(result["model_options"], [])
        self.assertNotIn("404", result["message"])
        self.assertNotIn("generativelanguage.googleapis.com", result["message"])
        self.assertIn("aistudio.google.com", result["message"])

    def test_one_model_marks_both_skills_so_a_paper_fits_in_one_request(self):
        """Writing and Speaking share a model deliberately.

        Two models cannot go in one request, and one request is what keeps a
        Final Test to a single call against the daily limit.
        """
        self._save_gemini_key(preferred_model="gemini-2.5-pro")
        stored = ai_evaluation_service._configured_keys(self.db, mask=False)[0]
        self.assertEqual(stored["writing_model"], "gemini-2.5-pro")
        self.assertEqual(stored["speaking_model"], "gemini-2.5-pro")

        config = {**stored, "live_models": []}
        for skill in ("writing", "speaking"):
            self.assertEqual(
                ai_evaluation_service.config_for_skill(config, skill)["model"], "gemini-2.5-pro"
            )

    def test_a_speaking_paper_never_falls_back_to_a_model_that_cannot_hear(self):
        # Gemma reads but cannot hear, so it must not appear anywhere in a
        # Speaking chain - a recording sent there is a guaranteed zero.
        live = ["gemma-3-27b-it", "gemini-2.0-flash"]
        speaking = ai_evaluation_service.gemini_model_chain("gemma-3-27b-it", live, skill="speaking")
        self.assertNotIn("gemma-3-27b-it", speaking)
        self.assertEqual(speaking, ["gemini-2.0-flash"])

        writing = ai_evaluation_service.gemini_model_chain("gemma-3-27b-it", live, skill="writing")
        self.assertEqual(writing[0], "gemma-3-27b-it")

    def test_a_retired_model_is_dialled_around_instead_of_failing_the_paper(self):
        """The outage this is here to stop.

        Google retires a model; every request to it comes back 404, and before
        this the whole evaluation failed - so no paper was marked until someone
        edited the fallback in the source. The model here is one we have no
        reason to distrust yet, which is exactly the case that used to break:
        a name still listed as good that Google has quietly switched off.
        """
        ai_evaluation_service.save_configured_keys(self.db, [{
            "id": "gemini-1",
            "label": "Primary",
            "provider": "gemini",
            "model": "gemini-2.0-flash",
            "api_key": "AIza-secret",
            "enabled": True,
            "priority": 1,
        }])
        self.db.commit()

        dialled = []

        class FakeResponse:
            def __init__(self, url):
                self.url = url
                self.status_code = 404 if "gemini-2.0-flash:" in url else 200
                self.text = "models/gemini-2.0-flash is not found for API version v1beta"

            def json(self):
                return {
                    "candidates": [{"content": {"parts": [{"text": json.dumps({
                        "criteria": [{"criterion": "Task", "marks_awarded": 5, "rationale": "ok"}],
                        "comment": "Marked.",
                        "confidence": 0.8,
                    })}]}}],
                    "usageMetadata": {"totalTokenCount": 100},
                }

            def raise_for_status(self):
                if self.status_code >= 400:
                    raise RuntimeError(f"HTTP {self.status_code}")

        class FakeClient:
            def __enter__(self_inner):
                return self_inner

            def __exit__(self_inner, *_args):
                return False

            def post(self_inner, url, **_kwargs):
                dialled.append(url.split("/models/")[1].split(":")[0])
                return FakeResponse(url)

            def get(self_inner, *_args, **_kwargs):
                raise RuntimeError("directory unavailable")

        with patch.object(ai_evaluation_service.httpx, "Client", return_value=FakeClient()):
            result = ai_evaluation_service._gemini_evaluator(
                {"api_key": "AIza-secret", "model": "gemini-2.0-flash", "live_models": []},
                {
                    "task": "cefr_rubric_evaluation",
                    "framework": "F",
                    "policy_version": "1",
                    "skill": "writing",
                    "part": {"title": "Writing 1", "skill_focus": "task"},
                    "rubric": [{"criterion": "Task", "max_marks": "10"}],
                    "responses": [{"prompt": "Write.", "text": "An answer."}],
                    "instructions": "Mark it.",
                    "audio_bytes": 0,
                },
            )

        # The dead number was tried, then a live one - and the paper was marked.
        self.assertEqual(dialled[0], "gemini-2.0-flash")
        self.assertGreater(len(dialled), 1)
        self.assertNotEqual(dialled[1], "gemini-2.0-flash")
        self.assertEqual(result["comment"], "Marked.")
        self.assertEqual(result["_model_substituted"]["requested"], "gemini-2.0-flash")
        self.assertEqual(result["_model_substituted"]["used"], dialled[1])

        # A name we already know Google has retired is never dialled at all.
        self.assertNotIn(
            "gemini-flash-latest",
            ai_evaluation_service.gemini_model_chain("gemini-flash-latest", []),
        )

    def test_a_retired_pro_model_is_never_quietly_swapped_for_a_cheap_one(self):
        # Someone who chose a "pro" model chose it for marking quality. Falling
        # back to flash without saying so changes every grade it touches.
        chain = ai_evaluation_service.gemini_model_chain(
            "gemini-pro-latest", ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"]
        )
        self.assertEqual(chain[0], "gemini-2.5-pro")
        self.assertNotIn("gemini-pro-latest", chain)

    def test_the_model_chain_only_offers_numbers_the_directory_lists(self):
        live = ["gemini-2.0-flash"]
        chain = ai_evaluation_service.gemini_model_chain("gemini-2.5-flash", live)
        self.assertEqual(chain, ["gemini-2.0-flash"])

        # With no directory - Google's model endpoint down - the preference
        # order still has to produce something to call.
        self.assertTrue(ai_evaluation_service.gemini_model_chain("gemini-2.5-flash", []))

    def test_a_model_google_no_longer_lists_is_shown_as_unavailable(self):
        class FakeResponse:
            status_code = 200

            def json(self):
                return {"models": [
                    {"name": "models/gemini-2.0-flash", "supportedGenerationMethods": ["generateContent"]},
                ]}

            def raise_for_status(self):
                return None

        class FakeClient:
            def __enter__(self_inner):
                return self_inner

            def __exit__(self_inner, *_args):
                return False

            def get(self_inner, *_args, **_kwargs):
                return FakeResponse()

        with patch.object(ai_evaluation_service.httpx, "Client", return_value=FakeClient()):
            options = ai_evaluation_service.list_evaluation_models(
                provider="gemini", api_key="AIza-secret", model="gemini-flash-latest"
            )

        retired = next(option for option in options if option["value"] == "gemini-flash-latest")
        self.assertFalse(retired["available"])
        self.assertIn("no longer available", retired["label"])

    def test_saved_ai_key_does_not_keep_an_unavailable_gemini_model(self):
        ai_evaluation_service.save_configured_keys(self.db, [{
            "id": "gemini-1",
            "label": "Gemini key",
            "provider": "gemini",
            "model": "gemini-2.0-flash-lite",
            "api_key": "AIza-secret",
            "enabled": True,
            "priority": 1,
            "model_options": [
                {"value": "gemini-2.0-flash-lite", "label": "Gemini 2.0 Flash Lite - no longer available", "available": False},
                {"value": "gemini-2.5-flash", "label": "Gemini 2.5 Flash"},
            ],
        }])

        [saved] = ai_evaluation_service._configured_keys(self.db, mask=False)
        self.assertEqual(saved["model"], "gemini-2.5-flash")

    def test_saved_ai_key_clears_stale_test_status_when_model_changes(self):
        ai_evaluation_service.save_configured_keys(self.db, [{
            "id": "gemini-1",
            "label": "Gemini key",
            "provider": "gemini",
            "model": "gemini-2.0-flash",
            "api_key": "AIza-secret",
            "enabled": True,
            "priority": 1,
            "last_status": "failed",
            "last_checked_at": "2026-08-31T17:49:00",
            "info": "Google Gemini: 404 for gemini-2.0-flash",
        }])

        ai_evaluation_service.save_configured_keys(self.db, [{
            "id": "gemini-1",
            "label": "Gemini key",
            "provider": "gemini",
            "model": "gemini-2.5-flash",
            "api_key": "********",
            "enabled": True,
            "priority": 1,
        }])

        [saved] = ai_evaluation_service._configured_keys(self.db, mask=False)
        self.assertEqual(saved["model"], "gemini-2.5-flash")
        self.assertIsNone(saved["last_status"])
        self.assertIsNone(saved["last_checked_at"])
        self.assertIsNone(saved["info"])

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
        self.assertEqual(queue.status, "completed")

        with self.assertRaises(HTTPException) as cm:
            grading_service.request_reevaluation(
                self.db,
                self.student,
                attempt,
                "Second reevaluation request should be rejected",
            )
        self.assertEqual(cm.exception.status_code, 409)

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

    def test_final_test_speaking_phase_locks_completed_main_paper(self):
        module = self._build_reading_module()
        module.module_type = "final_test"
        speaking_part = ExamModulePart(
            module_id=module.id,
            section_type="speaking",
            part_code="speaking_1",
            title="Speaking 1",
            skill_focus="Speaking prompt",
            instructions=None,
            question_limit=1,
            minimum_questions=1,
            max_marks=Decimal("1"),
            duration_minutes=2,
            auto_marked=False,
            ai_evaluation_enabled=True,
            answer_constraints={"preparation_seconds": 30, "response_seconds": 60},
            rubric=[],
            sort_order=99,
        )
        self.db.add(speaking_part)
        self.db.flush()
        self.db.add(
            ExamModuleQuestion(
                part_id=speaking_part.id,
                **_question("speaking_prompt", "Talk about a useful course.", Decimal("1"), []),
                source_type="manual",
                source_filename=None,
                sort_order=0,
                created_by_id=self.instructor.id,
            )
        )
        self.db.commit()

        created = attempt_service.start_attempt(self.db, self.student, module)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, created["id"])
        session = SimpleNamespace(device_id=46)
        token = attempt_service.secure_preflight(
            self.db,
            attempt,
            session,
            {
                "client_id": "test-client-identifier-0006",
                "rules_consent": True,
                "camera_active": True,
                "microphone_active": True,
                "screen_share_active": True,
                "fullscreen_active": True,
                "display_surface": "monitor",
            },
            "127.0.0.1",
        )["attempt_token"]
        attempt_service.begin_secure_attempt(self.db, attempt, session, token)
        attempt = attempt_service.get_attempt_or_404(self.db, self.student, attempt.id)

        main_questions = [
            question
            for part in attempt.module.parts
            if part.section_type in attempt_service.MAIN_PAPER_SECTION_TYPES
            for question in part.questions
        ]
        for question in main_questions:
            attempt_service.save_answer(self.db, attempt, question.id, {"selected": "A"})

        # "Later": the paper closes, but the interview has not begun.
        sealed = attempt_service.seal_main_paper_for_speaking(self.db, attempt, start_now=False)
        self.assertEqual(sealed.content_snapshot["phase"], "speaking_pending")
        self.assertGreater(sealed.expires_at.replace(tzinfo=None), datetime.now(timezone.utc).replace(tzinfo=None))

        resumed = attempt_service.get_student_view(self.db, sealed, security_authorized=True)
        self.assertEqual(resumed["phase"], "speaking_pending")
        self.assertTrue(resumed["parts"][-1]["questions"])
        self.assertTrue(all(not part["questions"] for part in resumed["parts"][:-1]))

        [summary] = attempt_service.list_my_attempts(self.db, self.student)
        self.assertEqual(summary["phase"], "speaking_pending")
        self.assertEqual(summary["resume_part_id"], speaking_part.id)

        # And when they come back and start it, the Speaking clock begins.
        started = attempt_service.seal_main_paper_for_speaking(self.db, sealed, start_now=True)
        self.assertEqual(started.content_snapshot["phase"], "speaking")

        with self.assertRaises(HTTPException) as save_ctx:
            attempt_service.save_answer(self.db, sealed, main_questions[0].id, {"selected": "B"})
        self.assertEqual(save_ctx.exception.status_code, 423)
        with self.assertRaises(HTTPException) as part_ctx:
            attempt_service.get_attempt_part_view(sealed, attempt.module.parts[0].id)
        self.assertEqual(part_ctx.exception.status_code, 423)

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

        attempt.security_media_state = {
            **(attempt.security_media_state or {}),
            "camera_active": True,
            "microphone_active": True,
            "screen_share_active": True,
            "fullscreen_active": True,
        }
        self.db.add(attempt)
        self.db.commit()
        screen_loss = {
            **heartbeat,
            "sequence": 2,
            "camera_active": True,
            "screen_share_active": False,
        }
        attempt_service.record_heartbeat(
            self.db, attempt, session, preflight["attempt_token"], screen_loss, "127.0.0.1"
        )
        self.assertEqual(
            self.db.query(AttemptFlag).filter_by(attempt_id=attempt.id, flag_type="screen_share_stopped").count(),
            1,
        )

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
        self.assertIn(attempt.status, {ATTEMPT_GRADED, ATTEMPT_GRADING, ATTEMPT_VIOLATED})
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
