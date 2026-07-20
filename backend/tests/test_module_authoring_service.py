import tempfile
import unittest
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.core.security import hash_password
from app.models import Base
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


if __name__ == "__main__":
    unittest.main()
