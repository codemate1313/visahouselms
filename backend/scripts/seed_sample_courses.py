"""Seed 6 sample published courses (one for each of the 6 exam modules) and a B2C direct plan.

Usage:
    venv/bin/python3 scripts/seed_sample_courses.py
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models.course import Course, COURSE_PUBLISHED
from app.models.attempt import CourseModule
from app.models.exam_module import ExamModule
from app.models.plan import Plan, AUDIENCE_DIRECT, plan_modules, plan_courses
from app.models.user import User


COURSES_DATA = [
    {
        "module_type": "listening",
        "title": "IELTS Listening Masterclass — Academic Set 1",
        "slug": "ielts-listening-masterclass-academic-set-1",
        "summary": "Master section 1 to 4 listening tasks with audio passages, accent recognition, and strategies.",
        "description": "Comprehensive training covering multiple-choice, form completion, diagram labeling, and short answer listening questions.",
        "level": "all_levels",
        "estimated_duration_minutes": 180,
        "price": Decimal("499.00"),
    },
    {
        "module_type": "reading",
        "title": "IELTS Reading Excellence — Academic Set 1",
        "slug": "ielts-reading-excellence-academic-set-1",
        "summary": "In-depth reading comprehension, skimming & scanning techniques, and True/False/Not Given practice.",
        "description": "Intensive reading module featuring academic texts, vocabulary insights, and step-by-step strategy guides for high band scores.",
        "level": "all_levels",
        "estimated_duration_minutes": 180,
        "price": Decimal("499.00"),
    },
    {
        "module_type": "writing",
        "title": "IELTS Writing Task 1 & Task 2 — Academic Set 1",
        "slug": "ielts-writing-task-1-task-2-academic-set-1",
        "summary": "Academic report writing and essay structuring with instant AI evaluation & feedback.",
        "description": "Covers line graphs, bar charts, process diagrams, and Task 2 opinion/discussion essay frameworks with sample model answers.",
        "level": "all_levels",
        "estimated_duration_minutes": 240,
        "price": Decimal("699.00"),
    },
    {
        "module_type": "speaking",
        "title": "IELTS Speaking Fluency & Cue Cards — Academic Set 1",
        "slug": "ielts-speaking-fluency-cue-cards-academic-set-1",
        "summary": "Interactive Part 1, 2, and 3 speaking prompts with AI pronunciation and fluency scoring.",
        "description": "Practice Cue Card topics, fluency building, lexical resource enrichment, and realistic examiner Q&A sessions.",
        "level": "all_levels",
        "estimated_duration_minutes": 150,
        "price": Decimal("599.00"),
    },
    {
        "module_type": "full_mock",
        "title": "IELTS Complete Practice Mock Exam — Set 1",
        "slug": "ielts-complete-practice-mock-exam-set-1",
        "summary": "Full-length timed mock examination covering Listening, Reading, Writing, and Speaking under realistic exam conditions.",
        "description": "Simulate real test day experience with full band score calculation, detailed module analytics, and AI-powered diagnostic evaluation.",
        "level": "all_levels",
        "estimated_duration_minutes": 200,
        "price": Decimal("899.00"),
    },
    {
        "module_type": "final_test",
        "title": "IELTS Academic Final Assessment Test — Set 1",
        "slug": "ielts-academic-final-assessment-test-set-1",
        "summary": "Official benchmark evaluation designed to measure final test readiness before your exam date.",
        "description": "Final comprehensive evaluation test with detailed performance breakdown across all 4 skill domains.",
        "level": "all_levels",
        "estimated_duration_minutes": 200,
        "price": Decimal("999.00"),
    },
]


def seed_sample_courses():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role_id == 1).first()
        if not admin:
            print("No Super Admin found. Creating courses aborted.")
            return

        now = datetime.now(timezone.utc)
        created_courses = []
        created_modules = []

        for data in COURSES_DATA:
            module_type = data["module_type"]
            # Find the corresponding ExamModule created by seed_dummy_modules.py
            exam_mod = db.query(ExamModule).filter(ExamModule.module_type == module_type).first()
            if not exam_mod:
                print(f"Warning: ExamModule for type '{module_type}' not found! Run seed_dummy_modules.py first.")
                continue

            created_modules.append(exam_mod)

            # Check if course already exists
            existing_course = db.query(Course).filter(Course.slug == data["slug"]).first()
            if existing_course:
                print(f"Skipping existing course: {existing_course.title}")
                created_courses.append(existing_course)
                continue

            course = Course(
                title=data["title"],
                slug=data["slug"],
                summary=data["summary"],
                description=data["description"],
                level=data["level"],
                estimated_duration_minutes=data["estimated_duration_minutes"],
                price=data["price"],
                currency="INR",
                status=COURSE_PUBLISHED,
                is_featured=True,
                is_visible=True,
                created_by_id=admin.id,
                published_at=now,
            )
            db.add(course)
            db.flush()

            # Link course to module
            cm = CourseModule(course_id=course.id, module_id=exam_mod.id, sort_order=1)
            db.add(cm)
            db.flush()

            print(f"Created Course #{course.id}: {course.title} (Linked to Module #{exam_mod.id})")
            created_courses.append(course)

        # Seed/Update B2C Plan for Direct Students
        plan_name = "Visa House IELTS Premium All-Access Plan"
        plan = db.query(Plan).filter(Plan.name == plan_name).first()
        if not plan:
            plan = Plan(
                name=plan_name,
                description="Unlimited access to all 6 IELTS preparation courses, mock tests, and AI evaluation feedback.",
                price=Decimal("1499.00"),
                currency="INR",
                duration_days=30,
                student_limit=1000,
                test_limit=100,
                staff_limit=10,
                grace_days=7,
                is_active=True,
                audience=AUDIENCE_DIRECT,
                is_published=True,
                is_internal=False,
                ai_evaluation_limit=100,
                features=[
                    "Access to all 6 IELTS Modules (Listening, Reading, Writing, Speaking, Mock, Final)",
                    "100 AI Writing & Speaking Evaluations / month",
                    "Instant Band Score Analytics & Model Answers",
                    "30 Days Full Access"
                ]
            )
            db.add(plan)
            db.flush()
            print(f"Created B2C Direct Plan #{plan.id}: {plan.name}")

            # Link courses and modules to plan
            for course in created_courses:
                db.execute(plan_courses.insert().values(plan_id=plan.id, course_id=course.id))
            for mod in created_modules:
                db.execute(plan_modules.insert().values(plan_id=plan.id, module_id=mod.id))
            db.flush()

        db.commit()
        print("Successfully seeded all 6 sample courses and B2C plan!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding courses: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_sample_courses()
