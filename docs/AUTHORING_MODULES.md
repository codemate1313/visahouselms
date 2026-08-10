# Authoring guide — Listening, Writing, Speaking, Full Mock, Final Test

Companion to `AUTHORING_READING.md`. Same source: the part rules come from
`services/module_blueprint_service.py`, the checks from
`services/module_authoring_service.py`, the marking from
`services/attempt_service.py`.

The principle is the same across every module type: **you never choose the
question type — the part does.** Creating a module builds its parts from the
blueprint, each locked to one type, a fixed question count and a fixed mark
total.

---

## At a glance

| Module | Duration | Parts | Questions | Raw marks | Marked by |
|---|---|---|---|---|---|
| Reading | 50 min | 5 | 30 | 30 | auto |
| Listening | 40 min | 4 | 30 | 30 | auto |
| Writing | 50 min | 2 | 2 tasks | 32 + 32 | examiner |
| Speaking | 14 min | 4 | ≥2 prompts each | 5 × 8 | examiner |
| Full Mock | 154 min | 15 | all four sections | per section | mixed |
| Final Test | 154 min | 15 | all four sections | per section | mixed |

---

# Listening — 4 parts, 30 questions, 40 minutes

Every part requires **audio** (`audio_required: true`) and every part plays it
**twice** (`audio_plays: 2`). A part will not validate without an MP3 upload or
a browser-narrated transcript:
*"… requires an MP3 upload or browser-narrated transcript."*

| Part | Qs | Marks | Type | Options | Notes |
|---|---|---|---|---|---|
| Listening 1 | 7 | 7 | `mcq_single` | 3 | Short unfinished dialogues |
| Listening 2 | 10 | 10 | `mcq_single` | 3 | **5 groups × 2 questions** |
| Listening 3 | 7 | 7 | `fill_blank` / `short_answer` | — | **Typed answers, max 3 words** |
| Listening 4 | 6 | 6 | `mcq_single` | 3 | Group discussion |

### Listening 2 — conversation groups

Layout `conversation_groups`, with `group_count: 5`,
`questions_per_group: 2`, and `group_label_required: true`.

Ten questions belong to **five conversations, two questions each**. Each
question must carry a **group label** naming its conversation — the authoring
form shows a required "Group" field. Questions sharing a label are shown
together under that conversation.

### Listening 3 — the typed-answer part

This is the one place in Listening where the candidate **types** rather than
selects. Layout `notepad_gaps`, `inline_marker_required: true`,
`max_answer_words: 3`.

- Place a `{{blank}}` marker in each question's prompt where the answer belongs.
  Validation rejects the part otherwise:
  *"Every question in … must place a {{blank}} marker in its prompt."*
- Answers are capped at **three words**.
- **Marking is exact**, after normalising: trimmed, upper-cased, internal
  whitespace collapsed. `"  the   Nile "` matches `"The Nile"`. Nothing else is
  forgiven — no spelling tolerance, no synonyms, no stemming.

  **This is the single biggest authoring risk in the platform.** If a correct
  answer has legitimate variants, you must list *every* one of them, including
  plurals, articles and spelling variants (`color` / `colour`). A candidate who
  writes a genuinely correct variant you didn't list is marked wrong, and
  nobody reviews it because the part is auto-marked.

Note `preserve_option_order` is absent here (there are no options) but
`preserve_question_order` is on, so gap order is fixed.

---

# Writing — 2 tasks, examiner-marked

| Part | Task | Words | Max marks | Weight |
|---|---|---|---|---|
| Writing 1 | Report or article from supplied information | **150–200** | 32 | **40%** |
| Writing 2 | Discursive essay on an academic subject | **250 minimum** | 32 | **60%** |

Both are a single `essay` question. `auto_marked: false` — the marking function
returns `None` for `essay` and awards zero automatically; a human decides
everything.

Two details that matter:

- **The tasks are not equally weighted.** Writing 2 is worth 60% and Writing 1
  40%, despite both being out of 32. Don't assume a 50/50 split when explaining
  scores to students.
- **Writing 1 has a maximum word count, Writing 2 only a minimum.** Writing 1 is
  150–200 words; Writing 2 is 250 with no upper bound.

### The rubric (per task, 32 marks)

Four criteria, 8 marks each:

| Criterion | Marks |
|---|---|
| Task Achievement | 8 |
| Grammar | 8 |
| Vocabulary | 8 |
| Organisation | 8 |

Authoring is just the prompt and any supplied stimulus material. The rubric is
fixed by the blueprint — you cannot add or reweight criteria.

---

# Speaking — 4 parts, examiner-marked, AI interlocutor

Every part is type `speaking_prompt`, `auto_marked: false`,
`interaction_mode: "ai_interlocutor"`. Each prompt records the candidate's
audio; the whole section is marked by a human afterwards.

Unlike every other section, Speaking parts have **no `max_marks`** — marks come
from the rubric applied across the section, and all four parts carry
**equal weight** (`parts_equal_weight: true`).

| Part | Min prompts | Limit | Prep | Response | Required turn types |
|---|---|---|---|---|---|
| Speaking 1 | 2 | — | 0s | 45s | `identity`, `topic_question` |
| Speaking 2 | 2 | **2** | 0s | 60s | `roleplay_response`, `roleplay_initiate` |
| Speaking 3 | 2 | — | **20s** | 90s | `read_aloud`, `follow_up` |
| Speaking 4 | 2 | — | **60s** | 120s | `presentation`, `follow_up` |

### Turn types

Each prompt is tagged with a **turn type**, chosen from that part's allowed
list. The *required* types must all be present or the part fails validation:
*"… is missing required speaking turns: …"*

So Speaking 2 must contain one prompt where the examiner starts the role play
(`roleplay_response`) **and** one where the candidate starts it
(`roleplay_initiate`) — it is capped at exactly two prompts.

Speaking 1, 3 and 4 have a minimum of 2 prompts but **no upper limit**, so you
can add follow-up questions freely (`follow_up` is allowed in 1, 3 and 4 — not
in 2).

### Prep and response timing

Preparation and response seconds are **defaults from the blueprint**, shown
per-prompt in the authoring form and editable there. Only Speaking 4 sets
`notes_allowed: true` — candidates may write notes during its 60s preparation.

### The rubric (5 criteria, 8 marks each)

| Criterion | Marks |
|---|---|
| Task Fulfilment and Communicative Effect | 8 (**weight ×2**) |
| Coherence | 8 |
| Accuracy and Range of Grammar | 8 |
| Accuracy and Range of Vocabulary | 8 |
| Pronunciation, Intonation and Fluency | 8 |

Note `task_fulfilment_weight: 2` — the first criterion counts double.

---

# Full Mock Test and Final Test

These are **not authored part-by-part like the others**. The blueprint
concatenates all four sections in a fixed order:

**Listening → Reading → Writing → Speaking**

That gives **15 parts** (4 + 5 + 2 + 4) and **154 minutes**. Every rule above
applies unchanged to the corresponding part — a Reading 2 inside a Full Mock
behaves exactly like a standalone Reading 2.

Assessment is stored **per section**, not pooled: the module carries a separate
assessment block for each of listening / reading / writing / speaking.

The two types are structurally identical. The difference is policy, not content
— **Final Test** is the one-sitting official assessment, which is why the
retake machinery (`RetakeRequest`) exists around it.

Composite modules can also be assembled from existing published modules rather
than authored from scratch, which is usually the sane route: build and validate
each section once, then compose.

---

## Rules that apply everywhere

1. **Question order is never shuffled** where `preserve_question_order` is set —
   which is every part in Reading, Listening, Writing and Speaking. Authoring
   order is candidate order.
2. **No partial credit anywhere.** `mcq_multiple` requires the selected set to
   equal the correct set exactly.
3. **Unanswered is wrong**, never null.
4. **Auto-marked points must sum exactly** to the part's `max_marks`.
5. **Examiner-marked parts** (`essay`, `speaking_prompt`) return no score from
   the marking function at all — they wait for a human.
6. A module cannot be published until its validation error list is empty.

## Where each type is marked

| Question type | Marking |
|---|---|
| `mcq_single`, `matching_unique`, `matching_reusable`, `true_false_not_given`, `yes_no_not_given` | selection must match a correct answer |
| `mcq_multiple` | selected set must equal correct set exactly |
| `short_answer`, `fill_blank` | typed text, normalised, then exact match |
| `essay`, `speaking_prompt` | examiner only — no auto score |
