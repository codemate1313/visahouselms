# Authoring a Reading module

How each of the five Reading parts works in this platform, what the system will
and won't accept, and exactly how blanks and matching are marked up.

Everything below is read from the code, not from the exam board's docs:
`services/module_blueprint_service.py` (the part rules),
`services/module_authoring_service.py` (validation), and
`services/attempt_service.py` (marking).

---

## The shape of a Reading module

A Reading module is fixed at **5 parts, 30 questions, 50 minutes**. You cannot
add or rename parts — they are created for you from the blueprint, and each one
locks down which question type it accepts.

| Part | Questions | Marks | Question type | Options | Shared passage |
|---|---|---|---|---|---|
| Reading 1A | 6 | 6 | `mcq_single` | 4 | No |
| Reading 1B | 5 | 5 | `mcq_single` | 3 | Yes (cloze) |
| Reading 2 | 6 | 6 | `matching_unique` | 8 | Yes |
| Reading 3 | 7 | 7 | `matching_reusable` | 4 | Yes |
| Reading 4 | 6 | 6 | `mcq_single` | 4 | Yes |

Two rules apply to every part: `preserve_question_order` and
`preserve_option_order` are both on, so Reading is **never shuffled** — what you
author is what the candidate sees, in that order. (Other sections do shuffle.)

Every part is `auto_marked: true`. No examiner touches Reading.

---

## Part-by-part

### Reading 1A — vocabulary, no passage

Six standalone multiple-choice questions, **4 options each**, exactly one
correct. There is no passage: each question carries its own sentence or stem.

- **Prompt**: the sentence or question.
- **Options**: 4. The form won't let you drop below 2, and validation requires
  exactly 4 here.
- **Correct answer**: mark one option.

### Reading 1B — the cloze part (this is your "fill in the blanks")

Five questions, **3 options each**, all hanging off **one shared passage**.
Layout is `shared_cloze`.

This is a gapped passage: the candidate reads one text with five gaps, and picks
from three options at each gap. Important: **the answer is still a multiple
choice**, not free typing. `mcq_single` with `shared_passage: true`.

How to author it:

1. Write the passage **once** and paste the *identical* text into the "Passage
   or context" field of **all five** questions. Validation compares them and
   rejects the part if they differ by even a character:
   *"Every question in Reading 1B must use the same source text."*
2. In each question's prompt, place the gap marker where the answer belongs.
3. Give 3 options and mark the correct one.

### Reading 2 — inline matching blanks, answers used once

Six questions, **8 shared options**, one shared passage, layout
`inline_matching_blanks`, and `unique_answers: true`.

Eight options, six gaps — so two options are distractors, and **no option may be
the correct answer for more than one gap**. Validation enforces exactly that:
*"Each option in Reading 2 may be the key for only one gap."*

Markup: put numbered markers in the passage —

```
{{blank:1}} … {{blank:2}} … {{blank:3}}
```

Marker `{{blank:N}}` binds to the **Nth question in order**, so question order
and marker numbering must line up. Every question in the part must carry a
marker; validation rejects the part otherwise.

All six questions must also share the same option bank —
*"Every question in Reading 2 must use the same option bank."*

### Reading 3 — matching to source texts, answers reusable

Seven questions, **4 shared options**, layout `source_text_matching`, type
`matching_reusable`.

Same idea as Reading 2 with one key difference: **the same option can be the
answer to several questions** (seven questions, four options — reuse is
unavoidable). The `unique_answers` rule is deliberately *not* applied here.

Typically the four options are short source texts (A–D) and each question is a
statement the candidate assigns to one of them.

### Reading 4 — long text, inference required

Six questions, 4 options, one shared passage, plus one extra rule:
`minimum_inference_questions: 1`.

At least one question must be tagged as inference / writer's purpose, or the
part will not validate: *"Reading 4 requires at least 1 inference or
writer-purpose question."*

---

## Blank markers — the two forms

The in-app help says this, and it is worth repeating because the two are easy to
confuse:

| Marker | Where | Meaning |
|---|---|---|
| `{{blank}}` | in a question prompt | a **single** gap, in this question |
| `{{blank:1}}`, `{{blank:2}}` … | in the shared passage | gap **N** binds to question **N**, in order |

Use the plain `{{blank}}` for a one-gap question. Use the numbered form for
Reading 2's inline matching, where the gaps live in the passage rather than in
each question's own text.

---

## How answers are actually marked

Worth knowing before you write answer keys, from `_grade_answer`:

- **`mcq_single`, `matching_unique`, `matching_reusable`** — the candidate's
  selection must match one entry in the correct-answer list.
- **`mcq_multiple`** — the selected set must equal the correct set **exactly**.
  No partial credit anywhere in the system.
- **`short_answer` / `fill_blank`** (typed answers, used elsewhere) — the typed
  text is compared after normalising: **trimmed, upper-cased, and internal
  whitespace collapsed**. So `"  the   Nile "` matches `"The Nile"`.
  It is otherwise an exact match — no stemming, no fuzzy matching, no spelling
  tolerance. If a typed answer has valid variants, **list every variant** in the
  correct answers.
- Unanswered is always wrong, never null.

A question is worth its `points` if correct and 0 if not. Each Reading part's
question points must **sum exactly to the part's max marks**, or you get
*"… must total N marks; it currently totals M."*

---

## Why a draft says "N requirements remaining"

That count is the list of validation errors, recomputed on every save. The
checks that bite most often in Reading:

1. Wrong number of questions for the part.
2. A question type the part doesn't allow.
3. Wrong option count (4 / 3 / 8 / 4 by part).
4. Passage missing, or the passages across a part not identical.
5. Option banks not identical across a matching part.
6. An option used as the key for two gaps (Reading 2 only).
7. A question missing its `{{blank}}` marker.
8. Points not summing to the part's max marks.
9. Reading 4 with no inference question.

The module cannot be published until that list is empty.

---

## Practical order of work

1. Create the Reading module — the five parts appear pre-configured.
2. Write each part's passage **first**, in a plain text editor.
3. For shared-passage parts, paste the same passage into every question. Copy
   and paste it; don't retype it, or the identical-text check will fail.
4. Add questions in the order candidates should see them — Reading never
   shuffles, and `{{blank:N}}` binds by position.
5. Add options, mark the keys, set points so each part hits its max marks.
6. Watch the requirements counter fall to zero, then publish.

**Bulk import** exists if you'd rather not hand-enter 30 questions — same rules
apply, and the same validation runs afterwards.
