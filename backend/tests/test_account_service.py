import asyncio
import io
import os
import tempfile
import unittest

from fastapi import HTTPException, UploadFile
from PIL import Image
from starlette.datastructures import Headers

from app.config import settings
from app.core.uploads import read_compressed_profile_image
from app.services import account_service


def _upload(content: bytes, content_type: str = "image/png") -> UploadFile:
    return UploadFile(
        io.BytesIO(content),
        filename="profile.png",
        headers=Headers({"content-type": content_type}),
    )


class ProfileImageCompressionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.storage = tempfile.TemporaryDirectory()
        self.original_storage_dir = settings.storage_dir
        settings.storage_dir = self.storage.name

    def tearDown(self) -> None:
        settings.storage_dir = self.original_storage_dir
        self.storage.cleanup()

    def test_large_source_is_resized_and_compressed_to_webp(self) -> None:
        image = Image.frombytes("RGB", (2200, 1400), os.urandom(2200 * 1400 * 3))
        source = io.BytesIO()
        image.save(source, format="PNG")
        source_bytes = source.getvalue()
        self.assertGreater(len(source_bytes), 2 * 1024 * 1024)

        extension, compressed = asyncio.run(read_compressed_profile_image(_upload(source_bytes)))

        self.assertEqual(extension, ".webp")
        self.assertLess(len(compressed), len(source_bytes))
        with Image.open(io.BytesIO(compressed)) as result:
            self.assertEqual(result.format, "WEBP")
            self.assertLessEqual(max(result.size), 1600)

    def test_transparent_image_keeps_alpha_channel(self) -> None:
        source = io.BytesIO()
        Image.new("RGBA", (400, 300), (220, 30, 80, 96)).save(source, format="PNG")

        _, compressed = asyncio.run(read_compressed_profile_image(_upload(source.getvalue())))

        with Image.open(io.BytesIO(compressed)) as result:
            self.assertEqual(result.mode, "RGBA")

    def test_invalid_image_payload_is_rejected(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            asyncio.run(read_compressed_profile_image(_upload(b"not an image")))
        self.assertEqual(raised.exception.status_code, 400)

    def test_temporary_avatar_is_stored_as_compressed_webp(self) -> None:
        source = io.BytesIO()
        Image.new("RGB", (2400, 1800), "#e11d48").save(source, format="PNG")

        result = asyncio.run(account_service.save_temp_avatar(_upload(source.getvalue())))

        self.assertTrue(result["avatar_path"].endswith(".webp"))
        stored_path = settings.storage_path / result["avatar_path"]
        self.assertTrue(stored_path.is_file())
        with Image.open(stored_path) as stored:
            self.assertLessEqual(max(stored.size), 1600)


if __name__ == "__main__":
    unittest.main()
