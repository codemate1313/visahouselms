import asyncio
import io
import unittest
from decimal import Decimal

from fastapi import HTTPException, UploadFile
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.datastructures import Headers

from app.core.security import hash_password
from app.models import Base
from app.models.assessment import Assessment, Question, QuestionBank
from app.models.course import Course
from app.models.role import SA_INSTRUCTOR, Role
from app.models.user import User
from app.services import assessment_service, question_import_service


def _simple_pdf(lines: list[str]) -> bytes:
    escaped = [line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") for line in lines]
    text_ops = ["BT /F1 12 Tf 50 760 Td"]
    for index, line in enumerate(escaped):
        if index:
            text_ops.append("0 -18 Td")
        text_ops.append(f"({line}) Tj")
    text_ops.append("ET")
    stream = "\n".join(text_ops).encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    content = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(content))
        content.extend(f"{index} 0 obj\n".encode() + obj + b"\nendobj\n")
    xref = len(content)
    content.extend(f"xref\n0 {len(objects) + 1}\n".encode())
    content.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        content.extend(f"{offset:010d} 00000 n \n".encode())
    content.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode())
    return bytes(content)


class QuestionImportTests(unittest.TestCase):
    def test_csv_extracts_mcq_and_flexible_headers(self) -> None:
        upload = UploadFile(
            io.BytesIO(
                b"type,question,option_a,option_b,option_c,answer,explanation\n"
                b"mcq,Which word means fast?,slow,rapid,late,B,Rapid means fast\n"
            ),
            filename="questions.csv",
            headers=Headers({"content-type": "text/csv"}),
        )
        preview = asyncio.run(question_import_service.preview_upload(upload))
        self.assertEqual(preview["question_count"], 1)
        self.assertEqual(preview["questions"][0]["question_type"], "mcq_single")
        self.assertEqual(preview["questions"][0]["correct_answers"], ["B"])
        self.assertEqual(len(preview["questions"][0]["options"]), 3)

    def test_pdf_extracts_numbered_questions_options_and_answer(self) -> None:
        content = _simple_pdf([
            "1. Which word means fast?",
            "A. Slow",
            "B. Rapid",
            "C. Late",
            "Answer: B",
        ])
        upload = UploadFile(
            io.BytesIO(content),
            filename="questions.pdf",
            headers=Headers({"content-type": "application/pdf"}),
        )
        preview = asyncio.run(question_import_service.preview_upload(upload))
        self.assertEqual(preview["question_count"], 1)
        self.assertEqual(preview["questions"][0]["correct_answers"], ["B"])
        self.assertEqual(preview["warning_count"], 0)

    def test_pdf_supports_answer_key_at_end(self) -> None:
        content = _simple_pdf([
            "1. Which word means fast?", "A. Slow", "B. Rapid",
            "2. Which word means quiet?", "A. Silent", "B. Noisy",
            "Answer Key", "1. B", "2. A",
        ])
        upload = UploadFile(
            io.BytesIO(content),
            filename="answer-key.pdf",
            headers=Headers({"content-type": "application/pdf"}),
        )
        preview = asyncio.run(question_import_service.preview_upload(upload))
        self.assertEqual(preview["question_count"], 2)
        self.assertEqual(preview["questions"][0]["correct_answers"], ["B"])
        self.assertEqual(preview["questions"][1]["correct_answers"], ["A"])


class AssessmentServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()
        role = Role(name=SA_INSTRUCTOR)
        self.db.add(role)
        self.db.flush()
        self.instructor = User(
            email="author@example.com",
            password_hash=hash_password("TeacherPassword!1"),
            role_id=role.id,
            first_name="Test",
            last_name="Author",
            is_active=True,
        )
        self.db.add(self.instructor)
        self.db.flush()
        self.course = Course(
            title="IELTS Reading",
            slug="ielts-reading",
            summary="Reading course",
            level="all_levels",
            price=0,
            currency="INR",
            status="draft",
            created_by_id=self.instructor.id,
        )
        self.db.add(self.course)
        self.db.commit()
        self.db.refresh(self.instructor)
        self.db.refresh(self.course)

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_bank_question_and_test_publish_lifecycle(self) -> None:
        bank = assessment_service.create_bank(
            self.db,
            self.instructor,
            {"course_id": self.course.id, "title": "Reading MCQs", "description": None, "section": "reading"},
            None,
        )
        question = assessment_service.add_question(
            self.db,
            self.instructor,
            bank["id"],
            {
                "question_type": "mcq_single",
                "prompt": "Which word means fast?",
                "instructions": None,
                "passage": None,
                "options": [{"key": "A", "text": "Slow"}, {"key": "B", "text": "Rapid"}],
                "correct_answers": ["B"],
                "explanation": "Rapid means fast.",
                "points": Decimal("1"),
                "difficulty": "easy",
            },
            None,
        )
        test = assessment_service.create_assessment(
            self.db,
            self.instructor,
            {"course_id": self.course.id, "title": "Reading practice", "description": None, "assessment_type": "practice", "duration_minutes": 20, "instructions": None},
            None,
        )
        with self.assertRaises(HTTPException):
            assessment_service.set_assessment_status(self.db, self.instructor, test["id"], "published", None)
        assembled = assessment_service.set_assessment_questions(
            self.db, self.instructor, test["id"], [question["id"]], None
        )
        self.assertEqual(assembled["question_count"], 1)
        published = assessment_service.set_assessment_status(
            self.db, self.instructor, test["id"], "published", None
        )
        self.assertEqual(published["status"], "published")
        with self.assertRaises(HTTPException):
            assessment_service.update_question(
                self.db, self.instructor, bank["id"], question["id"], {
                    "question_type": "mcq_single", "prompt": "Changed", "instructions": None,
                    "passage": None, "options": [{"key": "A", "text": "Slow"}, {"key": "B", "text": "Rapid"}],
                    "correct_answers": ["B"], "explanation": None, "points": 1, "difficulty": "easy",
                }, None,
            )
        self.assertEqual(self.db.query(QuestionBank).count(), 1)
        self.assertEqual(self.db.query(Question).count(), 1)
        self.assertEqual(self.db.query(Assessment).count(), 1)


if __name__ == "__main__":
    unittest.main()
