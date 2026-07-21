"""Seed sample SA instructor assessment modules for local testing.

Safe to re-run: existing modules with the same sample titles are skipped.

Usage:
    python scripts/seed_dummy_modules.py
"""
from __future__ import annotations

import sys
from datetime import datetime
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.security import hash_password  # noqa: E402
from app.config import settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models.exam_module import ExamModule, ExamModuleAsset, ExamModulePart, ExamModuleQuestion  # noqa: E402
from app.models.instructor_profile import InstructorProfile  # noqa: E402
from app.models.role import SA_INSTRUCTOR, Role  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services import module_authoring_service  # noqa: E402
from app.services.module_blueprint_service import get_blueprint  # noqa: E402


SAMPLE_EMAIL = "sample.instructor@example.com"
LEGACY_SAMPLE_EMAIL = "sample.instructor@visahouse.test"
SAMPLE_PASSWORD = "Test@12345"
SAMPLE_TITLES = {
    "listening": "Sample Listening Course - Academic Set 1",
    "reading": "Sample Reading Course - Academic Set 1",
    "writing": "Sample Writing Course - Academic Set 1",
    "speaking": "Sample Speaking Course - Academic Set 1",
    "full_mock": "Sample Full Mock Test - Academic Set 1",
    "final_test": "Sample Final Test - Academic Set 1",
}
SKILL_MODULE_TYPES = ("listening", "reading", "writing", "speaking")
COMPOSITE_MODULE_TYPES = ("full_mock", "final_test")


def _sample_mp3_bytes() -> bytes:
    return b"ID3\x03\x00\x00\x00\x00\x00\x0fTIT2\x00\x00\x00\x05\x00\x00\x03Test\x00"


def _get_or_create_instructor(db) -> User:
    role = db.query(Role).filter(Role.name == SA_INSTRUCTOR).first()
    if role is None:
        print("SA_INSTRUCTOR role not found - run 'alembic upgrade head' first.")
        sys.exit(1)

    existing = db.query(User).filter(User.email == SAMPLE_EMAIL).first()
    if existing is None:
        existing = db.query(User).filter(User.email == LEGACY_SAMPLE_EMAIL).first()
        if existing is not None:
            # EmailStr rejects the reserved .test domain at the login schema,
            # so migrate older local seed data to the schema-valid address.
            existing.email = SAMPLE_EMAIL
            db.flush()
    if existing is not None:
        return existing

    user = User(
        email=SAMPLE_EMAIL,
        password_hash=hash_password(SAMPLE_PASSWORD),
        role_id=role.id,
        institute_id=None,
        first_name="Sample",
        last_name="Instructor",
        is_active=True,
        force_password_reset=False,
    )
    db.add(user)
    db.flush()
    db.add(
        InstructorProfile(
            user_id=user.id,
            title="LanguageCert Academic Instructor",
            bio="Seeded instructor used for local module and mock-test QA.",
        )
    )
    db.flush()
    return user


def _options(question_number: int) -> list[dict[str, str]]:
    return [
        {"key": "A", "text": f"Option A for item {question_number}"},
        {"key": "B", "text": f"Option B for item {question_number}"},
        {"key": "C", "text": f"Option C for item {question_number}"},
    ]


def _question_for_part(part: ExamModulePart, actor: User, order: int) -> ExamModuleQuestion:
    allowed = (part.answer_constraints or {}).get("allowed_question_types", ["short_answer"])
    question_type = allowed[0]
    number = order + 1
    correct_answers = [] if question_type in {"essay", "speaking_prompt"} else ["A"]
    options = _options(number) if question_type in {"mcq_single", "mcq_multiple"} else []
    if question_type == "true_false_not_given":
        options = [{"key": key, "text": text} for key, text in (("A", "True"), ("B", "False"), ("C", "Not Given"))]
    if question_type == "yes_no_not_given":
        options = [{"key": key, "text": text} for key, text in (("A", "Yes"), ("B", "No"), ("C", "Not Given"))]
    if question_type in {"fill_blank", "short_answer"}:
        correct_answers = [f"answer {number}"]

    if question_type == "essay":
        prompt = (
            "Write an academic response evaluating how universities can support international students "
            "during their first semester."
        )
    elif question_type == "speaking_prompt":
        prompt = f"{part.title}: respond to the examiner's prompt about study habits and academic goals."
    else:
        prompt = f"{part.title} sample question {number}: choose or enter the best answer."

    points = Decimal("1")
    if part.max_marks is not None and part.question_limit:
        points = Decimal(part.max_marks) / Decimal(part.question_limit)
    elif part.max_marks is not None:
        points = Decimal(part.max_marks)

    return ExamModuleQuestion(
        part_id=part.id,
        question_type=question_type,
        prompt=prompt,
        instructions=part.instructions,
        passage=(
            "Sample academic context: students discuss lectures, research deadlines, campus services, "
            "and methods for improving language performance."
        ),
        options=options,
        correct_answers=correct_answers,
        explanation="Seeded answer for QA and layout testing.",
        points=points,
        difficulty="medium",
        source_type="seed",
        source_filename="seed_dummy_modules.py",
        sort_order=order,
        created_by_id=actor.id,
    )


def _create_module(db, actor: User, module_type: str) -> bool:
    title = SAMPLE_TITLES[module_type]
    if db.query(ExamModule).filter(ExamModule.title == title, ExamModule.created_by_id == actor.id).first():
        print(f"Skipping existing module: {title}")
        return False

    if module_type in COMPOSITE_MODULE_TYPES:
        sources = (
            db.query(ExamModule)
            .filter(
                ExamModule.created_by_id == actor.id,
                ExamModule.title.in_([SAMPLE_TITLES[item] for item in SKILL_MODULE_TYPES]),
                ExamModule.deleted_at.is_(None),
            )
            .all()
        )
        by_type = {source.module_type: source for source in sources}
        missing = [item for item in SKILL_MODULE_TYPES if item not in by_type]
        if missing:
            raise RuntimeError(
                f"Cannot create {title}; missing sample sources: {', '.join(missing)}"
            )
        created = module_authoring_service.create_module(
            db,
            actor,
            {
                "module_type": module_type,
                "title": title,
                "description": "Complete seeded four-skill assessment for local student test-taking QA.",
                "instructions": "Complete every section before submitting. The countdown continues throughout the sitting.",
                "source_module_ids": [by_type[item].id for item in SKILL_MODULE_TYPES],
            },
            None,
        )
        module_authoring_service.set_status(db, actor, created["id"], "published", None)
        print(f"Created module: {title}")
        return True

    blueprint = get_blueprint(module_type)
    module = ExamModule(
        module_type=module_type,
        title=title,
        description="Seeded dummy course content for local testing.",
        instructions="Use this sample module to test authoring, final mock selection, and delivery screens.",
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
        count = part.question_limit or part.minimum_questions
        for order in range(count):
            db.add(_question_for_part(part, actor, order))

        if (part.answer_constraints or {}).get("audio_required"):
            relative = Path("exam-modules") / "seed" / f"{module_type}-{part.part_code}.mp3"
            destination = settings.storage_path / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            content = _sample_mp3_bytes()
            destination.write_bytes(content)
            db.add(
                ExamModuleAsset(
                    module_id=module.id,
                    part_id=part.id,
                    asset_type="mp3",
                    title=f"{part.title} sample audio",
                    original_filename=f"{part.part_code}.mp3",
                    file_path=relative.as_posix(),
                    mime_type="audio/mpeg",
                    file_size=len(content),
                    transcript=f"Sample transcript for {part.title}.",
                    tts_voice=None,
                    uploaded_by_id=actor.id,
                )
            )

    print(f"Created module: {title}")
    return True


def main() -> None:
    db = SessionLocal()
    try:
        instructor = _get_or_create_instructor(db)
        created = 0
        for module_type in (*SKILL_MODULE_TYPES, *COMPOSITE_MODULE_TYPES):
            if _create_module(db, instructor, module_type):
                created += 1
        db.commit()
        print(f"Dummy content ready for {instructor.email}.")
        print(f"Login password: {SAMPLE_PASSWORD}")
        print(f"Created {created} new module(s).")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
