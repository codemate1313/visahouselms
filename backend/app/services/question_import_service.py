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

QUESTION_RE = re.compile(r"^(?:q(?:uestion)?\s*)?(\d{1,4})\s*[.)\-:]\s*(.*)$", re.IGNORECASE)
OPTION_RE = re.compile(r"^\(?([A-Z])\)?\s*[.)\-:]\s*(.+)$", re.IGNORECASE)
ANSWER_RE = re.compile(r"^(?:correct\s+)?answer(?:s)?\s*[:\-]\s*(.+)$", re.IGNORECASE)
EXPLANATION_RE = re.compile(r"^(?:explanation|rationale)\s*[:\-]\s*(.+)$", re.IGNORECASE)
PART_HEADER_RE = re.compile(r"^(?:part|section)\s*[:\-]\s*(.+)$", re.IGNORECASE)
ANSWER_KEY_HEADER_RE = re.compile(r"^(?:answers?|answer\s+key)\s*:?$", re.IGNORECASE)
ANSWER_KEY_ENTRY_RE = re.compile(
    r"^(\d{1,4})\s*[.)\-:]?\s*(?:answer\s*[:\-]\s*)?([A-Z](?:\s*(?:,|;|/|&|\band\b)\s*[A-Z])*)$",
    re.IGNORECASE,
)


def _clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _clean_multiline(value: object) -> str:
    """Like _clean, but keeps line breaks - a shared passage (or a notepad's
    heading-then-gapped-paragraph text) depends on them to tell its lines
    apart; collapsing to one line loses the heading and runs every gap
    together."""
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in str(value or "").splitlines()]
    return "\n".join(lines).strip()


def _split_answers(value: object) -> list[str]:
    text = _clean(value).upper()
    if not text:
        return []
    text = re.sub(r"^(?:OPTION|ANSWER)\s+", "", text)
    parts = re.split(r"\s*(?:,|;|\||/|\band\b)\s*", text)
    return list(dict.fromkeys(part.strip(" ().") for part in parts if part.strip(" ().")))


def _infer_type(
    options: list[dict],
    answers: list[str],
    supplied: str = "",
    target_part: str = "",
) -> str:
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
        "matching once": "matching_unique",
        "matching unique": "matching_unique",
        "matching reusable": "matching_reusable",
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
        "short_answer", "fill_blank", "matching_unique", "matching_reusable",
        "essay", "speaking_prompt",
    }
    if normalized in valid:
        return normalized
    part_lower = _clean(target_part).lower()
    if "writing" in part_lower:
        return "essay"
    if "speaking" in part_lower:
        return "speaking_prompt"
    option_values = {_clean(option.get("text")).lower() for option in options}
    if {"true", "false"}.issubset(option_values):
        return "true_false_not_given"
    if {"yes", "no"}.issubset(option_values):
        return "yes_no_not_given"
    if options:
        return "mcq_multiple" if len(answers) > 1 else "mcq_single"
    return "short_answer"


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


def _question_preview(
    *,
    prompt: str,
    options: list[dict],
    correct_answers: list[str],
    question_type: str = "",
    instructions: str = "",
    part_heading: str = "",
    passage: str = "",
    explanation: str = "",
    points: object = 1,
    difficulty: str = "medium",
    group_label: str = "",
    turn_type: str = "",
    preparation_seconds: object = None,
    response_seconds: object = None,
    adaptive_follow_up: object = False,
    target_part: str = "",
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
    kind = _infer_type(normalized_options, answers, question_type, target_part=target_part)

    warnings: list[str] = []
    is_l1 = bool(
        target_part
        and (
            "listening_1" in target_part.lower()
            or "listening 1" in target_part.lower()
            or (target_part.lower().endswith("_1") and "listen" in target_part.lower())
        )
    )
    part_clean_lower = _clean(target_part).lower().replace(" ", "_")
    is_cloze_gap = "reading_1b" in part_clean_lower or "reading_2" in part_clean_lower
    if not _clean(prompt):
        if is_l1:
            prompt = "Question"
        elif is_cloze_gap:
            prompt = "Gap"
        else:
            warnings.append("Question text is missing")
    if kind in {"mcq_single", "mcq_multiple", "matching_unique", "matching_reusable"} and len(normalized_options) < 2:
        warnings.append("At least two choices are required")
    part_lower = _clean(target_part).lower()
    is_subjective = kind in {"essay", "speaking_prompt"} or "writing" in part_lower or "speaking" in part_lower
    needs_answer = not is_subjective
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

    interaction: dict[str, object] = {}
    if _clean(group_label):
        interaction["group_label"] = _clean(group_label)
    if _clean(turn_type):
        interaction["turn_type"] = _clean(turn_type).lower().replace(" ", "_")
    for field, raw in (("preparation_seconds", preparation_seconds), ("response_seconds", response_seconds)):
        if _clean(raw):
            try:
                interaction[field] = int(str(raw))
            except ValueError:
                warnings.append(f"Invalid {field.replace('_', ' ')} value was ignored")
    interaction["adaptive_follow_up"] = str(adaptive_follow_up).strip().lower() in {"1", "true", "yes", "on"}

    result = {
        "question_type": kind,
        "prompt": _clean(prompt),
        "instructions": _clean(instructions) or None,
        "passage": str(passage or "").strip() or None,
        "options": normalized_options,
        "correct_answers": answers,
        "interaction": interaction,
        "explanation": _clean(explanation) or None,
        "points": numeric_points,
        "difficulty": difficulty,
        "warnings": warnings,
    }
    if _clean(part_heading):
        result["part_heading"] = _clean(part_heading)
    if _clean(target_part):
        result["target_part"] = _clean(target_part)
    return result


def parse_csv(
    content: bytes,
    default_target_part: str = "",
    default_section_type: str = "",
    filename: str = "",
) -> tuple[str, list[dict], list[str]]:
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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV header row is missing")

    def normalized_row(row: dict) -> dict[str, str]:
        result: dict[str, str] = {}
        for key, value in row.items():
            norm_key = re.sub(r"[^a-z0-9]+", "_", str(key or "").strip().lower()).strip("_")
            result[norm_key] = _clean_multiline(value) if norm_key in {"passage", "context"} else _clean(value)
        return result

    file_hint = filename.lower() if filename else ""
    detected_part = ""
    for known_part in (
        "listening_1", "listening_2", "listening_3", "listening_4",
        "reading_1a", "reading_1b", "reading_2", "reading_3", "reading_4",
        "writing_1", "writing_2", "speaking_1", "speaking_2", "speaking_3", "speaking_4",
    ):
        if known_part in file_hint or known_part.replace("_", "-") in file_hint or known_part.replace("_", " ") in file_hint:
            detected_part = known_part
            break

    fallback_part = default_target_part or detected_part or default_section_type

    questions: list[dict] = []
    warnings: list[str] = []
    for row_number, raw_row in enumerate(reader, start=2):
        row = normalized_row(raw_row)
        prompt = row.get("prompt") or row.get("question") or row.get("question_text") or ""
        target_part = (
            row.get("part_code")
            or row.get("part")
            or row.get("part_title")
            or row.get("module_part")
            or fallback_part
            or ""
        )
        row_heading = (
            row.get("part_heading")
            or row.get("heading")
            or row.get("part_instruction")
            or row.get("part_instructions")
            or row.get("instruction")
            or row.get("instructions")
            or ""
        )
        if not row_heading and target_part:
            norm_tp = target_part.lower().replace("-", "_").replace(" ", "_")
            if norm_tp in DEFAULT_PART_HEADINGS:
                row_heading = DEFAULT_PART_HEADINGS[norm_tp]
        is_l1 = bool(
            target_part
            and (
                "listening_1" in target_part.lower()
                or "listening 1" in target_part.lower()
                or (target_part.lower().endswith("_1") and "listen" in target_part.lower())
            )
        )
        part_norm = target_part.lower().replace(" ", "_")
        is_r1b = "reading_1b" in part_norm
        is_r2 = "reading_2" in part_norm
        if not prompt and is_l1:
            prompt = f"Question {len(questions) + 1}"
        elif not prompt and is_r1b:
            r1b_count = sum(1 for q in questions if "1b" in str(q.get("target_part", "")).lower())
            prompt = f"Choose the best option for gap ({r1b_count + 1})."
        elif not prompt and is_r2:
            r2_count = sum(1 for q in questions if "reading_2" in str(q.get("target_part", "")).lower().replace(" ", "_"))
            prompt = f"Choose the best option for gap {r2_count + 1}."
        elif not prompt and not any(row.values()):
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
            part_heading=row_heading,
            passage=row.get("passage") or row.get("context") or "",
            explanation=row.get("explanation") or row.get("rationale") or "",
            points=row.get("points") or 1,
            difficulty=row.get("difficulty") or "medium",
            group_label=row.get("group_label") or row.get("conversation") or "",
            turn_type=row.get("turn_type") or row.get("speaking_turn") or "",
            preparation_seconds=row.get("preparation_seconds"),
            response_seconds=row.get("response_seconds"),
            adaptive_follow_up=row.get("adaptive_follow_up") or False,
            target_part=target_part,
        )
        if preview["warnings"]:
            warnings.append(f"Row {row_number}: {'; '.join(preview['warnings'])}")
        questions.append(preview)
        if len(questions) >= MAX_IMPORT_QUESTIONS:
            warnings.append(f"Only the first {MAX_IMPORT_QUESTIONS} questions were extracted")
            break

    if not questions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No question rows were found in the CSV")
    return decoded[:MAX_EXTRACTED_TEXT], questions, warnings


def parse_pdf(
    content: bytes,
    default_target_part: str = "",
    default_section_type: str = "",
    filename: str = "",
) -> tuple[str, list[dict], list[str]]:
    try:
        reader = PdfReader(io.BytesIO(content))
        pages = [(page.extract_text() or "").strip() for page in reader.pages]
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PDF text could not be extracted") from exc
    text = "\n\n".join(page for page in pages if page)
    if not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
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

    file_hint = filename.lower() if filename else ""
    detected_part = ""
    for known_part in (
        "listening_1", "listening_2", "listening_3", "listening_4",
        "reading_1a", "reading_1b", "reading_2", "reading_3", "reading_4",
        "writing_1", "writing_2", "speaking_1", "speaking_2", "speaking_3", "speaking_4",
    ):
        if known_part in file_hint or known_part.replace("_", "-") in file_hint or known_part.replace("_", " ") in file_hint:
            detected_part = known_part
            break

    fallback_part = default_target_part or detected_part or default_section_type or ""
    questions: list[dict] = []
    warnings: list[str] = []
    current: Optional[dict] = None
    current_part = fallback_part
    norm_init_part = fallback_part.lower().replace("-", "_").replace(" ", "_")
    current_heading = DEFAULT_PART_HEADINGS.get(norm_init_part, "")
    current_passage = []
    mode = "prompt"

    def finish() -> None:
        nonlocal current
        if not current:
            return
        passage_text = "\n".join(current_passage).strip()
        norm_cp = (current.get("target_part") or current_part).lower().replace("-", "_").replace(" ", "_")
        part_head = current.get("part_heading") or current_heading or DEFAULT_PART_HEADINGS.get(norm_cp, "")
        preview = _question_preview(
            prompt=" ".join(current["prompt"]),
            options=current["options"],
            correct_answers=current["answers"] or answer_map.get(current["number"], []),
            explanation=" ".join(current["explanation"]),
            passage=passage_text or None,
            part_heading=part_head,
            target_part=current.get("target_part", "") or fallback_part,
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
        part_match = PART_HEADER_RE.match(line)
        if part_match:
            finish()
            current_part = part_match.group(1)
            norm_cp = current_part.lower().replace("-", "_").replace(" ", "_")
            current_heading = DEFAULT_PART_HEADINGS.get(norm_cp, "")
            current_passage = []
            mode = "prompt"
        elif not current and (
            line.lower().startswith("you will hear")
            or line.lower().startswith("read each")
            or line.lower().startswith("read the")
            or line.lower().startswith("read text")
            or line.lower().startswith("complete the notes")
        ):
            current_heading = line
        elif question_match:
            finish()
            norm_cp = current_part.lower().replace("-", "_").replace(" ", "_")
            current = {
                "number": int(question_match.group(1)),
                "prompt": [question_match.group(2)],
                "options": [],
                "answers": [],
                "explanation": [],
                "part_heading": current_heading or DEFAULT_PART_HEADINGS.get(norm_cp, ""),
                "target_part": current_part or fallback_part,
            }
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
        elif not current and current_part:
            clean_line = line.strip()
            if not re.match(r"^(?:reading\s+)?passage(?:\s+\d+)?\s*:?$", clean_line, re.IGNORECASE):
                current_passage.append(line)
    finish()

    if not questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No numbered questions were detected. Use formats such as '1. Question' and 'A. Choice'.",
        )
    if len(questions) > MAX_IMPORT_QUESTIONS:
        questions = questions[:MAX_IMPORT_QUESTIONS]
        warnings.append(f"Only the first {MAX_IMPORT_QUESTIONS} questions were extracted")
    return text[:MAX_EXTRACTED_TEXT], questions, warnings


async def preview_upload(
    upload: UploadFile,
    default_target_part: str = "",
    default_section_type: str = "",
) -> dict:
    filename = (upload.filename or "questions").strip()
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension not in {"pdf", "csv"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Question imports must be PDF or CSV files")
    content = await upload.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")
    limit = MAX_PDF_BYTES if extension == "pdf" else MAX_CSV_BYTES
    if len(content) > limit:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{extension.upper()} must be {limit // 1024 // 1024} MB or smaller")
    if extension == "pdf" and not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is not a valid PDF")
    if extension == "csv" and b"\x00" in content[:4096]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is not a valid text CSV")

    source_text, questions, warnings = (
        parse_pdf(
            content,
            default_target_part=default_target_part,
            default_section_type=default_section_type,
            filename=filename,
        )
        if extension == "pdf"
        else parse_csv(
            content,
            default_target_part=default_target_part,
            default_section_type=default_section_type,
            filename=filename,
        )
    )
    part_headings: dict[str, str] = {}
    for q in questions:
        tp = q.get("target_part") or ""
        ph = q.get("part_heading") or ""
        if tp and ph and tp not in part_headings:
            part_headings[tp] = ph
        elif tp and tp not in part_headings:
            norm_tp = tp.lower().replace("-", "_").replace(" ", "_")
            if norm_tp in DEFAULT_PART_HEADINGS:
                part_headings[tp] = DEFAULT_PART_HEADINGS[norm_tp]
    return {
        "source_type": extension,
        "source_filename": filename[:255],
        "source_text": source_text,
        "questions": questions,
        "question_count": len(questions),
        "part_headings": part_headings,
        "warning_count": len(warnings),
        "warnings": warnings,
    }
