# Module upload templates

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
