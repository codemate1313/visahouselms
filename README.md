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
- Phase 3.2: course and content builder — complete
- Phase 3.3: question banks and test builder — complete
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

## Phase 3.2 capabilities

SA Instructors can create and maintain flat central courses with draft,
published, and archived states. Courses include direct-student pricing,
level/duration metadata, featured status, and ordered PDF/MP3 resources.
Uploads are checked by declared type, size, and file signature before being
stored.

Super Admins have read-only catalog oversight and can assign published courses
to active institutes. Assignment history is preserved, and courses with
assignment, coupon, or payment history must be archived instead of deleted.
Course-scoped coupons now select real published courses, while the Phase 5 B2C
payment foundation validates the current published course price.

## Phase 3.3 capabilities

SA Instructors can create course-scoped question banks for Listening, Reading,
Writing, and Speaking. Questions support single- and multiple-answer MCQs,
True/False/Not Given, Yes/No/Not Given, short answers, fill-in-the-blank,
Writing tasks, and Speaking prompts.

Questions can be entered individually or extracted in bulk from UTF-8 CSV and
text-based PDF files. Imports always open in an editable preview showing the
detected questions, choices, answers, source text, and extraction warnings;
only selected, reviewed questions are committed. A downloadable CSV template
is included in the instructor UI. Scanned PDFs require OCR before import.

The test builder assembles course questions into ordered practice tests,
module mocks, full mocks, and final tests with instructions, optional timing,
points, and draft/published/archived lifecycle controls. Published questions
are protected from changes that would silently alter a live test. Assessment
content is creator-owned while remaining visible to the central instructor
team.

The dashboard shell and authoring views include mobile navigation, responsive
cards and forms, scroll-safe tables, and layouts for tablet and phone widths.

The schema is at Alembic revision `0013`.

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
