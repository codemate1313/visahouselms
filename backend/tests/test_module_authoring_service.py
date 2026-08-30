import tempfile
import unittest
from decimal import Decimal
from pathlib import Path
from typing import Optional
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.core.security import hash_password
from app.models import Base, ExamModule, ExamModuleAsset, ExamModuleQuestion
from app.models.role import SA_INSTRUCTOR, Role
from app.models.user import User
from app.schemas.assessment import QuestionCreate
from app.services import module_authoring_service, module_blueprint_service


def _question(
    question_type: str,
    prompt: str,
    points: Decimal = Decimal("1"),
    *,
    option_count: int = 2,
    passage: Optional[str] = None,
    correct_answer: str = "A",
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
        "correct_answers": [correct_answer] if choice or question_type in {"fill_blank", "short_answer"} else [],
        "explanation": None,
        "points": points,
        "difficulty": "medium",
    }


class ModuleAuthoringServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()
        role = Role(name=SA_INSTRUCTOR)
        self.db.add(role)
        self.db.flush()
        self.instructor = User(
            email="module-author@example.com",
            password_hash=hash_password("TeacherPassword!1"),
            role_id=role.id,
            first_name="Module",
            last_name="Author",
            is_active=True,
        )
        self.db.add(self.instructor)
        self.db.commit()
        self.db.refresh(self.instructor)
        self.storage = tempfile.TemporaryDirectory()
        self.original_storage_dir = settings.storage_dir
        settings.storage_dir = self.storage.name

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()
        settings.storage_dir = self.original_storage_dir
        self.storage.cleanup()

    def _create(self, module_type: str) -> dict:
        return module_authoring_service.create_module(
            self.db,
            self.instructor,
            {
                "module_type": module_type,
                "title": f"Academic {module_type}",
                "description": None,
                "instructions": None,
            },
            "127.0.0.1",
        )

    def _complete(self, module_type: str) -> dict:
        created = self._create(module_type)
        module = module_authoring_service.get_module_or_404(self.db, created["id"])
        for part_index, part in enumerate(module.parts):
            count = part.question_limit or part.minimum_questions
            constraints = part.answer_constraints or {}
            question_type = constraints["allowed_question_types"][0]
            points = Decimal(part.max_marks) / count if part.max_marks is not None else Decimal("1")
            for index in range(count):
                prompt = f"{part.part_code} source question {index + 1}"
                if constraints.get("inline_marker_required"):
                    prompt += " {{blank}}"
                if part.part_code == "reading_4" and index == 0:
                    prompt = "What does the writer imply in the first paragraph?"
                draft = _question(
                    question_type,
                    prompt,
                    points,
                    option_count=constraints.get("option_count", 2),
                    passage=(
                        "Shared academic source with gaps: " + " ".join("{{blank:" + str(g) + "}}" for g in range(1, count + 1))
                        if constraints.get("layout") in ("shared_cloze", "notepad_gaps")
                        else (f"Shared academic source for {part.part_code}." if constraints.get("passage_required") else None)
                    ),
                    correct_answer=chr(65 + index) if constraints.get("unique_answers") else "A",
                )
                if constraints.get("group_label_required"):
                    draft["interaction"] = {
                        "group_label": f"Conversation {index // constraints['questions_per_group'] + 1}"
                    }
                if constraints.get("required_turn_types"):
                    required_turns = constraints["required_turn_types"]
                    draft["interaction"] = {
                        "turn_type": required_turns[min(index, len(required_turns) - 1)],
                        "preparation_seconds": constraints.get("preparation_seconds"),
                        "response_seconds": constraints.get("response_seconds"),
                    }
                self.db.add(
                    ExamModuleQuestion(
                        part_id=part.id,
                        **draft,
                        source_type="manual",
                        source_filename=None,
                        sort_order=index,
                        created_by_id=self.instructor.id,
                    )
                )
            if module_type == "listening":
                is_browser_narration = part_index == 0
                relative = (
                    Path("tts-text") / str(module.id) / f"{part.part_code}.txt"
                    if is_browser_narration
                    else Path("exam-modules") / str(module.id) / f"{part.part_code}.mp3"
                )
                if not is_browser_narration:
                    stored = settings.storage_path / relative
                    stored.parent.mkdir(parents=True, exist_ok=True)
                    stored.write_bytes(f"ID3-{part.part_code}".encode())
                self.db.add(
                    ExamModuleAsset(
                        module_id=module.id,
                        part_id=part.id,
                        asset_type="tts_text" if is_browser_narration else "mp3",
                        title=f"{part.title} audio",
                        original_filename="browser-narration.txt" if is_browser_narration else f"{part.part_code}.mp3",
                        file_path=relative.as_posix(),
                        mime_type="text/plain" if is_browser_narration else "audio/mpeg",
                        file_size=42 if is_browser_narration else stored.stat().st_size,
                        transcript="Guide: Listen carefully to this conversation." if is_browser_narration else None,
                        tts_voice="en-GB" if is_browser_narration else None,
                        tts_rate="+0%" if is_browser_narration else None,
                        uploaded_by_id=self.instructor.id,
                    )
                )
        self.db.commit()
        self.db.expire_all()
        completed = module_authoring_service.serialize_module(
            module_authoring_service.get_module_or_404(self.db, created["id"]), detailed=True
        )
        self.assertTrue(completed["ready_to_publish"], completed.get("validation_errors"))
        return completed

    def test_all_six_blueprints_have_fixed_parts_and_timing(self) -> None:
        blueprints = {item["module_type"]: item for item in module_blueprint_service.list_blueprints()}
        self.assertEqual(set(blueprints), {"reading", "speaking", "writing", "listening", "full_mock", "final_test"})
        self.assertEqual((len(blueprints["reading"]["parts"]), blueprints["reading"]["duration_minutes"]), (5, 50))
        self.assertEqual((len(blueprints["listening"]["parts"]), blueprints["listening"]["duration_minutes"]), (4, 40))
        self.assertEqual((len(blueprints["writing"]["parts"]), blueprints["writing"]["duration_minutes"]), (2, 50))
        self.assertEqual((len(blueprints["speaking"]["parts"]), blueprints["speaking"]["duration_minutes"]), (4, 14))
        # Timing lives on each prompt. The part keeps the LanguageCert figures
        # only as an authoring suggestion - nothing reads them at exam time, and
        # a part no longer carries a live default a prompt could inherit.
        speaking_timings = [
            (
                part["answer_constraints"]["suggested_preparation_seconds"],
                part["answer_constraints"]["suggested_response_seconds"],
            )
            for part in blueprints["speaking"]["parts"]
        ]
        # Speaking 1 opens on the identity turn, so its legacy pair is that
        # turn's (0, 30) rather than a part-wide figure of its own.
        self.assertEqual(speaking_timings, [(0, 30), (0, 60), (20, 90), (60, 120)])
        for part in blueprints["speaking"]["parts"]:
            self.assertNotIn("preparation_seconds", part["answer_constraints"])
            self.assertNotIn("response_seconds", part["answer_constraints"])
        self.assertEqual((len(blueprints["full_mock"]["parts"]), blueprints["full_mock"]["duration_minutes"]), (15, 154))
        self.assertEqual(len(blueprints["final_test"]["parts"]), 15)

    def test_languagecert_blueprints_define_every_task_contract(self) -> None:
        reading = module_blueprint_service.get_blueprint("reading")
        self.assertEqual(
            [part["answer_constraints"]["allowed_question_types"] for part in reading["parts"]],
            [["mcq_single"], ["mcq_single"], ["matching_unique"], ["matching_reusable", "mcq_multiple"], ["mcq_single"]],
        )
        self.assertEqual(
            [part["answer_constraints"]["option_count"] for part in reading["parts"]],
            [4, 3, 8, 4, 4],
        )
        self.assertTrue(reading["parts"][2]["answer_constraints"]["unique_answers"])
        self.assertTrue(reading["parts"][3]["answer_constraints"]["shared_options"])

        listening = module_blueprint_service.get_blueprint("listening")
        self.assertEqual([part["question_limit"] for part in listening["parts"]], [7, 10, 7, 6])
        self.assertTrue(all(part["answer_constraints"]["audio_plays"] == 2 for part in listening["parts"]))
        self.assertEqual(listening["parts"][1]["answer_constraints"]["group_count"], 5)
        self.assertEqual(listening["parts"][1]["answer_constraints"]["questions_per_group"], 2)
        self.assertTrue(listening["parts"][2]["answer_constraints"]["inline_marker_required"])

        writing = module_blueprint_service.get_blueprint("writing")
        self.assertEqual(
            [part["answer_constraints"]["score_weight"] for part in writing["parts"]],
            [40, 60],
        )
        self.assertEqual(writing["parts"][0]["answer_constraints"]["maximum_words"], 200)

        speaking = module_blueprint_service.get_blueprint("speaking")
        task_fulfilment = next(
            criterion for criterion in speaking["parts"][0]["rubric"]
            if criterion["criterion"].startswith("Task Fulfilment")
        )
        self.assertEqual(task_fulfilment["weight"], 2)
        self.assertEqual(
            [part["answer_constraints"]["notes_allowed"] for part in speaking["parts"]],
            [False, False, False, True],
        )
        self.assertEqual(
            [part["answer_constraints"]["required_turn_types"] for part in speaking["parts"]],
            [
                ["identity", "topic_question"],
                ["roleplay_response", "roleplay_initiate"],
                ["read_aloud", "follow_up"],
                ["presentation", "follow_up"],
            ],
        )
        self.assertTrue(all(
            part["answer_constraints"]["interaction_mode"] == "ai_interlocutor"
            for part in speaking["parts"]
        ))
        # Speaking 3 is one read-aloud text and the questions asked about it.
        # The published format fixes no number of follow-ups - the interlocutor
        # asks "one or more as time allows" - so the bank beside the single text
        # is the author's to size.
        speaking_3 = speaking["parts"][2]
        self.assertEqual(speaking_3["minimum_questions"], 2)
        self.assertEqual(
            speaking_3["answer_constraints"]["allowed_turn_types"],
            ["read_aloud", "follow_up"],
        )
        self.assertEqual(speaking_3["answer_constraints"]["singleton_turn_types"], ["read_aloud"])
        # Speaking 4 has the same shape beside its single presentation.
        speaking_4 = speaking["parts"][3]
        self.assertEqual(speaking_4["answer_constraints"]["singleton_turn_types"], ["presentation"])
        # No Speaking part caps how many prompts it holds: an examiner decides
        # how long a part runs, and the module's duration follows the prompts.
        for part in speaking["parts"]:
            self.assertIsNone(part["question_limit"], part["part_code"])
            self.assertIsNone(
                part["answer_constraints"].get("maximum_questions"), part["part_code"]
            )

    def test_speaking_turn_timings_keep_the_paper_at_about_fourteen_minutes(self) -> None:
        """Each turn type carries its own clock, and the four parts authored to
        the reference shape of the format total the ~14 minutes it specifies.

        A single per-part default would hand a Part 4 follow-up the
        presentation's 60s + 120s, putting three follow-ups at nine minutes on
        their own and the paper at well over twenty. Nothing caps a part, so
        this is the shape an author starts from rather than a ceiling.
        """
        speaking = module_blueprint_service.get_blueprint("speaking")
        timings = module_blueprint_service.SPEAKING_TURN_TIMINGS
        # The reference sitting: identity + 5 topic questions, 2 role plays,
        # read-aloud + 3 follow-ups, presentation + 3 follow-ups.
        reference = {
            "speaking_1": {"identity": 1, "topic_question": 5},
            "speaking_2": {"roleplay_response": 1, "roleplay_initiate": 1},
            "speaking_3": {"read_aloud": 1, "follow_up": 3},
            "speaking_4": {"presentation": 1, "follow_up": 3},
        }

        total = 0
        for part in speaking["parts"]:
            constraints = part["answer_constraints"]
            turns = reference[part["part_code"]]
            self.assertTrue(set(turns) <= set(constraints["allowed_turn_types"]), part["part_code"])
            total += sum(sum(timings[turn]) * count for turn, count in turns.items())
            # Every allowed turn must have a default, or the form has nothing to
            # pre-fill and the author is left guessing the clock.
            self.assertEqual(
                sorted(constraints["turn_timings"]),
                sorted(constraints["allowed_turn_types"]),
            )

        self.assertEqual(total, 830)
        self.assertLessEqual(total / 60, speaking["duration_minutes"])
        self.assertGreater(total / 60, speaking["duration_minutes"] - 1)

    def test_speaking_duration_is_derived_from_each_prompts_own_timing(self) -> None:
        """A Speaking module's duration is the sum of its prompts and nothing
        else: it cannot be typed in, there is no part-level default to inherit,
        and it moves as prompts are added, edited and removed."""
        created = self._create("speaking")
        updated = module_authoring_service.update_module(
            self.db,
            self.instructor,
            created["id"],
            {"duration_minutes": 22},
            {"duration_minutes"},
            "127.0.0.1",
        )
        self.assertEqual(updated["duration_minutes"], 14, "typed duration is ignored")

        first_part = updated["parts"][0]

        # A prompt with no recording time cannot be saved - it is what the
        # candidate's clock is built from.
        naked = _question("speaking_prompt", "Tell me about yourself")
        naked["interaction"] = {"turn_type": "identity"}
        with self.assertRaises(HTTPException) as missing:
            module_authoring_service.add_question(
                self.db, self.instructor, created["id"], first_part["id"], naked, None
            )
        self.assertEqual(missing.exception.status_code, 400)

        prompt = _question("speaking_prompt", "Tell me about yourself")
        prompt["interaction"] = {
            "turn_type": "identity",
            "preparation_seconds": 15,
            "response_seconds": 75,
        }
        question = module_authoring_service.add_question(
            self.db, self.instructor, created["id"], first_part["id"], prompt, None
        )
        recalculated = module_authoring_service.serialize_module(
            module_authoring_service.get_module_or_404(self.db, created["id"]), detailed=True
        )
        self.assertEqual(recalculated["duration_minutes"], 2)      # 15 + 75 = 90s
        self.assertEqual(recalculated["parts"][0]["duration_minutes"], 2)

        prompt["interaction"]["response_seconds"] = 125
        module_authoring_service.update_question(
            self.db, self.instructor, created["id"], first_part["id"], question["id"], prompt, None
        )
        recalculated = module_authoring_service.serialize_module(
            module_authoring_service.get_module_or_404(self.db, created["id"]), detailed=True
        )
        self.assertEqual(recalculated["duration_minutes"], 3)      # 15 + 125 = 140s

        # Zero preparation is a real setting, not a missing one: the candidate
        # starts speaking as the examiner finishes, and only the recording time
        # counts toward the module.
        prompt["interaction"]["preparation_seconds"] = 0
        prompt["interaction"]["response_seconds"] = 60
        module_authoring_service.update_question(
            self.db, self.instructor, created["id"], first_part["id"], question["id"], prompt, None
        )
        recalculated = module_authoring_service.serialize_module(
            module_authoring_service.get_module_or_404(self.db, created["id"]), detailed=True
        )
        self.assertEqual(recalculated["duration_minutes"], 1)      # 0 + 60 = 60s

        # Very short answers are valid when the instructor intentionally sets
        # them. The old 5-second floor made follow-up response time feel stuck
        # in the authoring UI.
        prompt["interaction"]["response_seconds"] = 1
        module_authoring_service.update_question(
            self.db, self.instructor, created["id"], first_part["id"], question["id"], prompt, None
        )
        recalculated = module_authoring_service.serialize_module(
            module_authoring_service.get_module_or_404(self.db, created["id"]), detailed=True
        )
        self.assertEqual(recalculated["duration_minutes"], 1)      # 0 + 1 = 1s, rounded up

        prompt["interaction"]["response_seconds"] = 0
        with self.assertRaises(HTTPException) as too_short:
            module_authoring_service.update_question(
                self.db, self.instructor, created["id"], first_part["id"], question["id"], prompt, None
            )
        self.assertEqual(too_short.exception.status_code, 400)
        self.assertIn("at least 1 second", too_short.exception.detail)

        module_authoring_service.delete_question(
            self.db, self.instructor, created["id"], first_part["id"], question["id"], None
        )
        reset = module_authoring_service.serialize_module(
            module_authoring_service.get_module_or_404(self.db, created["id"]), detailed=True
        )
        self.assertEqual(reset["duration_minutes"], 14, "an empty module falls back to the blueprint figure")

    def test_examiner_preview_resolves_speaking_parts_only(self) -> None:
        speaking = self._create("speaking")
        part = module_authoring_service.get_speaking_part_for_preview(
            self.db, self.instructor, speaking["id"], speaking["parts"][0]["id"]
        )
        self.assertEqual(part.part_code, "speaking_1")

        reading = self._create("reading")
        with self.assertRaises(HTTPException):
            module_authoring_service.get_speaking_part_for_preview(
                self.db, self.instructor, reading["id"], reading["parts"][0]["id"]
            )

    def test_instructor_can_toggle_ai_evaluation_for_subjective_parts(self) -> None:
        writing = self._create("writing")
        first_part = writing["parts"][0]
        self.assertTrue(first_part["ai_evaluation_enabled"])

        updated = module_authoring_service.update_part_ai_evaluation(
            self.db,
            self.instructor,
            writing["id"],
            first_part["id"],
            False,
            "127.0.0.1",
        )

        self.assertFalse(updated["parts"][0]["ai_evaluation_enabled"])

        reading = self._create("reading")
        with self.assertRaises(HTTPException):
            module_authoring_service.update_part_ai_evaluation(
                self.db,
                self.instructor,
                reading["id"],
                reading["parts"][0]["id"],
                True,
                None,
            )

    def test_questions_are_part_scoped_and_writing_can_publish(self) -> None:
        created = self._create("writing")
        first, second = created["parts"]
        with self.assertRaises(HTTPException):
            module_authoring_service.add_question(
                self.db,
                self.instructor,
                created["id"],
                first["id"],
                _question("mcq_single", "Wrong type"),
                None,
            )

        module_authoring_service.add_question(
            self.db, self.instructor, created["id"], first["id"], _question("essay", "Write an academic report", Decimal("32")), None
        )
        module_authoring_service.add_question(
            self.db, self.instructor, created["id"], second["id"], _question("essay", "Write a discursive essay", Decimal("32")), None
        )
        ready = module_authoring_service.serialize_module(
            module_authoring_service.get_module_or_404(self.db, created["id"]), detailed=True
        )
        self.assertTrue(ready["ready_to_publish"])
        published = module_authoring_service.set_status(
            self.db, self.instructor, created["id"], "published", None
        )
        self.assertEqual(published["status"], "published")
        updated = module_authoring_service.update_module(
            self.db,
            self.instructor,
            created["id"],
            {"title": "Updated published writing course"},
            {"title"},
            None,
        )
        self.assertEqual(updated["title"], "Updated published writing course")
        first_question = updated["parts"][0]["questions"][0]
        edited_question = module_authoring_service.update_question(
            self.db,
            self.instructor,
            created["id"],
            first["id"],
            first_question["id"],
            _question("essay", "Updated task after publication", Decimal("32")),
            None,
        )
        self.assertEqual(edited_question["prompt"], "Updated task after publication")

    def test_a_part_holds_exactly_its_question_limit(self) -> None:
        # There is no pool: Reading 1A sits 6 questions, so the 7th has to be
        # refused at authoring time rather than silently never shown.
        created = self._create("reading")
        part = next(item for item in created["parts"] if item["part_code"] == "reading_1a")
        limit = part["question_limit"]
        for index in range(limit):
            module_authoring_service.add_question(
                self.db,
                self.instructor,
                created["id"],
                part["id"],
                _question("mcq_single", f"Define the **term** number {index + 1}", option_count=4),
                None,
            )

        with self.assertRaises(HTTPException) as overflow:
            module_authoring_service.add_question(
                self.db,
                self.instructor,
                created["id"],
                part["id"],
                _question("mcq_single", "One **extra** question too many", option_count=4),
                None,
            )
        self.assertIn("takes exactly", str(overflow.exception.detail))

        # Editing one of the 6 stays allowed while the part is at capacity.
        saved = module_authoring_service.serialize_module(
            module_authoring_service.get_module_or_404(self.db, created["id"]), detailed=True
        )
        saved_part = next(item for item in saved["parts"] if item["part_code"] == "reading_1a")
        edited = module_authoring_service.update_question(
            self.db,
            self.instructor,
            created["id"],
            part["id"],
            saved_part["questions"][0]["id"],
            _question("mcq_single", "Rewritten **term** question", option_count=4),
            None,
        )
        self.assertEqual(edited["prompt"], "Rewritten **term** question")

    def test_publishing_is_blocked_when_a_part_exceeds_its_question_count(self) -> None:
        created = self._complete("reading")
        module = module_authoring_service.get_module_or_404(self.db, created["id"])
        self.assertEqual(module_authoring_service.validation_errors(module), [])

        # Legacy modules authored before the cap can still hold surplus rows.
        part = next(item for item in module.parts if item.part_code == "reading_1a")
        self.db.add(
            ExamModuleQuestion(
                part_id=part.id,
                **_question("mcq_single", "Surplus **legacy** question", Decimal("1"), option_count=4),
                source_type="manual",
                source_filename=None,
                sort_order=99,
                created_by_id=self.instructor.id,
            )
        )
        self.db.commit()
        self.db.refresh(module)
        errors = module_authoring_service.validation_errors(module)
        self.assertTrue(
            any("Reading 1A takes exactly 6 questions; it currently has 7." == message for message in errors),
            errors,
        )

    def test_listening_requires_part_specific_audio(self) -> None:
        created = self._create("listening")
        first = created["parts"][0]
        asset = module_authoring_service.add_audio_asset(
            self.db,
            self.instructor,
            created["id"],
            first["id"],
            content=b"ID3generated-audio",
            title="Conversation one",
            original_filename="conversation.mp3",
            asset_type="tts_mp3",
            transcript="Speaker A: Hello.",
            voice="en-GB-SoniaNeural",
            ip=None,
        )
        self.assertEqual(asset["part_id"], first["id"])
        self.assertTrue((settings.storage_path / asset["url"].removeprefix("/storage/")).is_file())
        module = module_authoring_service.get_module_or_404(self.db, created["id"])
        errors = module_authoring_service.validation_errors(module)
        media_error = "requires an MP3 upload or browser-narrated transcript"
        self.assertFalse(any(message.startswith("Listening 1 ") and media_error in message for message in errors))
        self.assertTrue(any(message.startswith("Listening 2 ") and media_error in message for message in errors))

    def test_browser_narration_stores_text_without_writing_an_mp3(self) -> None:
        created = self._create("listening")
        first = created["parts"][0]

        asset = module_authoring_service.add_tts_text_asset(
            self.db,
            self.instructor,
            created["id"],
            first["id"],
            title="Campus conversation",
            transcript="Guide: Welcome to campus.\nStudent: Thank you.",
            voice="en-GB",
            rate="+15%",
            ip=None,
        )

        stored = self.db.get(ExamModuleAsset, asset["id"])
        self.assertEqual(asset["asset_type"], "tts_text")
        self.assertIsNone(asset["url"])
        self.assertEqual(asset["tts_rate"], "+15%")
        self.assertEqual(stored.transcript, "Guide: Welcome to campus.\nStudent: Thank you.")
        self.assertFalse((settings.storage_path / stored.file_path).exists())

    def test_composite_module_can_start_empty_for_full_file_import(self) -> None:
        final_test = module_authoring_service.create_module(
            self.db,
            self.instructor,
            {
                "module_type": "final_test",
                "title": "Full Upload Final Test",
                "description": None,
                "instructions": None,
                "source_module_ids": [],
            },
            None,
        )

        self.assertEqual(final_test["source_module_ids"], [])
        self.assertEqual(final_test["question_count"], 0)
        self.assertFalse(final_test["ready_to_publish"])
        self.assertEqual(len(final_test["parts"]), 15)

    def test_final_test_copies_selected_sources_in_order_and_can_be_deleted_when_published(self) -> None:
        sources = {
            module_type: self._complete(module_type)
            for module_type in ("listening", "reading", "writing", "speaking")
        }
        sources["reading"] = module_authoring_service.update_module(
            self.db,
            self.instructor,
            sources["reading"]["id"],
            {"duration_minutes": 55},
            {"duration_minutes"},
            None,
        )
        selected_ids = [sources[module_type]["id"] for module_type in ("listening", "reading", "writing", "speaking")]

        with patch("app.services.module_authoring_service.secrets.SystemRandom") as randomizer_class:
            randomizer_class.return_value.shuffle.side_effect = lambda questions: questions.reverse()
            final_test = module_authoring_service.create_module(
                self.db,
                self.instructor,
                {
                    "module_type": "final_test",
                    "title": "Randomized Final Test A",
                    "description": None,
                    "instructions": None,
                    "source_module_ids": selected_ids,
                },
                None,
            )

        self.assertEqual(final_test["source_module_ids"], selected_ids)
        self.assertEqual(
            final_test["duration_minutes"],
            sum(source["duration_minutes"] for source in sources.values()),
        )
        self.assertTrue(final_test["ready_to_publish"])
        self.assertEqual(final_test["question_count"], sum(source["question_count"] for source in sources.values()))
        self.assertEqual(randomizer_class.return_value.shuffle.call_count, 0)

        source_reading_1a = next(part for part in sources["reading"]["parts"] if part["part_code"] == "reading_1a")
        copied_reading_1a = next(part for part in final_test["parts"] if part["part_code"] == "reading_1a")
        self.assertEqual(
            [question["prompt"] for question in copied_reading_1a["questions"]],
            [question["prompt"] for question in source_reading_1a["questions"]],
        )

        source_audio = sources["listening"]["parts"][0]["assets"][0]
        copied_audio = next(part for part in final_test["parts"] if part["part_code"] == "listening_1")["assets"][0]
        self.assertEqual(source_audio["asset_type"], "tts_text")
        self.assertIsNone(source_audio["url"])
        self.assertIsNone(copied_audio["url"])
        self.assertEqual(source_audio["transcript"], copied_audio["transcript"])
        self.assertEqual(source_audio["tts_rate"], copied_audio["tts_rate"])
        source_mp3 = sources["listening"]["parts"][1]["assets"][0]
        copied_mp3 = next(part for part in final_test["parts"] if part["part_code"] == "listening_2")["assets"][0]
        source_audio_path = settings.storage_path / source_mp3["url"].removeprefix("/storage/")
        copied_audio_path = settings.storage_path / copied_mp3["url"].removeprefix("/storage/")
        self.assertEqual(source_audio_path.read_bytes(), copied_audio_path.read_bytes())

        source_conversations = next(
            part for part in sources["listening"]["parts"] if part["part_code"] == "listening_2"
        )
        copied_conversations = next(
            part for part in final_test["parts"] if part["part_code"] == "listening_2"
        )
        self.assertEqual(
            [question["interaction"] for question in copied_conversations["questions"]],
            [question["interaction"] for question in source_conversations["questions"]],
        )
        source_speaking = next(
            part for part in sources["speaking"]["parts"] if part["part_code"] == "speaking_4"
        )
        copied_speaking = next(part for part in final_test["parts"] if part["part_code"] == "speaking_4")
        self.assertEqual(
            [question["interaction"] for question in copied_speaking["questions"]],
            [question["interaction"] for question in source_speaking["questions"]],
        )

        published = module_authoring_service.set_status(
            self.db, self.instructor, final_test["id"], "published", None
        )
        self.assertEqual(published["status"], "published")
        other_instructor = User(
            email="different-author@example.com",
            password_hash=hash_password("DifferentTeacher!1"),
            role_id=self.instructor.role_id,
            first_name="Different",
            last_name="Author",
            is_active=True,
        )
        self.db.add(other_instructor)
        self.db.commit()
        with self.assertRaises(HTTPException) as denied:
            module_authoring_service.delete_module(
                self.db, other_instructor, final_test["id"], None
            )
        self.assertEqual(denied.exception.status_code, 403)
        self.assertIsNotNone(self.db.get(ExamModule, final_test["id"]))

        with self.assertRaises(HTTPException) as published_denied:
            module_authoring_service.delete_module(
                self.db, self.instructor, final_test["id"], None
            )
        self.assertEqual(published_denied.exception.status_code, 400)
        module_authoring_service.set_status(
            self.db, self.instructor, final_test["id"], "draft", None
        )
        module_authoring_service.delete_module(self.db, self.instructor, final_test["id"], None)
        self.assertIsNone(self.db.get(ExamModule, final_test["id"]))
        self.assertFalse(copied_audio_path.exists())
        self.assertTrue(source_audio_path.exists())

    def test_update_part(self) -> None:
        module = module_authoring_service.create_module(
            self.db,
            self.instructor,
            {
                "module_type": "reading",
                "title": "Test Reading Module",
                "description": "Desc",
                "instructions": "Inst",
            },
            None,
        )
        db_module = self.db.get(ExamModule, module["id"])
        part = db_module.parts[0]
        self.assertEqual(part.title, "Reading 1A")

        # Test update part
        updated = module_authoring_service.update_part(
            self.db,
            self.instructor,
            module["id"],
            part.id,
            {"title": "Custom Reading Part 1A", "instructions": "Read carefully."},
            {"title", "instructions"},
            None
        )
        self.assertEqual(updated["title"], "Custom Reading Part 1A")
        self.assertEqual(updated["instructions"], "Read carefully.")

        # Refresh and verify db
        self.db.refresh(part)
        self.assertEqual(part.title, "Custom Reading Part 1A")
        self.assertEqual(part.instructions, "Read carefully.")

    def test_speaking_pdf_material_is_serialized_and_deleted_with_question(self) -> None:
        created = self._create("speaking")
        module = module_authoring_service.get_module_or_404(self.db, created["id"])
        part = module.parts[0]
        uploaded = module_authoring_service.save_speaking_material_pdf(
            self.db,
            self.instructor,
            module.id,
            part.id,
            content=b"%PDF-1.4 speaking material",
            original_filename="role-play card.pdf",
            ip=None,
        )
        stored_path = settings.storage_path / uploaded["candidate_material_path"]
        self.assertTrue(stored_path.exists())

        draft = QuestionCreate(
            question_type="speaking_prompt",
            prompt="Sonia asks the candidate to read the role-play card.",
            passage="Use this role-play card to prepare your answer.",
            interaction={
                "turn_type": "identity",
                "response_seconds": 45,
                "candidate_material_type": "pdf",
                "candidate_material_path": uploaded["candidate_material_path"],
                "candidate_material_name": uploaded["candidate_material_name"],
            },
        ).model_dump()
        question = module_authoring_service.add_question(
            self.db, self.instructor, module.id, part.id, draft, None
        )
        self.assertEqual(
            question["interaction"]["candidate_material_url"],
            uploaded["candidate_material_url"],
        )
        self.assertEqual(question["passage"], "Use this role-play card to prepare your answer.")

        module_authoring_service.delete_question(
            self.db, self.instructor, module.id, part.id, question["id"], None
        )
        self.assertFalse(stored_path.exists())

    def test_speaking_material_mode_requires_its_candidate_content(self) -> None:
        with self.assertRaises(ValueError):
            QuestionCreate(
                question_type="speaking_prompt",
                prompt="Describe the chart.",
                interaction={"candidate_material_type": "image"},
            )
        with self.assertRaises(ValueError):
            QuestionCreate(
                question_type="speaking_prompt",
                prompt="Read this text aloud.",
                interaction={"candidate_material_type": "text"},
            )
        mixed = QuestionCreate(
            question_type="speaking_prompt",
            prompt="Describe the image.",
            passage="Use the image and the notes below to answer.",
            image_path="exam-modules/1/questions/chart.webp",
            interaction={"candidate_material_type": "image"},
        )
        self.assertEqual(mixed.passage, "Use the image and the notes below to answer.")

    def test_speaking_three_read_aloud_requires_candidate_text(self) -> None:
        created = self._create("speaking")
        module = module_authoring_service.get_module_or_404(self.db, created["id"])
        part = next(item for item in module.parts if item.part_code == "speaking_3")
        draft = QuestionCreate(
            question_type="speaking_prompt",
            prompt="You will now read the text aloud.",
            interaction={
                "turn_type": "read_aloud",
                "preparation_seconds": 20,
                "response_seconds": 90,
            },
        ).model_dump()

        with self.assertRaises(HTTPException) as ctx:
            module_authoring_service.add_question(
                self.db, self.instructor, module.id, part.id, draft, None
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("read-aloud", ctx.exception.detail)

    def test_imported_read_aloud_splits_examiner_prompt_from_candidate_text(self) -> None:
        created = self._create("speaking")
        module = module_authoring_service.get_module_or_404(self.db, created["id"])
        part = next(item for item in module.parts if item.part_code == "speaking_3")
        normalized = module_authoring_service._normalize_import_question_for_part(
            part,
            {
                "question_type": "speaking_prompt",
                "prompt": "Read the short text aloud: The training centre opens early during exam week.",
                "passage": "",
                "options": [],
                "correct_answers": [],
                "interaction": {"turn_type": "read_aloud"},
                "points": 1,
                "difficulty": "medium",
            },
            0,
        )

        self.assertEqual(normalized["prompt"], "Read the given text aloud.")
        self.assertEqual(normalized["passage"], "The training centre opens early during exam week.")
        self.assertEqual(normalized["interaction"]["turn_type"], "read_aloud")

        normalized_given = module_authoring_service._normalize_import_question_for_part(
            part,
            {
                "question_type": "speaking_prompt",
                "prompt": "Read the given text aloud: The training centre opens early during exam week.",
                "passage": "",
                "options": [],
                "correct_answers": [],
                "interaction": {"turn_type": "read_aloud"},
                "points": 1,
                "difficulty": "medium",
            },
            0,
        )
        self.assertEqual(normalized_given["prompt"], "Read the given text aloud.")
        self.assertEqual(normalized_given["passage"], "The training centre opens early during exam week.")

    def _speaking_part(self, part_code: str):
        created = self._create("speaking")
        module = module_authoring_service.get_module_or_404(self.db, created["id"])
        return module, next(item for item in module.parts if item.part_code == part_code)

    def _speaking_draft(self, prompt: str, turn_type: str, *, passage=None, heading=None, heading_gap_seconds=None) -> dict:
        interaction = {"turn_type": turn_type, "preparation_seconds": 0, "response_seconds": 40}
        if heading is not None:
            interaction["heading"] = heading
        if heading_gap_seconds is not None:
            interaction["heading_gap_seconds"] = heading_gap_seconds
        return QuestionCreate(
            question_type="speaking_prompt",
            prompt=prompt,
            passage=passage,
            interaction=interaction,
        ).model_dump()

    def test_a_speaking_two_prompt_carries_a_spoken_heading_and_its_pause(self) -> None:
        """A role play is announced before it is asked. The announcement is its
        own field, not the first line of the question, because the examiner
        pauses between the two and a pause cannot live inside one spoken line."""
        module, part = self._speaking_part("speaking_2")
        self.assertTrue(part.answer_constraints["spoken_heading"])
        saved = module_authoring_service.add_question(
            self.db, self.instructor, module.id, part.id,
            self._speaking_draft(
                "How would you ask for a different room?",
                "roleplay_response",
                heading="Situation 1. You are at a hotel reception.",
                heading_gap_seconds=5,
            ),
            None,
        )
        self.assertEqual(saved["interaction"]["heading"], "Situation 1. You are at a hotel reception.")
        self.assertEqual(saved["interaction"]["heading_gap_seconds"], 5)

    def test_every_speaking_part_takes_a_spoken_heading(self) -> None:
        """Part 1 opens a topic, Part 3 introduces the text, Part 4 sets up the
        presentation - each is announced before it is asked, so the heading is
        not Speaking 2's alone."""
        for part_code, turn_type in (
            ("speaking_1", "identity"),
            ("speaking_3", "read_aloud"),
            ("speaking_4", "presentation"),
        ):
            module, part = self._speaking_part(part_code)
            self.assertTrue(part.answer_constraints["spoken_heading"], part_code)
            saved = module_authoring_service.add_question(
                self.db, self.instructor, module.id, part.id,
                self._speaking_draft(
                    "Tell me about that.",
                    turn_type,
                    passage="A text to read." if turn_type == "read_aloud" else None,
                    heading=f"Now I am going to ask you about {part_code}.",
                    heading_gap_seconds=4,
                ),
                None,
            )
            self.assertEqual(saved["interaction"]["heading"], f"Now I am going to ask you about {part_code}.")
            self.assertEqual(saved["interaction"]["heading_gap_seconds"], 4)

    def test_a_written_part_refuses_a_spoken_heading(self) -> None:
        """Nothing speaks in a Writing part, so a heading there would be wording
        no candidate ever hears - refused rather than saved unheard."""
        created = self._create("writing")
        part = created["parts"][0]

        with self.assertRaises(HTTPException) as ctx:
            module_authoring_service.add_question(
                self.db, self.instructor, created["id"], part["id"],
                QuestionCreate(
                    question_type="essay",
                    prompt="Write about a place you know well.",
                    points=Decimal(part["max_marks"]),
                    interaction={"heading": "Situation 1. You are at a hotel reception."},
                ).model_dump(),
                None,
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("no spoken heading", ctx.exception.detail)

    def test_speaking_three_takes_follow_up_questions_after_the_text(self) -> None:
        """The read-aloud and its follow-ups share the part. A follow-up is a
        spoken question, so it must not be asked for a text of its own."""
        module, part = self._speaking_part("speaking_3")
        module_authoring_service.add_question(
            self.db, self.instructor, module.id, part.id,
            self._speaking_draft("Please read this aloud.", "read_aloud", passage="An academic text."),
            None,
        )
        for index in range(3):
            module_authoring_service.add_question(
                self.db, self.instructor, module.id, part.id,
                self._speaking_draft(f"What is the writer's main point? ({index})", "follow_up"),
                None,
            )

        self.db.expire_all()
        part = next(
            item
            for item in module_authoring_service.get_module_or_404(self.db, module.id).parts
            if item.part_code == "speaking_3"
        )
        self.assertEqual(len(part.questions), 4)
        self.assertEqual(
            [(question.interaction or {}).get("turn_type") for question in sorted(part.questions, key=lambda q: q.sort_order)],
            ["read_aloud", "follow_up", "follow_up", "follow_up"],
        )

    def test_a_speaking_follow_up_bank_has_no_ceiling(self) -> None:
        """How many follow-ups a part holds is the author's call: the format
        says the interlocutor asks "one or more as time allows" and fixes no
        number, and the extra prompt simply lengthens the derived duration."""
        module, part = self._speaking_part("speaking_3")
        module_authoring_service.add_question(
            self.db, self.instructor, module.id, part.id,
            self._speaking_draft("Please read this aloud.", "read_aloud", passage="An academic text."),
            None,
        )
        for index in range(6):
            module_authoring_service.add_question(
                self.db, self.instructor, module.id, part.id,
                self._speaking_draft(f"Follow up {index}", "follow_up"), None,
            )

        self.db.expire_all()
        saved = next(
            item
            for item in module_authoring_service.get_module_or_404(self.db, module.id).parts
            if item.part_code == "speaking_3"
        )
        self.assertEqual(len(saved.questions), 7)
        errors = module_authoring_service.validation_errors(
            module_authoring_service.get_module_or_404(self.db, module.id)
        )
        self.assertEqual([error for error in errors if error.startswith("Speaking 3")], [])

    def test_a_speaking_part_takes_only_one_headline_turn(self) -> None:
        """A ceiling alone cannot tell "one text plus three questions" from
        "four texts", so the headline turn is capped at one on its own."""
        module, part = self._speaking_part("speaking_3")
        module_authoring_service.add_question(
            self.db, self.instructor, module.id, part.id,
            self._speaking_draft("Please read this aloud.", "read_aloud", passage="An academic text."),
            None,
        )

        with self.assertRaises(HTTPException) as ctx:
            module_authoring_service.add_question(
                self.db, self.instructor, module.id, part.id,
                self._speaking_draft("Read this one too.", "read_aloud", passage="A second text."),
                None,
            )
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("one read aloud", ctx.exception.detail)
        self.assertIn("follow up", ctx.exception.detail)

    def test_editing_the_read_aloud_is_not_a_duplicate(self) -> None:
        """The singleton rule counts the other prompts, not the one being saved,
        or a read-aloud could never be corrected after it was written."""
        module, part = self._speaking_part("speaking_3")
        # add_question and update_question both return the single question,
        # not the module.
        created = module_authoring_service.add_question(
            self.db, self.instructor, module.id, part.id,
            self._speaking_draft("Please read this aloud.", "read_aloud", passage="An academic text."),
            None,
        )

        updated = module_authoring_service.update_question(
            self.db, self.instructor, module.id, part.id, created["id"],
            self._speaking_draft("Please read this text aloud now.", "read_aloud", passage="A corrected text."),
            None,
        )
        self.assertEqual(updated["id"], created["id"])
        self.assertEqual(updated["prompt"], "Please read this text aloud now.")

    def test_deleting_and_rewriting_the_read_aloud_keeps_it_first(self) -> None:
        """`add_question` numbers a new prompt `len(part.questions)`, and delete
        never renumbered, so a read-aloud written again after being deleted was
        appended after its own follow-ups - with a `sort_order` already in use.
        The candidate would have been asked about a text they had not read."""
        module, part = self._speaking_part("speaking_3")
        first = module_authoring_service.add_question(
            self.db, self.instructor, module.id, part.id,
            self._speaking_draft("Read this aloud.", "read_aloud", passage="An academic text."),
            None,
        )
        for index in range(3):
            module_authoring_service.add_question(
                self.db, self.instructor, module.id, part.id,
                self._speaking_draft(f"Follow up {index}", "follow_up"), None,
            )

        module_authoring_service.delete_question(
            self.db, self.instructor, module.id, part.id, first["id"], None
        )
        module_authoring_service.add_question(
            self.db, self.instructor, module.id, part.id,
            self._speaking_draft("Read this aloud instead.", "read_aloud", passage="A replacement text."),
            None,
        )

        self.db.expire_all()
        part = next(
            item
            for item in module_authoring_service.get_module_or_404(self.db, module.id).parts
            if item.part_code == "speaking_3"
        )
        ordered = sorted(part.questions, key=lambda question: question.sort_order)
        self.assertEqual(
            [(question.interaction or {}).get("turn_type") for question in ordered],
            ["read_aloud", "follow_up", "follow_up", "follow_up"],
        )
        self.assertEqual(ordered[0].prompt, "Read this aloud instead.")
        # and no two prompts share a position
        orders = [question.sort_order for question in ordered]
        self.assertEqual(orders, [0, 1, 2, 3])

    def test_speaking_two_keeps_the_order_the_author_chose(self) -> None:
        """Part 2 is two role plays and nothing else. The format does not say
        which comes first, so the leading-turn rule must not reorder it."""
        module, part = self._speaking_part("speaking_2")
        for turn in ("roleplay_initiate", "roleplay_response"):
            module_authoring_service.add_question(
                self.db, self.instructor, module.id, part.id,
                self._speaking_draft(f"{turn} situation", turn), None,
            )

        self.db.expire_all()
        part = next(
            item
            for item in module_authoring_service.get_module_or_404(self.db, module.id).parts
            if item.part_code == "speaking_2"
        )
        self.assertEqual(
            [(q.interaction or {}).get("turn_type") for q in sorted(part.questions, key=lambda q: q.sort_order)],
            ["roleplay_initiate", "roleplay_response"],
        )

    def test_publish_reports_a_part_carrying_two_headline_turns(self) -> None:
        """Revision 0076 left spare read-aloud texts in the pool, so a migrated
        part can hold two. Publish has to say so rather than pick one."""
        module, part = self._speaking_part("speaking_3")
        for index in range(2):
            self.db.add(
                ExamModuleQuestion(
                    part_id=part.id,
                    **_question("speaking_prompt", f"Read text {index}", Decimal("1")),
                    source_type="manual",
                    source_filename=None,
                    sort_order=index,
                    created_by_id=self.instructor.id,
                )
            )
        self.db.commit()
        self.db.expire_all()
        for question in next(
            item for item in module_authoring_service.get_module_or_404(self.db, module.id).parts
            if item.part_code == "speaking_3"
        ).questions:
            question.interaction = {"turn_type": "read_aloud", "preparation_seconds": 20, "response_seconds": 90}
        self.db.commit()
        self.db.expire_all()

        errors = module_authoring_service.validation_errors(
            module_authoring_service.get_module_or_404(self.db, module.id)
        )
        self.assertTrue(
            any("takes one read aloud turn; it currently has 2" in error for error in errors),
            errors,
        )


if __name__ == "__main__":
    unittest.main()
