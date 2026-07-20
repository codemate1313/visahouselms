# Visa House LMS

Multi-tenant IELTS learning platform with a FastAPI/SQLAlchemy backend and a
React/Vite frontend.

## Current delivery status

- Phase 1: platform foundation and Super Admin operations — complete
- Phase 2.1: plans and subscriptions — complete
- Phase 2.2: institute management and branding — complete
- Phase 2.3: trials and demo accounts — complete
- Phase 2.4: payments, coupons, invoices, revenue, and dues — complete
- Phase 3.1: SA Instructor role and portal foundation — complete
- Phase 3.2: SA Instructor account and profile controls — complete
- Phase 3.3: module-first assessment authoring — complete
- Phase 3.4: student attempts and grading workflow — next

## Phase 3.1 capabilities

Super Admins can create, search, edit, deactivate, reactivate, reset, and delete
central instructor accounts. Creation returns a temporary password for testing,
and instructors are required to change it after login. Password resets return a
fresh temporary password and revoke existing refresh sessions. Account
deactivation also revokes existing refresh sessions.

SA Instructors have a separate role-protected portal with:

- an authoring dashboard and stable Phase 3 content counters;
- content-workspace and grading-queue foundations;
- instructor metadata, specializations, avatar, and self-service profile;
- password change and active-session management;
- recent audited activity and profile-completion feedback.

## Phase 3.3 capabilities

SA Instructors create one of six self-contained assessment module types:
Reading, Speaking, Writing, Listening, Full Mock Test, or Final Test. There is
no separate instructor-facing Course, Question Bank, or Test Builder workflow.
Creating a module generates its required LanguageCert Academic parts, timing,
question limits, raw marks, answer rules, and examiner rubrics.

Questions can be entered individually or extracted from UTF-8 CSV and
text-based PDF files. Every import URL contains both the destination module and
destination part, and the review screen names that target before anything is
committed. Extracted questions, answer choices, answers, source text, and
warnings are listed for review. Scanned PDFs still require OCR first.

Every Listening part requires audio before publishing. An instructor can
upload a signature-checked MP3 or provide conversation text and generate an
MP3 using one of the configured English text-to-speech voices. The transcript,
voice, part ownership, source type, and audio file are retained together.

Draft modules may be incomplete. Publishing runs a strict server-side check
for required parts, exact question totals, allowed question types, exact raw
marks, and Listening audio. Published modules are immutable until explicitly
returned to draft. Existing Phase 3.2/3.3 legacy tables are retained for a
non-destructive migration, but their instructor APIs and UI are no longer
mounted.

The dashboard shell and authoring views include mobile navigation, responsive
cards and forms, scroll-safe tables, and layouts for tablet and phone widths.

The schema is at Alembic revision `0014`.

The full assessment mapping is documented in
[`docs/assessment-module-blueprints.md`](docs/assessment-module-blueprints.md).

## Verification

From `backend/`:

```bash
.venv/bin/alembic upgrade head
PYTHONPYCACHEPREFIX=/tmp/visahouse-pyc .venv/bin/python -m unittest discover -s tests
```

From `frontend/`:

```bash
npm run lint
npm run build
```
