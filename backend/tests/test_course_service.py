import asyncio
import io
import tempfile
import unittest
from decimal import Decimal

from fastapi import HTTPException, UploadFile
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.datastructures import Headers

from app.config import settings
from app.core.security import hash_password
from app.models import Base
from app.models.course import COURSE_ARCHIVED, COURSE_DRAFT, COURSE_PUBLISHED
from app.models.institute import Institute
from app.models.role import SA_INSTRUCTOR, SUPER_ADMIN, Role
from app.models.user import User
from app.services import course_service


class CourseServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()
        self.storage = tempfile.TemporaryDirectory()
        self.original_storage_dir = settings.storage_dir
        settings.storage_dir = self.storage.name

        super_role = Role(name=SUPER_ADMIN)
        instructor_role = Role(name=SA_INSTRUCTOR)
        self.db.add_all([super_role, instructor_role])
        self.db.flush()
        self.admin = User(
            email="admin@example.com",
            password_hash=hash_password("AdminPassword!1"),
            role_id=super_role.id,
            first_name="Super",
            last_name="Admin",
            is_active=True,
        )
        self.instructor = User(
            email="teacher@example.com",
            password_hash=hash_password("TeacherPassword!1"),
            role_id=instructor_role.id,
            first_name="Course",
            last_name="Author",
            is_active=True,
        )
        self.institute = Institute(name="Example Institute", slug="example", is_active=True)
        self.db.add_all([self.admin, self.instructor, self.institute])
        self.db.commit()
        for record in (self.admin, self.instructor, self.institute):
            self.db.refresh(record)

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()
        settings.storage_dir = self.original_storage_dir
        self.storage.cleanup()

    def _create_course(self) -> dict:
        return course_service.create_course(
            self.db,
            self.instructor,
            {
                "title": "IELTS Academic Writing",
                "summary": "Build a stronger writing score.",
                "description": "Guided IELTS writing resources.",
                "level": "intermediate",
                "estimated_duration_minutes": 180,
                "price": Decimal("1999.00"),
                "currency": "INR",
                "is_featured": True,
            },
            "127.0.0.1",
        )

    def _pdf(self, filename: str = "guide.pdf") -> UploadFile:
        return UploadFile(
            io.BytesIO(b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF"),
            filename=filename,
            headers=Headers({"content-type": "application/pdf"}),
        )

    def test_full_publish_assignment_archive_lifecycle(self) -> None:
        created = self._create_course()
        course_id = created["id"]
        self.assertEqual(created["status"], COURSE_DRAFT)

        with self.assertRaises(HTTPException) as blocked:
            course_service.set_status(
                self.db, self.instructor, course_id, COURSE_PUBLISHED, "127.0.0.1"
            )
        self.assertIn("resource", blocked.exception.detail)

        asset = asyncio.run(
            course_service.add_asset(
                self.db,
                self.instructor,
                course_id,
                "Writing handbook",
                self._pdf(),
                "127.0.0.1",
            )
        )
        self.assertEqual(asset["asset_type"], "pdf")
        published = course_service.set_status(
            self.db, self.instructor, course_id, COURSE_PUBLISHED, "127.0.0.1"
        )
        self.assertEqual(published["status"], COURSE_PUBLISHED)

        assignment = course_service.assign_to_institute(
            self.db,
            self.admin,
            course_id,
            self.institute.id,
            "127.0.0.1",
        )
        self.assertTrue(assignment["is_active"])
        with self.assertRaises(HTTPException):
            course_service.set_status(
                self.db, self.instructor, course_id, COURSE_DRAFT, "127.0.0.1"
            )

        archived = course_service.set_status(
            self.db, self.instructor, course_id, COURSE_ARCHIVED, "127.0.0.1"
        )
        self.assertEqual(archived["status"], COURSE_ARCHIVED)
        self.assertEqual(archived["assignment_count"], 0)
        with self.assertRaises(HTTPException):
            course_service.delete_course(
                self.db, self.instructor, course_id, "127.0.0.1"
            )

    def test_reorder_and_delete_unreferenced_course_removes_files(self) -> None:
        created = self._create_course()
        course_id = created["id"]
        first = asyncio.run(
            course_service.add_asset(
                self.db, self.instructor, course_id, "First", self._pdf("first.pdf"), None
            )
        )
        second = asyncio.run(
            course_service.add_asset(
                self.db, self.instructor, course_id, "Second", self._pdf("second.pdf"), None
            )
        )
        reordered = course_service.reorder_assets(
            self.db, self.instructor, course_id, [second["id"], first["id"]], None
        )
        self.assertEqual([item["id"] for item in reordered], [second["id"], first["id"]])

        paths = [settings.storage_path / item["file_url"].removeprefix("/storage/") for item in reordered]
        self.assertTrue(all(path.is_file() for path in paths))
        course_service.delete_course(self.db, self.instructor, course_id, None)
        self.assertTrue(all(not path.exists() for path in paths))

    def test_rejects_disguised_upload(self) -> None:
        created = self._create_course()
        fake = UploadFile(
            io.BytesIO(b"this is not a pdf"),
            filename="unsafe.pdf",
            headers=Headers({"content-type": "application/pdf"}),
        )
        with self.assertRaises(HTTPException) as error:
            asyncio.run(
                course_service.add_asset(
                    self.db, self.instructor, created["id"], None, fake, None
                )
            )
        self.assertEqual(error.exception.detail, "File is not a valid PDF")


if __name__ == "__main__":
    unittest.main()
