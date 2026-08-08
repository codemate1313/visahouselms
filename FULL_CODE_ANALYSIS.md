# Full code analysis — Visa House LMS

Fresh pass over the whole codebase (2026-08-08). Backend: 42 routers, 59
services, 40 models, 68 migrations (~36k Python LOC). Frontend: React + Vite +
TS, ~61k LOC. Static analysis only — the backend can't be run in this
environment. Every claim below was verified against the cited file, not inferred.

## Bottom line

The codebase is in good shape. The high-risk surfaces I checked — auth, session
handling, impersonation, the web terminal, multi-tenant isolation, payment
signature verification, request logging, and the frontend token flow — are
correctly built. Static checks are clean: `python -m compileall` passes on all
of `backend/app`, and `tsc --noEmit` reports zero errors.

I found **one** genuine code issue (a signature-comparison inconsistency), which
I fixed. Everything else is operational/deployment configuration already tracked
in `DEPLOYMENT_AUDIT.md`, plus one architectural observation worth a look.

---

## Fixed this pass

### F1 — Razorpay signature compared with `!=` on the student plan path (hardening) ✅ fixed

`services/payment_service.py` verifies the Razorpay HMAC signature in three
places. Two of them — institute renewal (`:1137`) and vouchers
(`voucher_service.py:605`) — use constant-time `hmac.compare_digest`. The student
plan-payment path (`verify_razorpay_payment`, was `:755`) used a plain
`expected_signature != razorpay_signature`. Same correctness, but not
constant-time, and inconsistent with your own hardened code.

**Fix applied:** changed to
`if not hmac.compare_digest(expected_signature, razorpay_signature or ""):`.
Behaviour is identical for valid/invalid signatures; it just closes the timing
side-channel and makes all three paths consistent. `payment_service.py` still
parses; a grep confirms no plain `==`/`!=` signature comparisons remain in
`services/`.

---

## Verified solid (no change needed)

**Authentication (`dependencies/auth.py`).** Access tokens are checked for the
right `type`, a live non-revoked, non-expired `UserSession` is required (`sid`
claim), and the user must exist and be active. `require_role` gates by role name.

**Impersonation is genuinely read-only.** The token carries an `imp` claim; the
write-guard lives in the `maintenance_gate` middleware (`main.py:122`) and
refuses any non-GET/HEAD/OPTIONS request whose token carries `imp`. Crucially it
decodes the token itself (`is_impersonation_request`), so the guard does not
depend on `get_current_user` having run first — it is not a no-op.

**Web terminal (`routers/terminal.py`, `services/terminal_service.py`).**
Preset-only: every command is a fixed argv list or an internal function — no
free-form shell, no interpolation. Opening requires a password re-auth that
mints a 60-second single-purpose JWT ticket; the WebSocket revalidates the
ticket and re-confirms the user is still an active super admin before accepting.
Idle timeout closes stale sockets.

**Multi-tenant isolation.** Institute-scoped reads/writes funnel through
`institute_admin_service.get_member_or_404(db, actor, id)`, which filters the
query by the actor's own institute — a member ID from another institute returns
404, not the record. Student-portal endpoints scope everything to the token's
`user.id` (e.g. `get_user_payment_invoice(db, user.id, payment_id)`), so a
student cannot read another student's invoice/attempt by guessing an ID.

**No injection surface.** No SQL is built by string interpolation (`text(f"…")`
etc. — none found). No `eval`/`exec`/`os.system`/`shell=True`. The three
`subprocess.run` callers (backup, jobs, terminal) pass argv lists, and DB
passwords go through `MYSQL_PWD` in the environment, never on the command line.

**Request logging can't take down a request** (`middleware/request_logging.py`).
The log write is wrapped so a failure rolls back and logs, but never converts a
served response into a 500. Developer-role traffic is excluded at the source.

**Frontend token handling (`api/client.ts`, `store/authStore.ts`).** The access
token lives in memory only (Zustand, not persisted); refresh rides an httpOnly
cookie. The 401 interceptor uses an `_retry` flag (no infinite loop), a
single-flight `refreshPromise` (concurrent 401s share one refresh), and a
separate interceptor-free `refreshClient` (no recursion on the refresh call).
Legacy localStorage tokens are actively purged on load.

---

## Operational items (config/deploy, not code — from `DEPLOYMENT_AUDIT.md`)

These remain true and are server-side actions, not code defects:

- **utf8mb4 server-side** — client charset is pinned; still run
  `ALTER DATABASE/TABLE … utf8mb4` if the DB wasn't created that way.
- **Uploads on ephemeral disk** — mount a persistent volume at `STORAGE_DIR`, or
  recordings/imports vanish on restart.
- **GeoIP** — drop the GeoLite2 `.mmdb` at `GEOIP_DB_PATH` or session locations
  read "Unknown".
- **Split-host cookies** — for a Vercel+Render split, set
  `APP_ENVIRONMENT=production`, `REFRESH_COOKIE_SAMESITE=none`, and a non-wildcard
  `CORS_ORIGINS`. N/A on same-origin VPS+Nginx.

---

## Observation worth a look (not a confirmed bug)

**Multi-commit request paths.** Across `services/` there are ~264 `db.commit()`
calls and ~19 `db.rollback()`. Several multi-step flows commit more than once per
request. If a later step raises after an earlier `commit()`, the earlier write is
already durable — a partial-write window. The money paths I checked are safe
because they're written idempotently (the voucher flow reserves→verifies→
completes with idempotent state flips, and payment verification flips status
before/after the gateway check). This isn't a found bug; it's a pattern worth a
deliberate transaction-boundary review on any *new* multi-write endpoint, so a
single logical operation commits once.

---

## What I checked

Structure/scale survey · `compileall` (all backend) · `tsc --noEmit` (frontend) ·
raw-SQL/`eval`/`exec`/`shell=True` grep · subprocess call sites · `auth.py` token
& session validation · impersonation write-guard enforcement path · terminal
router + service · tenant-isolation chokepoint (`get_member_or_404`) and
student-portal scoping · all three Razorpay signature verifications · request
logging fail-safe · frontend axios interceptors and token storage.
