# Backend audit — inconsistencies, defects, bugs, leakages

> **Status: all findings fixed.** See `## Fix log` at the end for what changed.
> C1, H1, M1, M2 and M3 are resolved in code; M4 is a convention, documented below.

Static analysis of `backend/app` (42 routers, 59 services, 40 models, ~36k LOC).
Every finding below was verified against the cited file and line — nothing here is
inferred. Where I suspected a problem and it turned out to be handled, I've said so
in "Verified clean" rather than padding the list.

Ordered by severity.

---

## C1 — `/storage` is served publicly, and backups sit inside it 🔴 **critical**

`main.py:60`

```python
app.mount("/storage", StaticFiles(directory=str(settings.storage_path)), name="storage")
```

The whole storage tree is mounted as **unauthenticated static files**. It is also
listed in `_MAINTENANCE_EXEMPT_PREFIXES` (`main.py:92`), so it stays reachable even
while the site is closed for maintenance.

Database backups are written **inside that same tree** — `backup_service.py:23`
(`settings.storage_path / "backups"`) — with a **predictable filename**
(`backup_service.py:54-55`):

```python
timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
filename = f"backup_{timestamp}.tar.gz"
```

**Consequence.** `GET /storage/backups/backup_20260810_031500.tar.gz` needs no
token, no cookie, no role. The name is a UTC timestamp — about 86,400 candidates
per day, trivially brute-forced. A full `mysqldump` of the platform (every user
row, password hashes, settings) is retrievable by an anonymous caller.

There *is* a properly guarded download route (`routers/backups.py:60`), but the
static mount bypasses it entirely.

**Fix — pick one, in order of preference:**

1. **Move backups out of `STORAGE_DIR`** (e.g. `/var/backups/visahouse`). One-line
   config change, removes the exposure completely, and `routers/backups.py` keeps
   working since it resolves paths through `backup_service`.
2. Serve `/storage` through an authenticated FastAPI route instead of `StaticFiles`.
3. Stop-gap only: `location /storage/backups { deny all; }` in Nginx.

Do (1) before the next backup runs. The `backups/` directory is empty in this dev
checkout, so exposure depends on backups having run on the server — check
production immediately.

---

## H1 — `avatar_service` is missing five functions its callers still use 🟠 **high**

`services/avatar_service.py` defines only `get_or_create_prompt_audio`,
`list_examiners`, `get_examiner` (plus private `_generate_text_visemes`). Five
attributes are called on it from live code paths and **do not exist**, so each
raises `AttributeError` at runtime:

| Missing function | Called from | Effect |
|---|---|---|
| `get_config` | `routers/dev_settings.py:108` | `GET /super-admin/dev-settings/avatar` → 500 |
| `update_config` | `routers/dev_settings.py:121` | `PUT /super-admin/dev-settings/avatar` → 500 |
| `test_connection` | `routers/dev_settings.py:128` | `POST /super-admin/dev-settings/avatar/test` → 500 |
| `validate_part_for_generation` | `routers/module_authoring.py:334` | avatar generation request → 500 |
| `generate_for_part` | `services/job_service.py:131` | `generate_avatar` job fails every run |

**Why this slipped through.** `python -m compileall` passes — attribute errors are
a runtime concern, not a syntax one. `tsc` covers none of it. This is exactly the
class of defect that only an import-graph or integration test catches.

**Root cause (strong evidence).** `core/avatar_gateway.py` contains a complete
D-ID provider (`DIdAvatarProvider`, `get_provider`) — the vendor integration those
config functions would have wrapped. It is referenced **nowhere** in the codebase.
The picture is that `avatar_service.py` was rewritten for the current viseme /
LivePortrait approach and the older config + generation functions were dropped,
leaving their call sites behind.

**Fix.** Decide which avatar approach is live, then either restore the five
functions (config-backed, wrapping `avatar_gateway`) or delete the dead endpoints
and the `generate_avatar` job branch. Right now it is half of each, and every one
of those five paths is broken.

---

## M1 — `core/avatar_gateway.py` is dead code 🟡 **medium**

109 lines implementing a D-ID provider, imported by nothing (`grep -rn
"avatar_gateway"` → no hits outside itself). Either wire it up as part of the H1
fix or delete it. Leaving a plausible-looking vendor integration lying around is
how the next person reintroduces H1.

---

## M2 — User media under `/storage` has no access control 🟡 **medium**

Beyond backups, the same public mount also serves:

- `attempt-answers/{attempt_id}/{uuid4}.webm` — **student speaking recordings**
- `institute_agreements/{institute_id}/{kind}-{token_hex(12)}` — signed agreements
- `support_attachments/{ticket_id}/{uuid4}.ext` — whatever users attach to tickets

Credit where due: these all use unguessable names (`uuid4`, 96-bit tokens), so
they are not enumerable the way backups are. But that is security-through-
obscurity, not authorization. Practical consequences: a leaked URL grants
permanent access with no revocation; anyone who once had access keeps it after
their account is deleted or their session revoked; and the files carry no
`Cache-Control`/`X-Robots-Tag`, so a URL that reaches a browser referrer or a
crawler stays live.

For student voice recordings this is personal data, which matters for your GDPR
erase path (`gdpr_service.py`) — deleting the DB row does not revoke a URL someone
already holds.

**Fix.** Serve user media through an authenticated route that checks ownership
(the same `get_member_or_404` chokepoint the rest of the app uses), and keep
`StaticFiles` for genuinely public assets only (logos, avatars, course art).

---

## M3 — Static OTP bypass exists and is DB-toggleable 🟡 **medium**

`core/security.py:174-196`. `is_static_otp_enabled()` returns True if the DB
setting `testing.static_otp_enabled` is truthy, else falls back to
`app_environment == "development"`. `get_static_otp_code()` defaults to `123456`.

Defaults are safe — in production the fallback is False, so this is **off unless
someone explicitly turned it on**, and the toggle is behind a super-admin route.
But if it ever gets switched on in production, every account's OTP becomes
`123456`. Worth confirming `testing.static_otp_enabled` is unset/false on the live
database, and worth considering a hard guard that refuses to honour it when
`app_environment == "production"` regardless of the stored setting.

---

## M4 — Multi-commit request paths 🟡 **medium (design, not a live bug)**

~264 `db.commit()` against ~19 `db.rollback()` across `services/`. Several flows
commit more than once per request, so a failure after an early commit leaves a
partially-applied operation. The money paths I checked are written idempotently
(voucher reserve → verify → complete; payment status flips around the gateway
check), so I did **not** find a live inconsistency — but the pattern means any new
multi-write endpoint is one unlucky exception away from partial state. Worth a
deliberate transaction-boundary convention: one logical operation, one commit.

---

## Verified clean — checked and genuinely fine

Listing these so you don't pay to re-audit them:

- **No SQL injection surface.** No f-string/`%`/concat into `execute()` or `text()`.
- **No `eval` / `exec` / `os.system` / `shell=True`.** The three `subprocess.run`
  callers (backup, jobs, terminal) pass argv lists; DB passwords go via `MYSQL_PWD`
  in the environment, never on the command line.
- **No leaked DB sessions.** AST-checked every function that calls `SessionLocal()`
  — all close in `finally` or use a context manager.
- **No blocking I/O inside `async def`.** The synchronous `requests`/`urlopen`
  calls live in `def` endpoints, which FastAPI runs in a threadpool.
- **No exception text returned to clients** (`detail=str(e)` etc. — none found).
- **No secrets logged.**
- **`dev-settings` is guarded.** I initially flagged 15 endpoints as auth-less;
  they're covered by a router-level
  `dependencies=[Depends(require_super_admin_or_verified_developer)]`
  (`dev_settings.py:31`). Not a finding.
- **Secrets masked by default.** `get_settings_group` masks unless
  `mask_secrets=False`, and every unmasked call uses the value server-side only
  (gateway auth, HMAC) — `get_payment_gateways_status` returns status strings, not keys.
- **Upload handling is solid.** Content-type allowlist, 10 MB cap, file-count cap,
  and `uuid4` filenames — user filenames contribute only a `Path(...).suffix`, so
  no traversal (`routers/support.py:44-70`).
- **Terminal is preset-only**, password re-auth → 60s ticket → WS re-validates an
  active super admin.
- **Impersonation is genuinely read-only** — the middleware decodes the token
  itself, so the guard doesn't depend on dependency ordering.
- **Tenant isolation holds** via `institute_admin_service.get_member_or_404`.

---

## Suggested order of work

1. **C1** — move `backups/` outside `STORAGE_DIR`, then check production for
   already-exposed dumps. Today.
2. **H1** — decide the avatar architecture; restore or remove the five call sites.
3. **M2** — put user media behind an authorized route.
4. **M1 / M3** — delete dead gateway; confirm static OTP off in production.
5. **M4** — adopt a one-commit-per-operation convention going forward.


---

## Fix log

| # | Fix | Files |
|---|---|---|
| C1 | Backups moved out of the public tree. New `BACKUP_DIR` setting + `settings.backup_path`, which **refuses** to resolve inside `storage_path` and falls back to a sibling folder. `backups_dir()` now relocates any archive left in the old public location on first call, so pre-existing dumps stop being reachable. `storage-link` no longer recreates `storage/backups`. `attempt-answers/`, `support_attachments/`, `institute_agreements/` and legacy `backups/` are denied by the static mount. | `config.py`, `services/backup_service.py`, `routers/dev_settings.py`, `main.py`, `.env` templates |
| H1 + M1 | D-ID remnants removed: 3 dev-settings endpoints, the module-authoring generate route, the `generate_avatar` job handler, `core/avatar_gateway.py`, `AvatarSettingsIn`, plus the frontend `AvatarTab`, `SpeakingAvatarPanel` and their strings. The free TTS + viseme examiner is untouched. | `routers/dev_settings.py`, `routers/module_authoring.py`, `services/job_service.py`, `schemas/dev.py`, frontend `DeveloperSettings/`, `ModuleEditor/` |
| M2 | Private media now served via short-lived HMAC-signed URLs (`/media/...?exp=&sig=`). Signature-based rather than header-based because the access token lives in memory and browsers do not attach it to `<audio>`/`<img>` requests. Route re-checks expiry + signature, resolves against the storage root to block traversal, and sends `no-store` + `noindex`. | `core/media_signing.py`, `routers/media.py`, `main.py`, `services/attempt_service.py`, `services/support_service.py`, frontend support pages |
| M3 | Static OTP hard-disabled when `app_environment == "production"`, regardless of the stored setting. The PUT now rejects an enable attempt in production instead of accepting-and-ignoring it. | `core/security.py`, `routers/dev_settings.py` |
| M4 | Convention only, no code change: one logical operation, one commit. Existing money paths are idempotent and were left alone. | — |

### Verification run after the fixes

- `python -m compileall app` — clean
- AST cross-module reference check (the check that found H1) — **no missing attributes**
- `tsc --noEmit` — clean
- Signing round-trip exercised standalone: valid ✓, tampered path ✗, expired ✗, empty signature ✗
- `backup_path` guard exercised: a `BACKUP_DIR` pointing inside `storage/` is rejected and redirected outside
- Grep for every removed symbol — no dangling references

### Still needs a human on the server

1. **Check production for already-exposed dumps.** The relocation runs on the app's next backup-related call, but if a dump was fetched before that, the data is already out.
2. Set `BACKUP_DIR` explicitly in the production env, ideally outside the app directory entirely (e.g. `/var/backups/visahouse`).
3. Confirm `testing.static_otp_enabled` is not set on the live database.
