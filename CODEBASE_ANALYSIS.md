# Codebase analysis — Visa House LMS

A structural, security and quality read of the whole codebase. Static analysis
only — the backend can't be executed in this environment (no PyPI), so nothing
here is runtime-measured. Every claim cites a file.

---

## 1. Shape and scale

| | |
|---|---|
| Backend | FastAPI + SQLAlchemy 2 + Alembic, ~35k lines across 192 Python files |
| Frontend | React + Vite + TypeScript + Zustand, ~60k lines across 569 files |
| CSS | ~42k lines |
| Migrations | 68 |
| Backend tests | 54 files |
| Frontend tests | 0 |

It's a mature, multi-tenant B2B/B2C platform: a marketing site, five portals
(super-admin, developer, institute admin, institute instructor, student), plus
the developer control layer built out recently. The layering is clean and
consistent — routers are thin, services hold the logic, models are declarative,
and each screen has its own strings/CSS. That consistency is the codebase's
biggest asset; a new feature has an obvious shape to follow.

---

## 2. What is genuinely well done

- **Token hygiene (mostly).** The access token lives in memory (Zustand,
  `store/authStore.ts`), never localStorage, and the refresh token is an
  httpOnly cookie. That is the correct, XSS-resistant design, and there's even a
  cleanup that purges tokens older versions left in localStorage.
- **Config safety.** `config.py:68` refuses to start in production without a
  valid Fernet encryption key and rejects wildcard CORS with credentials. Secrets
  are read from env, not hard-coded.
- **Secret handling.** Gateway keys (Stripe, D-ID, AI) are stored encrypted and
  masked (`********`) on read; only hashes of passwords and the shutdown secret
  are stored.
- **Auth coverage.** Every admin router carries a router-level dependency, and
  the few without one (`vouchers`, `notifications`, `module_authoring`,
  `assessment_authoring`, `instructor_grading`) guard each endpoint individually
  — verified by counting `Depends` per file. The unguarded ones are deliberately
  public (`auth`, `platform_router`, `payment_webhooks`, public voucher/offering
  reads).
- **Audit trail** is written inside the mutation's transaction, so an audit row
  can't outlive a rolled-back change.

---

## 3. Security findings

### S1 — Impersonation tokens are now persisted to localStorage *(new, worth reverting)*

`store/impersonationStore.ts` persists `originalToken` and `impersonatedToken`
to localStorage so the banner survives a refresh. That undoes the app's own
rule — access tokens are otherwise kept in memory precisely so an XSS payload
can't read them. With this, a script on the page can lift both the developer's
real token and the impersonation token from storage.

**Recommendation.** Persist only the non-secret bits (the target, and a boolean
"active") and re-mint the impersonation token from the server on refresh, or
accept that a refresh ends impersonation. Keep tokens out of localStorage.

### S2 — Blog rendering is unsanitised HTML injection

`pages/public/BlogDetail/components/BlogMarkdownBody.tsx:7` builds HTML with
`formatInlineMarkdown` (only `**bold**`/`*italic*`) and feeds it to
`dangerouslySetInnerHTML` **without escaping the input first**. Any raw HTML in a
blog body — `<script>`, `<img onerror=…>` — renders. Blog content is authored by
Super Admins, so this is stored XSS gated behind an admin account rather than a
public one, but it is still an injection sink on a public page.

**Recommendation.** Escape the text before applying the markdown regexes, or run
the output through a sanitiser (DOMPurify). Small change, closes the sink.

### S3 — Public voucher purchase endpoint

`routers/vouchers.py:85` `POST /vouchers/public/purchase` is unauthenticated by
design. Confirm it is rate-limited and validates the offering/amount server-side
(the pattern used elsewhere for renewals) so it can't be driven to create
arbitrary purchase records. Worth a targeted look, not necessarily a bug.

---

## 4. Reliability and correctness

- **No frontend tests at all.** 60k lines of UI, zero test files. The backend has
  54 test files, which is good coverage of services — but every regression I hit
  in this project was frontend or auth-flow, exactly the untested surface. Even a
  thin smoke suite (login renders, a protected route redirects, a form submits)
  would catch the class of breakage that has bitten this app repeatedly.
- **The backend cannot be exercised here**, so the recent additions (2FA login,
  impersonation, session/analytics) rest on type/syntax checks only. They need
  one real pass on a branch.
- **Migrations use SQLite batch recreates** in places (0062, 0064-that-was). Batch
  recreate of a table referenced by many FKs is a known SQLite footgun; the
  totp-columns approach was moved off `users` for exactly this reason. Prefer
  plain `add_column` over `batch_alter_table` on `users` and other heavily-
  referenced tables.

---

## 5. Maintainability

- **A few very large modules.** `attempt_service.py` (1339), `institute_service.py`
  (1270), `payment_service.py` (1204) on the backend; `Vouchers/index.tsx` (1403),
  `TestRunner/index.tsx` (1129) on the frontend. These are the files most likely
  to hide bugs and the hardest to change safely. Worth splitting by concern when
  next touched — not a rewrite, just carving out cohesive pieces.
- **42k lines of CSS**, much of it per-screen with heavy use of `!important`
  (seen throughout the responsive/table work). The `!important` density makes
  overrides brittle — the mobile-table and segmented-control fixes both had to
  fight specificity. A pass to reduce `!important` and lean on the token system
  would pay for itself.
- **Duplicated `developer_access_slug` default** (`"vh-control-9f4c2a"`) is
  inlined in ~10 frontend files. One exported constant would remove the
  copy-paste.

---

## 6. Performance

Covered in `PERFORMANCE_AUDIT.md`. The four flagged items (duplicate request-log
write, grading-queue N+1, institute-list N+1, whole-document table observer) are
fixed. The remaining watch items: prune `traffic_events` as it grows, and split
the large services above.

---

## 7. Priorities

1. **S1** — get impersonation tokens back out of localStorage. Small, and it
   restores the token hygiene the rest of the app is careful about.
2. **S2** — sanitise blog HTML. Small, closes an XSS sink.
3. **A frontend smoke-test suite** — the single highest-leverage reliability
   investment, given how the regressions here have clustered in untested UI/auth.
4. **S3** — confirm the public voucher purchase is rate-limited and
   server-validated.
5. Split the largest services/screens as they are next touched; chip away at
   `!important`.

None of these are on fire — the platform is well-built and consistent. S1 and S2
are the two I'd not leave sitting.
