"""Round out the LCA Practice Test 1 set (seeded by seed_lca_practice_modules.py)
with a Writing module, a Speaking module, a Full Mock Test, and a Final Test,
all owned by the same Super Admin Instructor, for local platform/QA testing.

The source workbook extract explicitly excludes writing tasks and speaking
prompts, so this content is hand-authored for QA purposes (not extracted
from the PDF) and is clearly labelled as such.

Requires scripts/seed_lca_practice_modules.py to have already been run, since
the Full Mock / Final Test composites reuse its "LCA Practice Test 1 -
Listening" and "LCA Practice Test 1 - Reading" modules as sources.

Safe to re-run: existing modules with the same titles (owned by this
instructor) are skipped.

Usage:
    python scripts/seed_lca_composite_modules.py
"""
from __future__ import annotations

import sys
from datetime import datetime
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal  # noqa: E402
from app.models.exam_module import ExamModule, ExamModulePart, ExamModuleQuestion  # noqa: E402
from app.models.role import SA_INSTRUCTOR, Role  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services import module_authoring_service  # noqa: E402
from app.services.module_blueprint_service import get_blueprint  # noqa: E402


INSTRUCTOR_EMAIL = "lca.instructor@example.com"
SOURCE_FILENAME = "seed_lca_composite_modules.py"
QA_NOTE = (
    "Authored for QA/testing purposes. The extracted practice workbook does not include "
    "writing tasks or speaking prompts, so this content is hand-written to match the "
    "LanguageCert Academic blueprint rather than sourced from the PDF."
)

WRITING_PROMPTS = {
    "writing_1": (
        "Your university's newsletter has asked students to write a short report about how "
        "well the library's study spaces meet students' needs, based on the results of a "
        "recent survey. Write a report of 150-200 words summarising the main survey findings "
        "and making one recommendation for improvement."
    ),
    "writing_2": (
        "'Universities should require every student to follow a fixed core curriculum instead "
        "of offering optional modules.' To what extent do you agree or disagree? Write a "
        "discursive essay of approximately 250 words giving reasons for your opinion and "
        "including relevant examples."
    ),
}

SPEAKING_PROMPTS = {
    "speaking_1": {
        "identity": "Tell the examiner your name, where you are from, and what you are studying.",
        "topic_question": "Answer follow-up questions about your studies, daily routine, and interests.",
    },
    "speaking_2": {
        "roleplay_response": "The examiner starts: respond while booking a group-study room in the library.",
        "roleplay_initiate": "You start: ask your course tutor about extending an assignment deadline.",
    },
    "speaking_3": {
        "read_aloud": (
            "Read this text aloud: 'Many universities now provide mental health support services "
            "for students, including counselling and peer support groups.'"
        ),
        "follow_up": "Answer two follow-up questions about student support services.",
    },
    "speaking_4": {
        "presentation": (
            "Prepare for one minute, then give a two-minute presentation: describe a skill you "
            "have developed during your studies and explain how it will help you in the future."
        ),
        "follow_up": "Answer follow-up questions about your presentation.",
    },
}


def _get_instructor(db) -> User:
    role = db.query(Role).filter(Role.name == SA_INSTRUCTOR).first()
    if role is None:
        print("SA_INSTRUCTOR role not found - run 'alembic upgrade head' first.")
        sys.exit(1)
    instructor = db.query(User).filter(User.email == INSTRUCTOR_EMAIL).first()
    if instructor is None:
        print(f"{INSTRUCTOR_EMAIL} not found - run scripts/seed_lca_practice_modules.py first.")
        sys.exit(1)
    return instructor


def _writing_question(part: ExamModulePart, actor: User, order: int) -> ExamModuleQuestion:
    points = Decimal(part.max_marks) / Decimal(part.question_limit)
    return ExamModuleQuestion(
        part_id=part.id,
        question_type="essay",
        prompt=WRITING_PROMPTS[part.part_code],
        instructions=part.instructions,
        passage=None,
        options=[],
        correct_answers=[],
        explanation=QA_NOTE,
        points=points,
        difficulty="medium",
        source_type="manual",
        source_filename=SOURCE_FILENAME,
        sort_order=order,
        created_by_id=actor.id,
    )


def _speaking_questions(part: ExamModulePart, actor: User, order: int) -> list[ExamModuleQuestion]:
    prompts = SPEAKING_PROMPTS[part.part_code]
    constraints = part.answer_constraints or {}
    turn_types = constraints.get("required_turn_types") or list(prompts)
    return [
        ExamModuleQuestion(
            part_id=part.id,
            question_type="speaking_prompt",
            prompt=prompts[turn_type],
            instructions=part.instructions,
            passage=None,
            options=[],
            correct_answers=[],
            interaction={"turn_type": turn_type},
            explanation=QA_NOTE,
            points=Decimal("1"),
            difficulty="medium",
            source_type="manual",
            source_filename=SOURCE_FILENAME,
            sort_order=order + index,
            created_by_id=actor.id,
        )
        for index, turn_type in enumerate(turn_types)
    ]


def _create_skill_module(db, actor: User, module_type: str, title: str, question_builder) -> ExamModule | None:
    existing = (
        db.query(ExamModule)
        .filter(ExamModule.title == title, ExamModule.created_by_id == actor.id)
        .first()
    )
    if existing is not None:
        print(f"Skipping existing module: {title}")
        return existing

    blueprint = get_blueprint(module_type)
    module = ExamModule(
        module_type=module_type,
        title=title,
        description=(
            f"LanguageCert Academic sample {module_type} module, hand-authored for platform "
            "QA/testing (examiner-marked flow, recording/upload UI, rubric scoring)."
        ),
        instructions="Use this module to QA the authoring, delivery, and examiner-marking screens.",
        status="published",
        duration_minutes=blueprint["duration_minutes"],
        source_module_ids=[],
        created_by_id=actor.id,
        published_at=datetime.utcnow(),
    )
    db.add(module)
    db.flush()

    parts: list[ExamModulePart] = []
    for part_data in blueprint["parts"]:
        part = ExamModulePart(
            module_id=module.id,
            section_type=part_data["section_type"],
            part_code=part_data["part_code"],
            title=part_data["title"],
            skill_focus=part_data["skill_focus"],
            instructions=part_data["instructions"],
            question_limit=part_data["question_limit"],
            minimum_questions=part_data["minimum_questions"],
            max_marks=part_data["max_marks"],
            duration_minutes=part_data["duration_minutes"],
            auto_marked=part_data["auto_marked"],
            answer_constraints=part_data["answer_constraints"],
            rubric=part_data["rubric"],
            sort_order=part_data["sort_order"],
        )
        db.add(part)
        parts.append(part)
    db.flush()

    for part in parts:
        questions = question_builder(part, actor, 0)
        if isinstance(questions, list):
            db.add_all(questions)
        else:
            db.add(questions)

    db.flush()
    errors = module_authoring_service.validation_errors(module)
    if errors:
        raise RuntimeError(f"Seeded module '{title}' is invalid: {'; '.join(errors)}")
    print(f"Created module: {title}")
    return module


def _create_composite(db, actor: User, module_type: str, title: str, source_ids: list[int]) -> bool:
    existing = (
        db.query(ExamModule)
        .filter(ExamModule.title == title, ExamModule.created_by_id == actor.id)
        .first()
    )
    if existing is not None:
        print(f"Skipping existing module: {title}")
        return False

    label = "Full Mock Test" if module_type == "full_mock" else "Final Test"
    created = module_authoring_service.create_module(
        db,
        actor,
        {
            "module_type": module_type,
            "title": title,
            "description": f"LanguageCert Academic sample {label} for platform QA/testing.",
            "instructions": (
                "Complete every section before submitting. The countdown continues throughout the sitting."
            ),
            "source_module_ids": source_ids,
        },
        None,
    )
    module_authoring_service.set_status(db, actor, created["id"], "published", None)
    print(f"Created module: {title}")
    return True


def main() -> None:
    db = SessionLocal()
    try:
        instructor = _get_instructor(db)

        listening = (
            db.query(ExamModule)
            .filter(
                ExamModule.created_by_id == instructor.id,
                ExamModule.title == "LCA Practice Test 1 - Listening",
                ExamModule.deleted_at.is_(None),
            )
            .first()
        )
        reading = (
            db.query(ExamModule)
            .filter(
                ExamModule.created_by_id == instructor.id,
                ExamModule.title == "LCA Practice Test 1 - Reading",
                ExamModule.deleted_at.is_(None),
            )
            .first()
        )
        if listening is None or reading is None:
            print("LCA Practice Test 1 Listening/Reading modules not found - run scripts/seed_lca_practice_modules.py first.")
            sys.exit(1)

        writing = _create_skill_module(
            db, instructor, "writing", "LCA Practice Test 1 - Writing", _writing_question
        )
        speaking = _create_skill_module(
            db, instructor, "speaking", "LCA Practice Test 1 - Speaking", _speaking_questions
        )
        db.commit()

        # Refresh so newly-created writing/speaking modules are visible to the composite query.
        writing = db.query(ExamModule).filter(ExamModule.id == writing.id).first()
        speaking = db.query(ExamModule).filter(ExamModule.id == speaking.id).first()

        source_ids = [listening.id, reading.id, writing.id, speaking.id]
        created = 0
        if _create_composite(db, instructor, "full_mock", "LCA Full Mock Test 1", source_ids):
            created += 1
        if _create_composite(db, instructor, "final_test", "LCA Final Test 1", source_ids):
            created += 1

        print(f"LCA composite content ready for {instructor.email}.")
        print(f"Created {created} new composite module(s).")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
