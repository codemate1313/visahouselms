import csv
import io
import re
from typing import Optional

from fastapi import HTTPException, UploadFile, status
from pypdf import PdfReader


MAX_PDF_BYTES = 15 * 1024 * 1024
MAX_CSV_BYTES = 5 * 1024 * 1024
MAX_EXTRACTED_TEXT = 250_000
MAX_IMPORT_QUESTIONS = 500

QUESTION_RE = re.compile(r"^(?:q(?:uestion)?\s*)?(\d{1,4})\s*[.)\-:]\s*(.+)$", re.IGNORECASE)
OPTION_RE = re.compile(r"^\(?([A-Z])\)?\s*[.)\-:]\s*(.+)$", re.IGNORECASE)
ANSWER_RE = re.compile(r"^(?:correct\s+)?answer(?:s)?\s*[:\-]\s*(.+)$", re.IGNORECASE)
EXPLANATION_RE = re.compile(r"^(?:explanation|rationale)\s*[:\-]\s*(.+)$", re.IGNORECASE)
ANSWER_KEY_HEADER_RE = re.compile(r"^(?:answers?|answer\s+key)\s*:?$", re.IGNORECASE)
ANSWER_KEY_ENTRY_RE = re.compile(
    r"^(\d{1,4})\s*[.)\-:]?\s*(?:answer\s*[:\-]\s*)?([A-Z](?:\s*(?:,|;|/|&|\band\b)\s*[A-Z])*)$",
    re.IGNORECASE,
)


def _clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _split_answers(value: object) -> list[str]:
    text = _clean(value).upper()
    if not text:
        return []
    text = re.sub(r"^(?:OPTION|ANSWER)\s+", "", text)
    parts = re.split(r"\s*(?:,|;|\||/|\band\b)\s*", text)
    return list(dict.fromkeys(part.strip(" ().") for part in parts if part.strip(" ().")))


def _infer_type(options: list[dict], answers: list[str], supplied: str = "") -> str:
    aliases = {
        "mcq": "mcq_single",
        "multiple_choice": "mcq_single",
        "multiple choice": "mcq_single",
        "single_choice": "mcq_single",
        "multi_select": "mcq_multiple",
        "multiple_answers": "mcq_multiple",
        "true_false": "true_false_not_given",
        "true false not given": "true_false_not_given",
        "yes no not given": "yes_no_not_given",
        "short answer": "short_answer",
        "fill in the blank": "fill_blank",
        "writing": "essay",
        "speaking": "speaking_prompt",
    }
    normalized = _clean(supplied).lower().replace("-", "_")
    if normalized in aliases:
        return aliases[normalized]
    valid = {
        "mcq_single", "mcq_multiple", "true_false_not_given", "yes_no_not_given",
        "short_answer", "fill_blank", "essay", "speaking_prompt",
    }
    if normalized in valid:
        return normalized
    option_values = {_clean(option.get("text")).lower() for option in options}
    if {"true", "false"}.issubset(option_values):
        return "true_false_not_given"
    if {"yes", "no"}.issubset(option_values):
        return "yes_no_not_given"
    if options:
        return "mcq_multiple" if len(answers) > 1 else "mcq_single"
    return "short_answer"


def _question_preview(
    *,
    prompt: str,
    options: list[dict],
    correct_answers: list[str],
    question_type: str = "",
    instructions: str = "",
    passage: str = "",
    explanation: str = "",
    points: object = 1,
    difficulty: str = "medium",
) -> dict:
    normalized_options = []
    for index, option in enumerate(options):
        key = _clean(option.get("key")).upper() or chr(65 + index)
        text = _clean(option.get("text"))
        if text:
            normalized_options.append({"key": key, "text": text})

    answers = _split_answers("|".join(correct_answers))
    option_keys = {option["key"] for option in normalized_options}
    option_text_to_key = {option["text"].upper(): option["key"] for option in normalized_options}
    answers = [option_text_to_key.get(answer, answer) for answer in answers]
    kind = _infer_type(normalized_options, answers, question_type)

    warnings: list[str] = []
    if not _clean(prompt):
        warnings.append("Question text is missing")
    if kind.startswith("mcq_") and len(normalized_options) < 2:
        warnings.append("At least two choices are required")
    needs_answer = kind not in {"essay", "speaking_prompt"}
    if needs_answer and not answers:
        warnings.append("Correct answer was not detected")
    if normalized_options and any(answer not in option_keys for answer in answers):
        warnings.append("A detected answer does not match an option key")
    try:
        numeric_points = float(points or 1)
        if numeric_points <= 0:
            raise ValueError
    except (TypeError, ValueError):
        numeric_points = 1
        warnings.append("Invalid points value was replaced with 1")
    difficulty = _clean(difficulty).lower()
    if difficulty not in {"easy", "medium", "hard"}:
        difficulty = "medium"
        warnings.append("Invalid difficulty was replaced with medium")

    return {
        "question_type": kind,
        "prompt": _clean(prompt),
        "instructions": _clean(instructions) or None,
        "passage": str(passage or "").strip() or None,
        "options": normalized_options,
        "correct_answers": answers,
        "explanation": _clean(explanation) or None,
        "points": numeric_points,
        "difficulty": difficulty,
        "warnings": warnings,
    }


def parse_csv(content: bytes) -> tuple[str, list[dict], list[str]]:
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV must be UTF-8 encoded",
        ) from exc

    try:
        dialect = csv.Sniffer().sniff(decoded[:4096], delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(decoded), dialect=dialect)
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV header row is missing")

    def normalized_row(row: dict) -> dict[str, str]:
        return {
            re.sub(r"[^a-z0-9]+", "_", str(key or "").strip().lower()).strip("_"): _clean(value)
            for key, value in row.items()
        }

    questions: list[dict] = []
    warnings: list[str] = []
    for row_number, raw_row in enumerate(reader, start=2):
        row = normalized_row(raw_row)
        prompt = row.get("prompt") or row.get("question") or row.get("question_text") or ""
        if not prompt and not any(row.values()):
            continue
        options = []
        for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
            value = row.get(f"option_{letter.lower()}") or row.get(f"choice_{letter.lower()}")
            if value:
                options.append({"key": letter, "text": value})
        if not options and row.get("options"):
            for index, value in enumerate(re.split(r"\s*\|\s*", row["options"])):
                value = OPTION_RE.sub(r"\2", value).strip()
                if value:
                    options.append({"key": chr(65 + index), "text": value})
        answer = row.get("correct_answer") or row.get("correct_answers") or row.get("answer") or ""
        preview = _question_preview(
            prompt=prompt,
            options=options,
            correct_answers=_split_answers(answer),
            question_type=row.get("question_type") or row.get("type") or "",
            instructions=row.get("instructions") or "",
            passage=row.get("passage") or row.get("context") or "",
            explanation=row.get("explanation") or row.get("rationale") or "",
            points=row.get("points") or 1,
            difficulty=row.get("difficulty") or "medium",
        )
        if preview["warnings"]:
            warnings.append(f"Row {row_number}: {'; '.join(preview['warnings'])}")
        questions.append(preview)
        if len(questions) >= MAX_IMPORT_QUESTIONS:
            warnings.append(f"Only the first {MAX_IMPORT_QUESTIONS} questions were extracted")
            break

    if not questions:
        raise HTTPException(status_code=400, detail="No question rows were found in the CSV")
    return decoded[:MAX_EXTRACTED_TEXT], questions, warnings


def parse_pdf(content: bytes) -> tuple[str, list[dict], list[str]]:
    try:
        reader = PdfReader(io.BytesIO(content))
        pages = [(page.extract_text() or "").strip() for page in reader.pages]
    except Exception as exc:
        raise HTTPException(status_code=400, detail="PDF text could not be extracted") from exc
    text = "\n\n".join(page for page in pages if page)
    if not text:
        raise HTTPException(
            status_code=400,
            detail="No selectable text was found. Scanned PDFs need OCR before import.",
        )

    lines = [_clean(raw_line) for raw_line in text.splitlines() if _clean(raw_line)]
    answer_map: dict[int, list[str]] = {}
    content_lines = lines
    for index, line in enumerate(lines):
        if ANSWER_KEY_HEADER_RE.match(line):
            content_lines = lines[:index]
            for answer_line in lines[index + 1:]:
                match = ANSWER_KEY_ENTRY_RE.match(answer_line)
                if match:
                    answer_map[int(match.group(1))] = _split_answers(match.group(2))
            break

    questions: list[dict] = []
    warnings: list[str] = []
    current: Optional[dict] = None
    mode = "prompt"

    def finish() -> None:
        nonlocal current
        if not current:
            return
        preview = _question_preview(
            prompt=" ".join(current["prompt"]),
            options=current["options"],
            correct_answers=current["answers"] or answer_map.get(current["number"], []),
            explanation=" ".join(current["explanation"]),
        )
        if preview["warnings"]:
            warnings.append(
                f"Question {len(questions) + 1}: {'; '.join(preview['warnings'])}"
            )
        questions.append(preview)
        current = None

    for line in content_lines:
        question_match = QUESTION_RE.match(line)
        option_match = OPTION_RE.match(line)
        answer_match = ANSWER_RE.match(line)
        explanation_match = EXPLANATION_RE.match(line)
        if question_match:
            finish()
            current = {"number": int(question_match.group(1)), "prompt": [question_match.group(2)], "options": [], "answers": [], "explanation": []}
            mode = "prompt"
        elif current and answer_match:
            current["answers"] = _split_answers(answer_match.group(1))
            mode = "answer"
        elif current and explanation_match:
            current["explanation"].append(explanation_match.group(1))
            mode = "explanation"
        elif current and option_match:
            current["options"].append(
                {"key": option_match.group(1).upper(), "text": option_match.group(2)}
            )
            mode = "option"
        elif current and mode == "option" and current["options"]:
            current["options"][-1]["text"] += f" {line}"
        elif current and mode == "explanation":
            current["explanation"].append(line)
        elif current and mode != "answer":
            current["prompt"].append(line)
    finish()

    if not questions:
        raise HTTPException(
            status_code=400,
            detail="No numbered questions were detected. Use formats such as '1. Question' and 'A. Choice'.",
        )
    if len(questions) > MAX_IMPORT_QUESTIONS:
        questions = questions[:MAX_IMPORT_QUESTIONS]
        warnings.append(f"Only the first {MAX_IMPORT_QUESTIONS} questions were extracted")
    return text[:MAX_EXTRACTED_TEXT], questions, warnings


async def preview_upload(upload: UploadFile) -> dict:
    filename = (upload.filename or "questions").strip()
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension not in {"pdf", "csv"}:
        raise HTTPException(status_code=400, detail="Question imports must be PDF or CSV files")
    content = await upload.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    limit = MAX_PDF_BYTES if extension == "pdf" else MAX_CSV_BYTES
    if len(content) > limit:
        raise HTTPException(status_code=400, detail=f"{extension.upper()} must be {limit // 1024 // 1024} MB or smaller")
    if extension == "pdf" and not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="File is not a valid PDF")
    if extension == "csv" and b"\x00" in content[:4096]:
        raise HTTPException(status_code=400, detail="File is not a valid text CSV")

    source_text, questions, warnings = parse_pdf(content) if extension == "pdf" else parse_csv(content)
    return {
        "source_type": extension,
        "source_filename": filename[:255],
        "source_text": source_text,
        "questions": questions,
        "question_count": len(questions),
        "warning_count": len(warnings),
        "warnings": warnings,
    }
