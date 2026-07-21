import tempfile
import unittest
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.core.security import hash_password
from app.models import Base, ExamModule, ExamModuleAsset, ExamModuleQuestion
from app.models.role import SA_INSTRUCTOR, Role
from app.models.user import User
from app.services import module_authoring_service, module_blueprint_service


def _question(question_type: str, prompt: str, points: Decimal = Decimal("1")) -> dict:
    choice = question_type.startswith("mcq_")
    return {
        "question_type": question_type,
        "prompt": prompt,
        "instructions": None,
        "passage": None,
        "options": [{"key": "A", "text": "One"}, {"key": "B", "text": "Two"}] if choice else [],
        "correct_answers": ["A"] if choice or question_type in {"fill_blank", "short_answer"} else [],
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
        for part in module.parts:
            count = part.question_limit or part.minimum_questions
            question_type = part.answer_constraints["allowed_question_types"][0]
            points = Decimal(part.max_marks) / count if part.max_marks is not None else Decimal("1")
            for index in range(count):
                draft = _question(question_type, f"{part.part_code} source question {index + 1}", points)
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
                relative = Path("exam-modules") / str(module.id) / f"{part.part_code}.mp3"
                stored = settings.storage_path / relative
                stored.parent.mkdir(parents=True, exist_ok=True)
                stored.write_bytes(f"ID3-{part.part_code}".encode())
                self.db.add(
                    ExamModuleAsset(
                        module_id=module.id,
                        part_id=part.id,
                        asset_type="mp3",
                        title=f"{part.title} audio",
                        original_filename=f"{part.part_code}.mp3",
                        file_path=relative.as_posix(),
                        mime_type="audio/mpeg",
                        file_size=stored.stat().st_size,
                        transcript=None,
                        tts_voice=None,
                        uploaded_by_id=self.instructor.id,
                    )
                )
        self.db.commit()
        self.db.expire_all()
        completed = module_authoring_service.serialize_module(
            module_authoring_service.get_module_or_404(self.db, created["id"]), detailed=True
        )
        self.assertTrue(completed["ready_to_publish"])
        return completed

    def test_all_six_blueprints_have_fixed_parts_and_timing(self) -> None:
        blueprints = {item["module_type"]: item for item in module_blueprint_service.list_blueprints()}
        self.assertEqual(set(blueprints), {"reading", "speaking", "writing", "listening", "full_mock", "final_test"})
        self.assertEqual((len(blueprints["reading"]["parts"]), blueprints["reading"]["duration_minutes"]), (5, 50))
        self.assertEqual((len(blueprints["listening"]["parts"]), blueprints["listening"]["duration_minutes"]), (4, 40))
        self.assertEqual((len(blueprints["writing"]["parts"]), blueprints["writing"]["duration_minutes"]), (2, 50))
        self.assertEqual((len(blueprints["speaking"]["parts"]), blueprints["speaking"]["duration_minutes"]), (4, 14))
        self.assertEqual((len(blueprints["full_mock"]["parts"]), blueprints["full_mock"]["duration_minutes"]), (15, 154))
        self.assertEqual(len(blueprints["final_test"]["parts"]), 15)

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
        with self.assertRaises(HTTPException):
            module_authoring_service.add_question(
                self.db, self.instructor, created["id"], first["id"], _question("essay", "Another task"), None
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
        self.assertFalse(any("Listening 1 requires an MP3" in message for message in errors))
        self.assertTrue(any("Listening 2 requires an MP3" in message for message in errors))

    def test_final_test_copies_selected_sources_randomizes_and_can_be_deleted_when_published(self) -> None:
        sources = {
            module_type: self._complete(module_type)
            for module_type in ("listening", "reading", "writing", "speaking")
        }
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
        self.assertTrue(final_test["ready_to_publish"])
        self.assertEqual(final_test["question_count"], sum(source["question_count"] for source in sources.values()))
        self.assertEqual(randomizer_class.return_value.shuffle.call_count, len(final_test["parts"]))

        source_reading_1a = next(part for part in sources["reading"]["parts"] if part["part_code"] == "reading_1a")
        copied_reading_1a = next(part for part in final_test["parts"] if part["part_code"] == "reading_1a")
        self.assertEqual(
            [question["prompt"] for question in copied_reading_1a["questions"]],
            list(reversed([question["prompt"] for question in source_reading_1a["questions"]])),
        )

        source_audio = sources["listening"]["parts"][0]["assets"][0]
        copied_audio = next(part for part in final_test["parts"] if part["part_code"] == "listening_1")["assets"][0]
        self.assertNotEqual(source_audio["url"], copied_audio["url"])
        source_audio_path = settings.storage_path / source_audio["url"].removeprefix("/storage/")
        copied_audio_path = settings.storage_path / copied_audio["url"].removeprefix("/storage/")
        self.assertEqual(source_audio_path.read_bytes(), copied_audio_path.read_bytes())

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


if __name__ == "__main__":
    unittest.main()
