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
- Phase 3.4: student attempts and grading workflow — complete
- Phase 4: Institute Admin portal, member management, and billing — complete
- Phase 5: student test engine and CEFR-aligned proficiency reporting — complete
- Phase 6: hybrid grading, moderation, and reevaluation workflow — complete

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
Reading, Speaking, Writing, Listening, Full Mock Test, or Final Test. These
modules are presented as courses throughout the interface. The publishing
instructor can update course details and content after publication and can
permanently delete unused drafts.
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
marks, and Listening audio. Published modules remain editable by their creator.
Existing Phase 3.2/3.3 legacy tables are retained for a
non-destructive migration, but their instructor APIs and UI are no longer
mounted.

The dashboard shell and authoring views include mobile navigation, responsive
cards and forms, scroll-safe tables, and layouts for tablet and phone widths.

## Phase 3.4 capabilities

Students can take entitled assessment modules in a timed, autosaving runner,
upload Speaking recordings, resume active attempts, and review submitted or
graded results. Objective sections are marked automatically; Writing and
Speaking submissions go to an active institute instructor when available.
Direct-student work and institute work without an active institute instructor
fall back to the owning SA Instructor's rubric grading queue.
Final Tests are single-sitting and record focus/fullscreen flags for review.

## Phase 4 capabilities

Institute Admins with the `manage_students` permission provision students
manually or by CSV/XLSX import, subject to the agreed student limit. They can
edit, activate, deactivate, archive, reset passwords, review attempts and
grading history, inspect known device counts, and revoke student sessions.
Super Admins retain cross-institute account oversight and emergency control.

Institute Admin access is permission-based per institute. During institute
creation, and at any later time, the Super Admin can grant or revoke student
directory access, student management, activity visibility, session revocation,
instructor management, and subscription visibility. The portal navigation and
dashboard follow those permissions, and the API enforces the same checks.
Subscription and offline payment information is read-only for permitted
Institute Admins. Every member operation remains tenant-scoped; cross-institute
IDs return not found.

## Phase 5 capabilities

The timed student test engine now produces a versioned CEFR proficiency profile
for Listening, Reading, Writing, and Speaking. Auto-marked skills are evaluated
on submission, while Writing and Speaking remain provisional until every
examiner rubric is complete. Examiner marks are stored with their derived CEFR
band and students receive an overall level, per-skill levels, marks, percentages,
and concise skill descriptors.

CEFR does not define a universal percentage-to-level conversion. The LMS keeps
the configured raw-score cut scores where a module has them and otherwise uses
the declared `cefr-companion-2020-diagnostic-v1` local policy. Overall results
use the lowest completed skill level so that a high score in one skill cannot
hide an unready skill. Reports are labelled diagnostic estimates rather than
official CEFR certificates, and retain the framework link and policy version
needed for later calibration.

## Phase 6 capabilities

Subjective submissions have a persistent grading queue with pending, claimed,
and completed states, examiner ownership, priorities, due dates, and routing
reasons. Completed grades are read-only unless a student opens a reevaluation.

Writing evaluators can request an optional AI rubric draft from a Super
Admin-configured JSON evaluator endpoint. Suggestions include criterion marks,
CEFR levels, rationale, confidence, and policy version. Suggestions are stored
separately and cannot publish a result; a human examiner must review and confirm
every mark. Monthly use is enforced per direct/institute scope. Speaking audio
remains human-evaluated.

Students can request reevaluation of completed human-marked results. Requests
reopen the grading queue at higher priority and retain reviewer ownership,
status, and the final resolution note. Super Admins have a grading-oversight
screen for queue totals, AI usage, and the reevaluation register.

## Institute onboarding flow

1. The institute contacts Visa House offline and agrees on access, capacity,
   duration, and payment terms.
2. The Super Admin records the payment/subscription and creates the institute.
3. The Super Admin applies the institute logo, colors, and other branding.
4. The Super Admin grants the Institute Admin only the agreed operational
   permissions and shares the generated temporary login.
5. After publication, the Institute Admin issues student accounts individually
   or imports a CSV/XLSX file when the Super Admin granted that permission.
6. The Super Admin can later change permissions, suspend the institute, or
   manage and revoke individual student access.

Students also receive deterministic progress badges and an institute-only
leaderboard. Rankings use average percentage across graded tests, recalculate
when a result is released, show only a first name and last initial to peers,
and never mix students from different institutes.

The schema is at Alembic revision `0026`.

## Course distribution controls

- SA Instructors own and maintain their courses, including post-publication metadata and module changes.
- Super Admin sees an instructor-to-course hierarchy with timestamps, contents, status, and distribution details.
- Super Admin can publish, hide, archive, remove, assign, and revoke courses while historical records remain intact.
- Direct-student subscription plans can bundle published courses and can be published or kept as drafts.

## Institute onboarding

Super Admin uses a negotiated onboarding workflow for physical institute sales:
agreement and offline payment, permissions, course allocation, branding, and
final publication. The first Institute Admin credential remains inactive until
publication; that administrator issues student and instructor accounts afterward.
The system creates a hidden internal agreement subscription only
to preserve limits, expiry, billing history, and existing access checks; it is not
shown as a sellable plan in the Super Admin interface.

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

## Local seed data

The local database file is intentionally ignored by Git. To recreate the shared
QA dataset on any machine, configure `backend/.env`, install backend
dependencies, then run:

```bash
npm run seed
```

Or run the backend script directly:

```bash
cd backend
.venv/bin/python scripts/seed_local_data.py
```

The command is safe to run repeatedly. It applies migrations, creates the
configured `.env` Super Admin if missing, creates sample assessment modules, and
assigns all published modules to the QA institute.

Seeded QA logins use password `Test@12345`:

- Super Admin: `qa.superadmin@example.com`
- SA Instructor: `sample.instructor@example.com`
- Institute Admin: `qa.institute.admin@example.com`
- Institute Instructor: `qa.institute.instructor@example.com`
- Institute Student: `qa.student@example.com`
