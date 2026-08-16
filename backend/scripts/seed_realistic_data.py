"""Build a realistic dataset the way it actually happens in the business.

Every step below goes through the same service functions the API calls, in the
order the real workflow runs - so whatever this produces is reachable by a real
user, and any rule the code enforces is enforced here too. Nothing is inserted
straight into a table unless the app itself has no other route to it.

    python scripts/seed_realistic_data.py            # add to whatever is there
    python scripts/seed_realistic_data.py --reset    # wipe every row first

`--reset` empties the tables; it does not drop them, so the schema and the
Alembic version stay exactly as they were.
"""

from __future__ import annotations

import argparse
import random
import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402
from app.models import Base  # noqa: E402
from app.models.attempt import (  # noqa: E402
    ATTEMPT_GRADED,
    ATTEMPT_GRADING,
    CourseModule,
    TestAttempt,
)
from app.models.course import COURSE_PUBLISHED, Course  # noqa: E402
from app.models.exam_module import ExamModule, ExamModuleQuestion, InstituteModule  # noqa: E402
from app.models.institute import Institute  # noqa: E402
from app.models.role import (  # noqa: E402
    ALL_ROLES,
    INST_INSTRUCTOR,
    SA_INSTRUCTOR,
    STUDENT,
    SUPER_ADMIN,
    Role,
)
from app.models.user import User  # noqa: E402
from app.services import (  # noqa: E402
    access_window_service,
    achievement_service,
    attempt_service,
    grading_service,
    institute_admin_service,
    module_authoring_service,
    onboarding_service,
    plan_service,
    subscription_service,
)

PASSWORD = "Test@12345"
IP = "127.0.0.1"
STEP = 0


def step(title: str) -> None:
    global STEP
    STEP += 1
    print(f"\n{'=' * 72}\nSTEP {STEP}  {title}\n{'=' * 72}", flush=True)


def note(message: str) -> None:
    print(f"   {message}", flush=True)


# ---------------------------------------------------------------------------
# reset
# ---------------------------------------------------------------------------

def wipe(db) -> None:
    """Delete every row, leaving the schema and alembic_version untouched."""
    dialect = engine.dialect.name
    from sqlalchemy import inspect

    present = set(inspect(engine).get_table_names())
    tables = [
        t for t in reversed(Base.metadata.sorted_tables)
        if t.name != "alembic_version" and t.name in present
    ]
    if dialect == "sqlite":
        db.execute(text("PRAGMA foreign_keys=OFF"))
    elif dialect == "mysql":
        db.execute(text("SET FOREIGN_KEY_CHECKS=0"))
    for table in tables:
        db.execute(table.delete())
    if dialect == "sqlite":
        # Only present once an AUTOINCREMENT row has been written.
        if "sqlite_sequence" in present:
            db.execute(text("DELETE FROM sqlite_sequence"))
        db.execute(text("PRAGMA foreign_keys=ON"))
    elif dialect == "mysql":
        db.execute(text("SET FOREIGN_KEY_CHECKS=1"))
    db.commit()
    note(f"cleared {len(tables)} tables")


# ---------------------------------------------------------------------------
# authoring helpers - build a publishable module of each type
# ---------------------------------------------------------------------------

# turn type -> (preparation seconds, response seconds). Timing lives on the
# prompt now, so the seed sets it the same way an author would.
SPEAKING_TURNS = {
    "speaking_1": [("identity", 0, 45), ("topic_question", 0, 45)],
    "speaking_2": [("roleplay_response", 0, 60), ("roleplay_initiate", 0, 60)],
    "speaking_3": [("read_aloud", 20, 90)],
    "speaking_4": [("presentation", 60, 120), ("follow_up", 0, 60)],
}

READ_ALOUD_TEXT = (
    "Universities increasingly rely on data to shape their teaching. Careful "
    "analysis can reveal which students need support long before an examination."
)


def _question_payload(part, index: int, count: int) -> dict:
    constraints = part.answer_constraints or {}
    question_type = constraints["allowed_question_types"][0]
    choice = question_type.startswith("mcq_") or question_type.startswith("matching_")
    option_count = max(constraints.get("option_count", 4), count if constraints.get("unique_answers") else 4)

    prompt = f"{part.title} question {index + 1}"
    if part.part_code == "reading_1a":
        prompt = f"The results were **conclusive** in study {index + 1}."
    if part.part_code == "reading_4" and index == 0:
        prompt = "What does the writer imply in the first paragraph?"

    passage = None
    if constraints.get("layout") == "shared_cloze":
        passage = " ".join(f"Sentence {n + 1} {{{{blank:{n + 1}}}}}" for n in range(count))
    elif constraints.get("passage_required"):
        passage = (
            "Academic reading source. Researchers examined how study habits change "
            "across a semester, and what that implies for teaching practice."
        )

    payload = {
        "question_type": question_type,
        "prompt": prompt,
        "instructions": None,
        "passage": passage,
        "options": [{"key": chr(65 + n), "text": f"Option {n + 1}"} for n in range(option_count)] if choice else [],
        "correct_answers": [chr(65 + index)] if constraints.get("unique_answers") else ["A"],
        "explanation": None,
        "points": Decimal(part.max_marks) / count if part.max_marks else Decimal("1"),
        "difficulty": random.choice(["easy", "medium", "hard"]),
    }

    if constraints.get("group_label_required"):
        per_group = constraints.get("questions_per_group") or 1
        payload["interaction"] = {"group_label": f"Conversation {index // per_group + 1}"}
    if constraints.get("inline_marker_required"):
        payload["prompt"] = f"{payload['prompt']} {{{{blank}}}}"
    return payload


def author_module(db, instructor, module_type: str, title: str) -> object:
    created = module_authoring_service.create_module(
        db, instructor,
        {"module_type": module_type, "title": title, "description": f"{title} - authored for QA", "instructions": None},
        IP,
    )
    module = module_authoring_service.get_module_or_404(db, created["id"])

    for part in module.parts:
        if part.section_type == "speaking":
            for index, (turn, prep, response) in enumerate(SPEAKING_TURNS[part.part_code]):
                payload = {
                    "question_type": "speaking_prompt",
                    "prompt": f"{part.title}: {turn.replace('_', ' ')} prompt",
                    "instructions": None,
                    "passage": READ_ALOUD_TEXT if turn == "read_aloud" else None,
                    "options": [], "correct_answers": [], "explanation": None,
                    "points": Decimal("1"), "difficulty": "medium",
                    "interaction": {
                        "turn_type": turn,
                        "preparation_seconds": prep,
                        "response_seconds": response,
                    },
                }
                module_authoring_service.add_question(db, instructor, module.id, part.id, payload, IP)
            continue

        count = part.question_limit or part.minimum_questions
        for index in range(count):
            module_authoring_service.add_question(
                db, instructor, module.id, part.id, _question_payload(part, index, count), IP
            )

        # Listening parts cannot publish without audio; a narrated transcript is
        # the route that needs no MP3 upload.
        if part.section_type == "listening":
            module_authoring_service.add_tts_text_asset(
                db, instructor, module.id, part.id,
                title=f"{part.title} narration",
                transcript=(
                    "Speaker one describes a change to the timetable for the coming term. "
                    "Speaker two asks two follow-up questions about the new arrangements."
                ),
                voice="en-GB-SoniaNeural", rate="+0%", ip=IP,
            )

    db.expire_all()
    module = module_authoring_service.get_module_or_404(db, module.id)
    errors = module_authoring_service.validation_errors(module)
    if errors:
        note(f"!! {title} cannot publish: {errors}")
        return module

    module_authoring_service.set_status(db, instructor, module.id, "published", IP)
    db.expire_all()
    module = module_authoring_service.get_module_or_404(db, module.id)
    note(f"published '{title}' ({module_type}) - {sum(len(p.questions) for p in module.parts)} questions, "
         f"{module.duration_minutes} min")
    return module


def bundle_into_course(db, instructor, modules, title: str, slug: str) -> Course:
    course = Course(
        title=title, slug=slug, price=Decimal("0"), currency="INR",
        status=COURSE_PUBLISHED, created_by_id=instructor.id,
    )
    db.add(course)
    db.flush()
    for order, module in enumerate(modules):
        db.add(CourseModule(course_id=course.id, module_id=module.id, sort_order=order))
    db.commit()
    return course


# ---------------------------------------------------------------------------
# sitting a test
# ---------------------------------------------------------------------------

def sit_test(db, student, module, *, correct_ratio: float, submit: bool = True) -> object:
    """Answer a module the way a student does: one answer at a time, then submit."""
    out = attempt_service.start_attempt(db, student, module)
    attempt = attempt_service.get_attempt_or_404(db, student, out["id"])

    for part in attempt.module.parts:
        for question in attempt_service._ordered_questions(attempt, part):
            if part.section_type == "speaking":
                attempt_service.save_audio_answer(
                    db, attempt, question.id, _fake_recording(), ".webm"
                )
            elif question.question_type == "essay":
                attempt_service.save_answer(db, attempt, question.id, {"text": _essay_text()})
            else:
                snapshot = attempt_service._snapshot_question(attempt, part.id, question.id) or {}
                keys = [str(a) for a in (snapshot.get("correct_answers") or question.correct_answers or ["A"])]
                right = random.random() < correct_ratio
                answer = keys[0] if right else ("Z" if keys[0] != "Z" else "Y")
                attempt_service.save_answer(db, attempt, question.id, {"selected": answer})

    if submit:
        attempt_service.submit_attempt(db, attempt)
        db.expire_all()
        attempt = attempt_service.get_attempt_or_404(db, student, out["id"])
    return attempt


def _fake_recording() -> bytes:
    """A WebM header plus filler - passes the container and size checks."""
    return b"\x1a\x45\xdf\xa3" + b"\x00" * 6000


def _essay_text() -> str:
    return (
        "The chart shows a steady rise in enrolment between 2019 and 2024, with the "
        "sharpest increase after 2021. Postgraduate numbers grew fastest, while "
        "undergraduate entry stayed broadly level. Three factors explain the pattern. "
        "First, online delivery removed the need to relocate. Second, employers began "
        "funding part-time study. Third, the fee freeze made a second degree "
        "affordable for a wider group. Taken together, these suggest the growth is "
        "structural rather than temporary, and institutions should plan capacity "
        "accordingly rather than treating the last three years as an anomaly."
    ) * 3


def mark_subjective(db, examiner, attempt) -> None:
    """Fill in the examiner rubric for every human-marked part, then publish."""
    db.expire_all()
    attempt = attempt_service.get_attempt_or_404(db, db.get(User, attempt.user_id), attempt.id)
    grading_service.claim(db, examiner, attempt)
    for part in attempt.module.parts:
        if part.auto_marked or not part.rubric:
            continue
        criteria = [
            {
                "criterion": item["criterion"],
                "max_marks": item["max_marks"],
                "marks_awarded": round(item["max_marks"] * random.uniform(0.55, 0.9), 1),
                "comment": "Clear overall, with some lapses in range.",
            }
            for item in part.rubric
        ]
        attempt_service.save_part_draft(db, examiner, attempt.id, part.id, criteria, "Solid performance.")
    attempt_service.submit_grading(db, examiner, attempt.id)


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="delete every row first")
    args = parser.parse_args()
    random.seed(20260815)

    db = SessionLocal()
    try:
        if args.reset:
            step("Clearing the database")
            wipe(db)

        # -- 1. roles ---------------------------------------------------------
        step("Seeding roles")
        for name in ALL_ROLES:
            if db.query(Role).filter(Role.name == name).first() is None:
                db.add(Role(name=name))
        db.commit()
        note(f"{len(ALL_ROLES)} roles present")

        # -- 2. the owner ------------------------------------------------------
        step("Creating the platform owner")
        note("In real life this is you, created once when the platform is installed.")
        owner = User(
            email="owner@visahouse.example.com", password_hash=hash_password(PASSWORD),
            role_id=db.query(Role).filter(Role.name == SUPER_ADMIN).one().id,
            first_name="Tarundeep", last_name="Singh", is_active=True, is_owner=True,
            can_view_monetary_analytics=True, force_password_reset=False,
        )
        db.add(owner)
        db.commit()
        db.refresh(owner)
        note(f"owner: {owner.email}")

        # -- 3. an SA instructor ----------------------------------------------
        step("Owner hires a central (SA) instructor")
        note("Instructors author the exam content. The owner creates the account;")
        note("the system issues a temporary password the instructor must change.")
        instructor = User(
            email="examiner@visahouse.example.com", password_hash=hash_password(PASSWORD),
            role_id=db.query(Role).filter(Role.name == SA_INSTRUCTOR).one().id,
            first_name="Priya", last_name="Menon", is_active=True, force_password_reset=False,
        )
        db.add(instructor)
        db.commit()
        db.refresh(instructor)
        note(f"instructor: {instructor.email}")

        # -- 4. authoring ------------------------------------------------------
        step("Instructor authors and publishes the exam modules")
        modules = {
            "reading": author_module(db, instructor, "reading", "LanguageCert Academic - Reading 1"),
            "listening": author_module(db, instructor, "listening", "LanguageCert Academic - Listening 1"),
            "writing": author_module(db, instructor, "writing", "LanguageCert Academic - Writing 1"),
            "speaking": author_module(db, instructor, "speaking", "LanguageCert Academic - Speaking 1"),
        }
        published = [m for m in modules.values() if m.status == "published"]
        course = bundle_into_course(db, instructor, published, "LanguageCert Academic - Full Preparation", "lca-full-prep")
        note(f"bundled {len(published)} modules into course '{course.title}'")

        # -- 5. plans ----------------------------------------------------------
        step("Owner publishes the price list")
        note("Two catalogues: one institutes buy from, one direct students buy from.")
        module_ids = [m.id for m in published]
        institute_plan = plan_service.create_plan(db, owner, {
            "name": "Institute Standard (60 seats)", "description": "One academic year for a mid-size centre.",
            "price": 96000, "currency": "INR", "duration_days": 365, "student_limit": 60,
            "staff_limit": 6, "grace_days": 14, "audience": "institutes",
            "is_published": True, "module_ids": module_ids,
            "features": ["All four skills", "Examiner-marked Writing and Speaking", "Institute leaderboard"],
        }, IP)
        direct_plan = plan_service.create_plan(db, owner, {
            "name": "Student 3-Month", "description": "Full access for an individual candidate.",
            "price": 4999, "currency": "INR", "duration_days": 90, "student_limit": 1,
            "staff_limit": 0, "grace_days": 7, "audience": "direct_students",
            "is_published": True, "module_ids": module_ids,
            "features": ["All four skills", "CEFR profile", "Retake requests"],
        }, IP)
        note(f"institute plan #{institute_plan['id']} - Rs {institute_plan['price']}")
        note(f"direct plan    #{direct_plan['id']} - Rs {direct_plan['price']}")

        # -- 6. institute sales ------------------------------------------------
        step("Two institutes are sold, onboarded and published")
        note("The real flow: agreement signed offline -> payment recorded -> draft")
        note("institute created -> branding applied -> published, which activates")
        note("the institute admin's login.")
        institutes = []
        for name, slug_admin, seats, staff, colors, paid in [
            ("Bright Future Academy", "admin@brightfuture.example.com", 60, 6, ("#B3122F", "#1F2937"), True),
            ("Global Pathways Institute", "admin@globalpathways.example.com", 25, 3, ("#0F766E", "#111827"), False),
        ]:
            draft = onboarding_service.create_draft(db, owner, {
                "name": name, "contact_email": slug_admin, "admin_email": slug_admin,
                "admin_first_name": "Institute", "admin_last_name": "Admin",
                "agreed_amount": 96000 if seats == 60 else 48000,
                "amount_received": (96000 if seats == 60 else 48000) if paid else 20000,
                "currency": "INR", "student_limit": seats, "staff_limit": staff,
                "access_duration_days": 365, "module_ids": module_ids,
                "primary_color": colors[0], "secondary_color": colors[1],
                "agreement_reference": f"AGR-{seats:03d}", "agreement_notes": "Signed at the Amritsar office.",
            }, IP)
            onboarding_service.publish(db, owner, draft["id"], IP)
            institute = db.get(Institute, draft["id"])
            institutes.append(institute)
            note(f"{name}: {seats} seats, {'paid in full' if paid else 'part-paid'}, admin {slug_admin}")

        # every institute admin account is created inactive and activated on publish
        for institute in institutes:
            admin = (
                db.query(User).join(Role, User.role_id == Role.id)
                .filter(User.institute_id == institute.id, Role.name == "INSTITUTE_ADMIN").first()
            )
            admin.password_hash = hash_password(PASSWORD)
            admin.force_password_reset = False
            db.add(admin)
        db.commit()

        # -- 7. institute staff and students -----------------------------------
        step("Institute admins issue accounts for their staff and students")
        first_names = ["Aarav", "Diya", "Kabir", "Meera", "Rohan", "Sana", "Vikram", "Isha",
                       "Arjun", "Nisha", "Dev", "Tara"]
        students_by_institute = {}
        for index, institute in enumerate(institutes):
            admin = (
                db.query(User).join(Role, User.role_id == Role.id)
                .filter(User.institute_id == institute.id, Role.name == "INSTITUTE_ADMIN").first()
            )
            created_teacher = institute_admin_service.create_member(
                db, admin, email=f"teacher@{institute.slug}.example.com", first_name="Anjali", last_name="Rao",
                role_name=INST_INSTRUCTOR, phone_number=None, address=None, ip=IP,
            )
            teacher = db.get(User, created_teacher["id"])
            teacher.password_hash = hash_password(PASSWORD)
            teacher.force_password_reset = False
            db.add(teacher)
            db.commit()
            roster = []
            share = first_names[index * 7: index * 7 + (7 if index == 0 else 5)]
            for n, first in enumerate(share):
                # Real institutes give a cohort a term, not open-ended access.
                # One student per institute starts a week from now, so the
                # roster shows a "not started" row as well as live ones.
                starts_on = date.today() + timedelta(days=7) if n == 1 else date.today()
                ends_on = starts_on + timedelta(days=150)
                created = institute_admin_service.create_member(
                    db, admin, email=f"{first.lower()}@{institute.slug}.example.com",
                    first_name=first, last_name="Sharma", role_name=STUDENT,
                    phone_number=f"98{index}{n:07d}", address="Amritsar, Punjab", ip=IP,
                    access_starts_on=starts_on, access_ends_on=ends_on,
                )
                student = db.get(User, created["id"])
                student.password_hash = hash_password(PASSWORD)
                student.force_password_reset = False
                db.add(student)
                roster.append(student)
            db.commit()

            # The first student's course finished last month. Backdate the
            # window and let the nightly sweep do what it does in production,
            # rather than writing the "expired" state in by hand - that way the
            # seeded data is reachable by the real code path.
            finished = roster[0]
            finished.access_starts_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=210)
            finished.access_ends_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=3)
            db.add(finished)
            db.commit()
            access_window_service.expire_due_students(db)

            students_by_institute[institute.id] = roster
            note(
                f"{institute.name}: 1 instructor + {len(roster)} students "
                f"({finished.first_name}'s access has ended - their seat is still held)"
            )

        # -- 8. a direct student buys online -----------------------------------
        step("A direct student signs up and buys a plan")
        direct = User(
            email="ananya@gmail.example.com", password_hash=hash_password(PASSWORD),
            role_id=db.query(Role).filter(Role.name == STUDENT).one().id,
            first_name="Ananya", last_name="Kapoor", is_active=True, force_password_reset=False,
        )
        db.add(direct)
        db.commit()
        db.refresh(direct)
        subscription_service.subscribe_user(db, direct.id, direct_plan["id"], IP)
        note(f"{direct.email} on '{direct_plan['name']}' - subscription active")

        # -- 9. students sit tests ---------------------------------------------
        step("Students sit their tests")
        note("A spread of states, so every screen has something in it:")
        note("finished and marked, waiting for an examiner, and still in progress.")
        examiners = {}
        for institute in institutes:
            examiners[institute.id] = (
                db.query(User).join(Role, User.role_id == Role.id)
                .filter(User.institute_id == institute.id, Role.name == INST_INSTRUCTOR).first()
            )

        graded = pending = in_progress = 0
        for institute in institutes:
            roster = students_by_institute[institute.id]
            for position, student in enumerate(roster):
                # auto-marked module - completes on submit
                if position % 3 != 2:
                    sit_test(db, student, modules["reading"], correct_ratio=random.uniform(0.45, 0.95))
                    graded += 1
                if position % 3 == 0:
                    sit_test(db, student, modules["listening"], correct_ratio=random.uniform(0.4, 0.9))
                    graded += 1
                # examiner-marked module
                if position % 2 == 0:
                    attempt = sit_test(db, student, modules["writing"], correct_ratio=0.0)
                    if position % 4 == 0:
                        mark_subjective(db, examiners[institute.id], attempt)
                        graded += 1
                    else:
                        pending += 1
                # someone walks away mid-test
                if position == len(roster) - 1:
                    sit_test(db, student, modules["speaking"], correct_ratio=0.0, submit=False)
                    in_progress += 1

        writing_attempt = sit_test(db, direct, modules["writing"], correct_ratio=0.0)
        mark_subjective(db, instructor, writing_attempt)
        sit_test(db, direct, modules["reading"], correct_ratio=0.88)
        graded += 2
        note(f"{graded} marked, {pending} waiting for an examiner, {in_progress} still open")

        # -- 10. standings ------------------------------------------------------
        step("Badges and leaderboards recalculate")
        for institute in institutes:
            achievement_service.rebuild_institute_leaderboard(db, institute.id)
        for roster in students_by_institute.values():
            for student in roster:
                achievement_service.refresh_student_achievements(db, student.id, None)
        achievement_service.refresh_student_achievements(db, direct.id, None)
        note("institute standings rebuilt")

        # -- summary ------------------------------------------------------------
        step("Done")
        counts = {
            "users": db.query(User).count(),
            "institutes": db.query(Institute).count(),
            "modules": db.query(ExamModule).count(),
            "questions": db.query(ExamModuleQuestion).count(),
            "attempts": db.query(TestAttempt).count(),
            "graded attempts": db.query(TestAttempt).filter(
                TestAttempt.status == ATTEMPT_GRADED).count(),
            "awaiting examiner": db.query(TestAttempt).filter(
                TestAttempt.status == ATTEMPT_GRADING).count(),
            "institute course grants": db.query(InstituteModule).count(),
        }
        for key, value in counts.items():
            print(f"   {key:<24} {value}")

        print(f"\n   Every account below uses the password: {PASSWORD}\n")
        print("   Owner / Super Admin   owner@visahouse.example.com")
        print("   SA Instructor         examiner@visahouse.example.com")
        for institute in institutes:
            admin = (
                db.query(User).join(Role, User.role_id == Role.id)
                .filter(User.institute_id == institute.id, Role.name == "INSTITUTE_ADMIN").first()
            )
            print(f"   Institute Admin       {admin.email}   ({institute.name})")
            print(f"   Institute Instructor  teacher@{institute.slug}.example.com")
        print("   Institute Student     aarav@bright-future-academy.example.com")
        print("   Direct Student        ananya@gmail.example.com")
    finally:
        db.close()


if __name__ == "__main__":
    main()
