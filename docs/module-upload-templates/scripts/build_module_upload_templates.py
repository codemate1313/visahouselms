from __future__ import annotations

import csv
from pathlib import Path
import re

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parents[1]
FIXTURE_ROOT = ROOT.parent / "module-upload-test-files"
CSV_DIR = ROOT / "csv"
PDF_DIR = ROOT / "pdf"

CSV_COLUMNS = [
    "prompt",
    "question_type",
    "option_a",
    "option_b",
    "option_c",
    "option_d",
    "option_e",
    "option_f",
    "option_g",
    "option_h",
    "option_i",
    "option_j",
    "option_k",
    "option_l",
    "option_m",
    "option_n",
    "option_o",
    "option_p",
    "option_q",
    "option_r",
    "option_s",
    "option_t",
    "option_u",
    "option_v",
    "option_w",
    "option_x",
    "option_y",
    "option_z",
    "correct_answer",
    "points",
    "difficulty",
    "instructions",
    "passage",
    "group_label",
    "turn_type",
    "preparation_seconds",
    "response_seconds",
    "adaptive_follow_up",
    "part_code",
]


def write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for row in rows:
            writer.writerow({column: row.get(column, "") for column in CSV_COLUMNS})


def csv_rows() -> dict[str, list[dict[str, object]]]:
    return {
        "reading-template.csv": [
            {
                "prompt": "What is the main reason the library extended its weekend opening hours?",
                "question_type": "mcq_single",
                "option_a": "Students requested more study time",
                "option_b": "The building needed repairs",
                "option_c": "Staff wanted shorter shifts",
                "option_d": "The cafe changed ownership",
                "correct_answer": "A",
                "points": 1,
                "difficulty": "medium",
                "passage": "The library survey showed that most learners needed quiet study space after weekday classes. In response, the library opened two extra hours on Saturdays.",
                "part_code": "Reading 1A",
            },
            {
                "prompt": "The word 'survey' in the passage is closest in meaning to:",
                "question_type": "mcq_single",
                "option_a": "invoice",
                "option_b": "questionnaire",
                "option_c": "timetable",
                "option_d": "announcement",
                "correct_answer": "B",
                "points": 1,
                "difficulty": "easy",
                "passage": "The library survey showed that most learners needed quiet study space after weekday classes. In response, the library opened two extra hours on Saturdays.",
                "part_code": "Reading 1A",
            },
        ],
        "listening-template.csv": [
            {
                "prompt": "Where will the orientation session take place?",
                "question_type": "mcq_single",
                "option_a": "Lecture Hall A",
                "option_b": "The main library",
                "option_c": "Student Services",
                "option_d": "Room 204",
                "correct_answer": "D",
                "points": 1,
                "difficulty": "medium",
                "group_label": "Orientation phone call",
                "part_code": "Listening 1",
            },
            {
                "prompt": "Which document should students bring?",
                "question_type": "mcq_single",
                "option_a": "Passport",
                "option_b": "Course invoice",
                "option_c": "Medical form",
                "option_d": "Library card",
                "correct_answer": "A",
                "points": 1,
                "difficulty": "medium",
                "group_label": "Orientation phone call",
                "part_code": "Listening 1",
            },
        ],
        "writing-template.csv": [
            {
                "prompt": "The chart compares online learning hours for three departments over one quarter. Summarise the main features and make comparisons where relevant.",
                "question_type": "essay",
                "points": 32,
                "difficulty": "medium",
                "instructions": "Write 150-200 words.",
                "passage": "Department A: April 120, May 145, June 160. Department B: April 90, May 110, June 150. Department C: April 140, May 130, June 125.",
                "part_code": "Writing 1",
            },
            {
                "prompt": "Some people believe students learn best in groups, while others prefer individual study. Discuss both views and give your opinion.",
                "question_type": "essay",
                "points": 32,
                "difficulty": "medium",
                "instructions": "Write 250-300 words.",
                "part_code": "Writing 2",
            },
        ],
        "speaking-template.csv": [
            {
                "prompt": "Please confirm your full name and where you are from.",
                "question_type": "speaking_prompt",
                "points": 1,
                "difficulty": "easy",
                "turn_type": "identity",
                "preparation_seconds": 0,
                "response_seconds": 30,
                "part_code": "Speaking 1",
            },
            {
                "prompt": "Tell me about a place in your city that you enjoy visiting.",
                "question_type": "speaking_prompt",
                "points": 1,
                "difficulty": "medium",
                "turn_type": "topic_question",
                "preparation_seconds": 0,
                "response_seconds": 45,
                "part_code": "Speaking 1",
            },
            {
                "prompt": "Read the given text aloud: The training centre opens early during exam week so learners can revise before class.",
                "question_type": "speaking_prompt",
                "points": 1,
                "difficulty": "medium",
                "turn_type": "read_aloud",
                "preparation_seconds": 20,
                "response_seconds": 90,
                "part_code": "Speaking 3",
            },
            {
                "prompt": "Give a short presentation about a skill you would like to improve and explain why it matters to you.",
                "question_type": "speaking_prompt",
                "points": 1,
                "difficulty": "medium",
                "turn_type": "presentation",
                "preparation_seconds": 60,
                "response_seconds": 120,
                "part_code": "Speaking 4",
            },
        ],
        "full-mock-upload-map.csv": [
            {
                "prompt": "Full Mock Listening sample: What time does the workshop begin?",
                "question_type": "mcq_single",
                "option_a": "9:00",
                "option_b": "9:30",
                "option_c": "10:00",
                "option_d": "10:30",
                "correct_answer": "B",
                "points": 1,
                "difficulty": "medium",
                "group_label": "Workshop booking",
                "part_code": "Listening 1",
            },
            {
                "prompt": "Full Mock Reading sample: Why was the timetable changed?",
                "question_type": "mcq_single",
                "option_a": "Transport delays",
                "option_b": "Room repairs",
                "option_c": "Staff training",
                "option_d": "A public holiday",
                "correct_answer": "A",
                "points": 1,
                "difficulty": "medium",
                "passage": "The timetable was changed after several students reported transport delays.",
                "part_code": "Reading 1A",
            },
            {
                "prompt": "Full Mock Writing sample: Summarise the chart showing online learning hours for three departments.",
                "question_type": "essay",
                "points": 32,
                "difficulty": "medium",
                "instructions": "Write 150-200 words.",
                "passage": "Department A: April 120, May 145, June 160. Department B: April 90, May 110, June 150. Department C: April 140, May 130, June 125.",
                "part_code": "Writing 1",
            },
            {
                "prompt": "Full Mock Speaking sample: Tell me about a place in your city that you enjoy visiting.",
                "question_type": "speaking_prompt",
                "points": 1,
                "difficulty": "medium",
                "turn_type": "topic_question",
                "preparation_seconds": 0,
                "response_seconds": 45,
                "part_code": "Speaking 1",
            },
        ],
        "final-test-template.csv": [
            {
                "prompt": "Final Test Listening sample: Which document should students bring?",
                "question_type": "mcq_single",
                "option_a": "Passport",
                "option_b": "Course invoice",
                "option_c": "Medical form",
                "option_d": "Library card",
                "correct_answer": "A",
                "points": 1,
                "difficulty": "medium",
                "group_label": "Orientation phone call",
                "part_code": "Listening 1",
            },
            {
                "prompt": "Final Test Reading sample: The word 'survey' is closest in meaning to:",
                "question_type": "mcq_single",
                "option_a": "invoice",
                "option_b": "questionnaire",
                "option_c": "timetable",
                "option_d": "announcement",
                "correct_answer": "B",
                "points": 1,
                "difficulty": "easy",
                "passage": "The library survey showed that most learners needed quiet study space after weekday classes.",
                "part_code": "Reading 1A",
            },
            {
                "prompt": "Final Test Writing sample: Discuss whether students learn better in groups or through individual study.",
                "question_type": "essay",
                "points": 32,
                "difficulty": "medium",
                "instructions": "Write 250-300 words.",
                "part_code": "Writing 2",
            },
            {
                "prompt": "Final Test Speaking sample: Give a short presentation about a skill you would like to improve.",
                "question_type": "speaking_prompt",
                "points": 1,
                "difficulty": "medium",
                "turn_type": "presentation",
                "preparation_seconds": 60,
                "response_seconds": 120,
                "part_code": "Speaking 4",
            },
        ],
    }


PDF_SECTIONS = {
    "reading-sample-upload.pdf": [
        {
            "part": "Reading 1A",
            "passage": "The library survey showed that most learners needed quiet study space after weekday classes. In response, the library opened two extra hours on Saturdays.",
            "questions": [
                {
                    "number": 1,
                    "prompt": "What is the main reason the library extended weekend opening hours?",
                    "options": [
                        ("A", "Students requested more study time"),
                        ("B", "The building needed repairs"),
                        ("C", "Staff wanted shorter shifts"),
                        ("D", "The cafe changed ownership"),
                    ],
                    "answer": "A",
                },
                {
                    "number": 2,
                    "prompt": "The word 'survey' is closest in meaning to:",
                    "options": [
                        ("A", "invoice"),
                        ("B", "questionnaire"),
                        ("C", "timetable"),
                        ("D", "announcement"),
                    ],
                    "answer": "B",
                },
            ],
        }
    ],
    "listening-sample-upload.pdf": [
        {
            "part": "Listening 1",
            "passage": "Use this PDF for question text. Upload real MP3 audio separately in the Listening part editor.",
            "questions": [
                {
                    "number": 1,
                    "prompt": "Where will the orientation session take place?",
                    "options": [("A", "Lecture Hall A"), ("B", "The main library"), ("C", "Student Services"), ("D", "Room 204")],
                    "answer": "D",
                },
                {
                    "number": 2,
                    "prompt": "Which document should students bring?",
                    "options": [("A", "Passport"), ("B", "Course invoice"), ("C", "Medical form"), ("D", "Library card")],
                    "answer": "A",
                },
            ],
        }
    ],
    "full-module-mcq-sample-upload.pdf": [
        {
            "part": "Listening 1",
            "passage": "Audio must be uploaded separately. This section demonstrates questions for a Listening part.",
            "questions": [
                {
                    "number": 1,
                    "prompt": "What time does the workshop begin?",
                    "options": [("A", "9:00"), ("B", "9:30"), ("C", "10:00"), ("D", "10:30")],
                    "answer": "B",
                }
            ],
        },
        {
            "part": "Reading 1A",
            "passage": "Short reading passage for a combined import example. The timetable was changed after several students reported transport delays.",
            "questions": [
                {
                    "number": 2,
                    "prompt": "Why was the timetable changed?",
                    "options": [("A", "Transport delays"), ("B", "Room repairs"), ("C", "Staff training"), ("D", "A public holiday")],
                    "answer": "A",
                }
            ],
        },
    ],
}


DEFAULT_PART_HEADINGS: dict[str, str] = {
    "reading_1a": "Read each sentence. Choose the word that can best replace the bold word without changing the meaning.",
    "reading_1b": "Read the text and choose the correct word for each gap.",
    "reading_2": "Read the text. Six sentences have been removed. Choose the sentence that best fits each gap. One sentence is a distractor.",
    "reading_3": "Read texts A–D. For questions 18–24, decide which text answers the question.",
    "reading_4": "Read the text and choose the correct answer for each question.",
    "listening_1": "You will hear some short conversations. You will hear each conversation twice. Choose the correct answer to complete each conversation.",
    "listening_2": "You will hear five conversations. Listen to the conversations and answer the questions. Choose the correct answer. You will hear each conversation twice.",
    "listening_3": "You will hear a recording. You will hear the recording twice. Complete the notes with NO MORE THAN THREE WORDS for each gap.",
    "listening_4": "You will hear a discussion. You will hear the discussion twice. Choose the correct answer for each question.",
}

PART_ORDER: dict[str, int] = {
    "listening_1": 1,
    "listening_2": 2,
    "listening_3": 3,
    "listening_4": 4,
    "reading_1a": 5,
    "reading_1b": 6,
    "reading_2": 7,
    "reading_3": 8,
    "reading_4": 9,
    "writing_1": 10,
    "writing_2": 11,
    "speaking_1": 12,
    "speaking_2": 13,
    "speaking_3": 14,
    "speaking_4": 15,
}


def _read_csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def _part_from_fixture_path(path: Path) -> str:
    stem = path.stem.lower()
    if stem.startswith("reading_1a"):
        return "Reading 1A"
    if stem.startswith("reading_1b"):
        return "Reading 1B"
    return path.stem.replace("_", " ").title()


def _fixture_sort_key(path: Path) -> int:
    stem = path.stem.lower()
    return PART_ORDER.get(stem, 99)


def _normalize_upload_row(row: dict[str, str], part_code: str) -> dict[str, object]:
    normalized = {column: (row.get(column) or "").strip() for column in CSV_COLUMNS}
    normalized["question_type"] = normalized["question_type"] or (row.get("type") or "").strip()
    normalized["correct_answer"] = normalized["correct_answer"] or (row.get("answer") or "").strip()
    normalized["part_code"] = part_code
    normalized["difficulty"] = normalized["difficulty"] or "medium"
    normalized["points"] = normalized["points"] or 1
    return normalized


def _fixture_full_rows(folder: str) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    files = sorted((FIXTURE_ROOT / folder).glob("*.csv"), key=_fixture_sort_key)
    for path in files:
        if "full" in path.name.lower() or "combined" in path.name.lower():
            continue
        part_code = _part_from_fixture_path(path)
        rows.extend(_normalize_upload_row(row, part_code) for row in _read_csv_rows(path))
    return rows


def _mapped_full_rows(map_name: str) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for item in _read_csv_rows(FIXTURE_ROOT / map_name / "upload-map.csv"):
        source = (FIXTURE_ROOT / map_name / item["file"]).resolve()
        rows.extend(_normalize_upload_row(row, item["part"]) for row in _read_csv_rows(source))
    return rows


def full_csv_rows() -> dict[str, list[dict[str, object]]]:
    return {
        "reading-full-module-upload.csv": _fixture_full_rows("reading"),
        "listening-full-module-upload.csv": _fixture_full_rows("listening"),
        "writing-full-module-upload.csv": _fixture_full_rows("writing"),
        "speaking-full-module-upload.csv": _fixture_full_rows("speaking"),
        "full-mock-full-module-upload.csv": _mapped_full_rows("full-mock"),
        "final-test-full-module-upload.csv": _mapped_full_rows("final-test"),
    }


def _fixture_part_sections(folder: str) -> list[dict[str, object]]:
    sections: list[dict[str, object]] = []
    files = sorted((FIXTURE_ROOT / folder).glob("*.csv"), key=_fixture_sort_key)
    for path in files:
        if "full" in path.name.lower() or "combined" in path.name.lower():
            continue
        part = _part_from_fixture_path(path)
        norm_part = path.stem.lower()
        rows = _read_csv_rows(path)
        questions = []
        for row in rows:
            options = [
                (letter.upper(), (row.get(f"option_{letter}") or "").strip())
                for letter in "abcdefghijklmnopqrstuvwxyz"
                if (row.get(f"option_{letter}") or "").strip()
            ]
            questions.append(
                {
                    "prompt": (row.get("prompt") or "").strip(),
                    "options": options,
                    "answer": (row.get("correct_answer") or row.get("answer") or "").strip(),
                    "type": (row.get("question_type") or "").strip(),
                    "instructions": (row.get("instructions") or "").strip(),
                    "passage": (row.get("passage") or "").strip(),
                    "turn_type": (row.get("turn_type") or "").strip(),
                    "preparation_seconds": (row.get("preparation_seconds") or "").strip(),
                    "response_seconds": (row.get("response_seconds") or "").strip(),
                }
            )
        heading = DEFAULT_PART_HEADINGS.get(norm_part) or next((q["instructions"] for q in questions if q["instructions"]), "")
        passage = next((q["passage"] for q in questions if q["passage"]), "")
        sections.append(
            {
                "part": part,
                "heading": heading,
                "passage": passage,
                "questions": questions,
            }
        )
    return sections


def _mapped_sections(map_name: str) -> list[dict[str, object]]:
    sections: list[dict[str, object]] = []
    for item in _read_csv_rows(FIXTURE_ROOT / map_name / "upload-map.csv"):
        source = (FIXTURE_ROOT / map_name / item["file"]).resolve()
        rows = _read_csv_rows(source)
        questions = []
        for row in rows:
            options = [
                (letter.upper(), (row.get(f"option_{letter}") or "").strip())
                for letter in "abcdefghijklmnopqrstuvwxyz"
                if (row.get(f"option_{letter}") or "").strip()
            ]
            questions.append(
                {
                    "prompt": (row.get("prompt") or "").strip(),
                    "options": options,
                    "answer": (row.get("correct_answer") or row.get("answer") or "").strip(),
                    "type": (row.get("question_type") or "").strip(),
                    "instructions": (row.get("instructions") or "").strip(),
                    "passage": (row.get("passage") or "").strip(),
                    "turn_type": (row.get("turn_type") or "").strip(),
                    "preparation_seconds": (row.get("preparation_seconds") or "").strip(),
                    "response_seconds": (row.get("response_seconds") or "").strip(),
                }
            )
        part = item["part"]
        norm_part = part.lower().replace("-", "_").replace(" ", "_")
        heading = DEFAULT_PART_HEADINGS.get(norm_part) or next((q["instructions"] for q in questions if q["instructions"]), "")
        passage = next((q["passage"] for q in questions if q["passage"]), "")
        sections.append(
            {
                "part": part,
                "section": item["section"],
                "heading": heading,
                "passage": passage,
                "questions": questions,
            }
        )
    return sections


def full_pdf_sections() -> dict[str, list[dict[str, object]]]:
    return {
        "reading-full-module-upload.pdf": _fixture_part_sections("reading"),
        "listening-full-module-upload.pdf": _fixture_part_sections("listening"),
        "writing-full-module-upload.pdf": _fixture_part_sections("writing"),
        "speaking-full-module-upload.pdf": _fixture_part_sections("speaking"),
        "full-mock-full-module-upload.pdf": _mapped_sections("full-mock"),
        "final-test-full-module-upload.pdf": _mapped_sections("final-test"),
    }


def build_pdf(path: Path, title: str, sections: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TemplateTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#b80f28"),
        spaceAfter=8,
    )
    heading_style = ParagraphStyle(
        "TemplateHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#111113"),
        spaceBefore=10,
        spaceAfter=5,
    )
    body_style = ParagraphStyle(
        "TemplateBody",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#222226"),
        spaceAfter=5,
    )
    small_style = ParagraphStyle(
        "TemplateSmall",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#52525b"),
        spaceAfter=6,
    )
    story = [
        Paragraph(title, title_style),
        Paragraph("Visa House LMS module upload sample. Text is selectable and follows the current PDF parser format.", small_style),
        Spacer(1, 4 * mm),
    ]
    answers: list[tuple[int, str]] = []
    question_number = 1
    for section in sections:
        story.append(Paragraph(f"Part: {section['part']}", heading_style))
        if section.get("heading"):
            story.append(Paragraph(str(section["heading"]), body_style))
        if section.get("passage"):
            story.append(Paragraph("Reading Passage:", body_style))
            escaped_passage = str(section["passage"]).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>")
            story.append(Paragraph(escaped_passage, body_style))
        for question in section["questions"]:
            number = int(question.get("number") or question_number)
            question_number = max(question_number + 1, number + 1)
            raw_prompt = str(question.get("prompt") or "")
            escaped_prompt = raw_prompt.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            formatted_prompt = re.sub(r"\*\*(.+?)\*\*", r"<b>**\1**</b>", escaped_prompt)
            story.append(Paragraph(f"{number}. {formatted_prompt}", body_style))
            for key, text in question.get("options", []):
                opt_text = str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                story.append(Paragraph(f"{key}. {opt_text}", body_style))
            answer = str(question.get("answer") or "").strip()
            if answer:
                ans_text = str(answer).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                story.append(Paragraph(f"Answer: {ans_text}", small_style))
                answers.append((number, answer))
            story.append(Spacer(1, 1 * mm))
    if answers:
        story.append(Spacer(1, 6 * mm))
        story.append(Paragraph("Answer Key", heading_style))
        for number, answer in answers:
            ans_text = str(answer).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            story.append(Paragraph(f"{number}. {ans_text}", body_style))
    doc = SimpleDocTemplate(
        str(path),
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=title,
        author="Visa House LMS",
    )
    doc.build(story)


def write_readme() -> None:
    (ROOT / "README.md").write_text(
        """# Module upload templates

Reusable CSV and PDF samples for creating Visa House LMS modules.

## Use these first

- CSV is the preferred format for real module creation because it preserves `question_type`, part mapping, points, difficulty, passage text, and Speaking timing fields.
- PDF upload is best for selectable-text MCQ style imports. After uploading a PDF, always review detected question types, answers, and part assignment before saving.
- Listening audio is not embedded in question PDFs. Upload the MP3 separately in the Listening part editor.
- Writing and Speaking PDFs are full content references. Use their CSV templates for real uploads because CSV preserves essay type, speaking turn type, preparation seconds, and response seconds.
- Full Mock and Final Test PDFs include every section's content. Their objective Listening/Reading questions extract cleanly; use the matching CSV files when you need Writing/Speaking metadata to import exactly.

## CSV templates

| File | Use |
|---|---|
| `csv/reading-template.csv` | Reading question rows with passage and part code. |
| `csv/listening-template.csv` | Listening question rows. Pair with a real MP3 upload. |
| `csv/writing-template.csv` | Writing 1 and Writing 2 essay prompts. |
| `csv/speaking-template.csv` | Speaking prompts with `turn_type`, preparation seconds, and response seconds. |
| `csv/full-mock-upload-map.csv` | Combined sample upload rows for a Full Mock module. |
| `csv/final-test-template.csv` | Combined sample upload rows for a Final Test module. |
| `csv/reading-full-module-upload.csv` | Full Reading module CSV generated from all Reading fixture parts. |
| `csv/listening-full-module-upload.csv` | Full Listening module CSV generated from all Listening fixture parts. |
| `csv/writing-full-module-upload.csv` | Full Writing module CSV generated from all Writing fixture parts. |
| `csv/speaking-full-module-upload.csv` | Full Speaking module CSV generated from all Speaking fixture parts. |
| `csv/full-mock-full-module-upload.csv` | Full Mock CSV generated from every mapped part. |
| `csv/final-test-full-module-upload.csv` | Final Test CSV generated from every mapped part. |

## PDF samples

| File | Use |
|---|---|
| `pdf/reading-sample-upload.pdf` | Reading MCQ PDF import sample with a passage and answer key. |
| `pdf/listening-sample-upload.pdf` | Listening MCQ PDF import sample. Add audio separately. |
| `pdf/full-module-mcq-sample-upload.pdf` | Combined section PDF sample showing `Part:` headers for sorting. |
| `pdf/reading-full-module-upload.pdf` | Full Reading module PDF generated from all Reading fixture parts. |
| `pdf/listening-full-module-upload.pdf` | Full Listening module PDF generated from all Listening fixture parts. |
| `pdf/writing-full-module-upload.pdf` | Full Writing module PDF with both essay tasks. Prefer CSV upload for exact essay metadata. |
| `pdf/speaking-full-module-upload.pdf` | Full Speaking module PDF with all prompt content. Prefer CSV upload for timing metadata. |
| `pdf/full-mock-full-module-upload.pdf` | Full Mock PDF generated from every mapped Listening, Reading, Writing, and Speaking part. |
| `pdf/final-test-full-module-upload.pdf` | Final Test PDF generated from every mapped Listening, Reading, Writing, and Speaking part. |

## Accepted CSV columns

`prompt`, `question_type`, `option_a`, `option_b`, `option_c`, `option_d`, `option_e` through `option_z`, `correct_answer`, `points`, `difficulty`, `instructions`, `passage`, `group_label`, `turn_type`, `preparation_seconds`, `response_seconds`, `adaptive_follow_up`, `part_code`

Common `question_type` values: `mcq_single`, `mcq_multiple`, `true_false_not_given`, `yes_no_not_given`, `short_answer`, `fill_blank`, `matching_unique`, `matching_reusable`, `essay`, `speaking_prompt`.

## PDF parser format

Use this structure for PDF question imports:

```text
Part: Reading 1A
Reading Passage:
Paste selectable passage text here.

1. Question text here?
A. First option
B. Second option
C. Third option
D. Fourth option

Answer Key
1. A
```

Keep PDFs selectable, not scanned images. Scanned PDFs need OCR before upload.
""",
        encoding="utf-8",
    )


def main() -> None:
    CSV_DIR.mkdir(parents=True, exist_ok=True)
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    (FIXTURE_ROOT / "pdf").mkdir(parents=True, exist_ok=True)
    for filename, rows in csv_rows().items():
        write_csv(CSV_DIR / filename, rows)
    for filename, rows in full_csv_rows().items():
        write_csv(CSV_DIR / filename, rows)
    for filename, sections in PDF_SECTIONS.items():
        title = filename.replace("-", " ").replace(".pdf", "").title()
        build_pdf(PDF_DIR / filename, title, sections)
    for filename, sections in full_pdf_sections().items():
        title = filename.replace("-", " ").replace(".pdf", "").title()
        build_pdf(PDF_DIR / filename, title, sections)
        if filename == "reading-full-module-upload.pdf":
            build_pdf(FIXTURE_ROOT / "pdf" / "full-reading-bulk-upload.pdf", "Full Reading Bulk Upload", sections)
        elif filename == "listening-full-module-upload.pdf":
            build_pdf(FIXTURE_ROOT / "pdf" / "full-listening-bulk-upload.pdf", "Full Listening Bulk Upload", sections)
        elif filename == "writing-full-module-upload.pdf":
            build_pdf(FIXTURE_ROOT / "pdf" / "full-writing-bulk-upload.pdf", "Full Writing Bulk Upload", sections)
        elif filename == "speaking-full-module-upload.pdf":
            build_pdf(FIXTURE_ROOT / "pdf" / "full-speaking-bulk-upload.pdf", "Full Speaking Bulk Upload", sections)
    write_readme()


if __name__ == "__main__":
    main()
