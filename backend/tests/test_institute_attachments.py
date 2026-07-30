import asyncio
import io
import tempfile
import unittest
from unittest import mock

from fastapi import HTTPException, UploadFile
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.datastructures import Headers

from app.config import settings
from app.core.security import hash_password
from app.models import Base
from app.models.institute import Institute
from app.models.role import SUPER_ADMIN, Role
from app.models.user import User
from app.services import institute_service


def _upload(filename: str, content: bytes, content_type: str = "application/octet-stream") -> UploadFile:
    return UploadFile(
        io.BytesIO(content),
        filename=filename,
        headers=Headers({"content-type": content_type}),
    )


class InstituteAttachmentTests(unittest.TestCase):
    def setUp(self) -> None:
        self.storage = tempfile.TemporaryDirectory()
        self.original_storage_dir = settings.storage_dir
        settings.storage_dir = self.storage.name
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        role = Role(name=SUPER_ADMIN)
        self.db.add(role)
        self.db.flush()
        self.actor = User(
            email="attachments@example.test",
            password_hash=hash_password("StrongPassword!1"),
            role_id=role.id,
            first_name="Attachment",
            last_name="Admin",
            is_active=True,
        )
        self.institute = Institute(
            name="Attachment Institute",
            slug="attachment-institute",
        )
        self.db.add_all([self.actor, self.institute])
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()
        settings.storage_dir = self.original_storage_dir
        self.storage.cleanup()

    def test_arbitrary_file_type_is_stored_with_safe_generated_name(self) -> None:
        result = asyncio.run(institute_service.save_agreement_attachment(
            self.db,
            self.actor,
            self.institute.id,
            "agreement",
            _upload("../../signed-agreement.custom", b"agreement bytes", "application/x-custom"),
            None,
        ))

        self.db.refresh(self.institute)
        self.assertEqual(result["name"], "signed-agreement.custom")
        self.assertEqual(self.institute.agreement_document_name, "signed-agreement.custom")
        stored = settings.storage_path / self.institute.agreement_document_path
        self.assertTrue(stored.is_file())
        self.assertEqual(stored.read_bytes(), b"agreement bytes")
        self.assertEqual(stored.suffix, "")

        download_path, download_name = institute_service.agreement_attachment_download(
            self.db, self.institute.id, "agreement"
        )
        self.assertEqual(download_path, stored.resolve())
        self.assertEqual(download_name, "signed-agreement.custom")

    def test_replacement_removes_old_file_and_delete_clears_metadata(self) -> None:
        asyncio.run(institute_service.save_agreement_attachment(
            self.db, self.actor, self.institute.id, "payment-proof",
            _upload("first.txt", b"first"), None,
        ))
        self.db.refresh(self.institute)
        old_path = settings.storage_path / self.institute.payment_proof_path

        asyncio.run(institute_service.save_agreement_attachment(
            self.db, self.actor, self.institute.id, "payment-proof",
            _upload("second.bin", b"second"), None,
        ))
        self.db.refresh(self.institute)
        new_path = settings.storage_path / self.institute.payment_proof_path
        self.assertFalse(old_path.exists())
        self.assertTrue(new_path.exists())
        self.assertEqual(self.institute.payment_proof_name, "second.bin")

        institute_service.delete_agreement_attachment(
            self.db, self.actor, self.institute.id, "payment-proof", None
        )
        self.db.refresh(self.institute)
        self.assertFalse(new_path.exists())
        self.assertIsNone(self.institute.payment_proof_path)
        self.assertIsNone(self.institute.payment_proof_name)

    def test_empty_and_oversized_attachments_are_rejected(self) -> None:
        with self.assertRaises(HTTPException) as empty_error:
            asyncio.run(institute_service.save_agreement_attachment(
                self.db, self.actor, self.institute.id, "agreement",
                _upload("empty", b""), None,
            ))
        self.assertEqual(empty_error.exception.status_code, 400)

        with mock.patch.object(institute_service, "MAX_AGREEMENT_ATTACHMENT_BYTES", 4):
            with self.assertRaises(HTTPException) as size_error:
                asyncio.run(institute_service.save_agreement_attachment(
                    self.db, self.actor, self.institute.id, "agreement",
                    _upload("large", b"12345"), None,
                ))
        self.assertEqual(size_error.exception.status_code, 413)

    def test_unknown_attachment_kind_is_rejected(self) -> None:
        with self.assertRaises(HTTPException) as caught:
            asyncio.run(institute_service.save_agreement_attachment(
                self.db, self.actor, self.institute.id, "unknown",
                _upload("file", b"value"), None,
            ))
        self.assertEqual(caught.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
