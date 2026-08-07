# Deployment audit — Visa House LMS (MySQL + hosted)

The app was built and tested on SQLite + localhost. Moving to MySQL 8 and a
hosted setup (VPS, or Vercel + Render) exposes a different class of problems than
the earlier logic audits. This focuses on those: things that pass on SQLite and
the dev machine but misbehave in production. Static analysis only — the backend
can't be run here. Each item cites a file.

Ordered by severity.

---

## C1 — Partial unique indexes on MySQL — **already handled, false alarm** ✅

*Correction: my first read of this was wrong. I read the model and assumed MySQL
got a full unique index. It does not — the **migrations** handle MySQL
separately.* Migration `0054_fix_mysql_partial_unique_indexes` and
`0058_retake_requests` create the equivalent constraint on MySQL with **stored
generated columns** (`original_attempt_slot`, `active_attempt_slot`, NULL for
out-of-scope rows, which MySQL treats as distinct in a unique index) — correct
partial-unique behavior. The `sqlite_where`/`postgresql_where` on the model only
apply to SQLite/Postgres via `create_all`; production uses `alembic upgrade
head`, so MySQL is correct. **No change needed.** Retakes work on MySQL.

The rest of this section is left as the original (incorrect) reasoning for the
record.

---

### Original (incorrect) finding

`models/attempt.py:150-165` defines two **partial** unique indexes:

```python
Index("uq_test_attempt_original_user_module", "user_id", "module_id",
      unique=True, sqlite_where=text("is_retake = 0"),
      postgresql_where=text("is_retake = false"))
Index("uq_test_attempt_active_user_module", "user_id", "module_id",
      unique=True, sqlite_where=text("status = 'in_progress'"),
      postgresql_where=text("status = 'in_progress'"))
```

They are unique on `(user_id, module_id)` **only where** the row is an original
attempt / an in-progress one. **MySQL 8 does not support partial (filtered)
indexes**, and there is no `mysql_where`. On MySQL, SQLAlchemy drops the WHERE and
creates a **plain unique index on `(user_id, module_id)`**.

Consequences on MySQL:

- A student can never take the same module a **second time** — even a legitimate
  retake that the app explicitly allows via an approved `RetakeRequest`. The
  second attempt violates the (now full) unique constraint and 500s.
- Any second attempt of a module for the same user is blocked, full stop.

This breaks the core test-taking loop for any returning student. The app already
enforces the real rule in `attempt_service.start_attempt` (it checks for an
existing non-retake attempt and requires a RetakeRequest), so the DB index is a
backstop — and on MySQL it is an actively wrong one.

**Fix.** Make these indexes non-unique on MySQL (keep them for lookup speed) and
rely on the app-layer check, or express the constraint with a MySQL-8 functional
/ generated-column workaround. A migration is needed; do it before real students
retake anything.

---

## C2 — MySQL charset must be utf8mb4 — **fixed (client side)** ✅

`database.py` created the engine with no charset pinned. If the connection is not
**utf8mb4**, any 4-byte UTF-8 character — emoji, and some names / pasted content —
raises `Incorrect string value` and the insert fails.

**Fixed.** The engine now passes `connect_args={"charset": "utf8mb4"}` (and
`pool_recycle=3600`) for any `mysql...` URL. **You still must ensure the database
and tables are utf8mb4** on the server side — the client charset alone does not
convert existing latin1/utf8 tables:

```sql
ALTER DATABASE ielts_lms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- and for existing tables that were created before this:
ALTER TABLE <table> CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

If you created the database fresh with a utf8mb4 default, the tables are already
correct and only the client pin (now applied) was missing.

---

## H1 — Cross-origin cookie + CORS config (Vercel + Render split only)

The refresh token is an httpOnly cookie. On a split deployment (frontend on one
domain, backend on another) the browser will **not** send a `SameSite=lax` cookie
cross-site, so login appears to work once and then the session silently dies on
the first token refresh.

The code supports the right setup but does not default to it. For a split
deployment you must set, on the backend:

- `APP_ENVIRONMENT=production`
- `REFRESH_COOKIE_SAMESITE=none` (config forbids this outside production, and it
  forces `Secure`, `config.py:83-91`)
- `CORS_ORIGINS=https://<your-frontend-domain>` (no wildcard with credentials —
  the config rejects that, `config.py:79`)

and on the frontend build:

- `VITE_API_BASE_URL=https://<your-backend-domain>` (defaults to `/api`, which is
  correct only for the same-origin VPS + Nginx setup, `api/client.ts:6`)

On the **VPS + Nginx** path (Option A), where Nginx serves the frontend and
proxies `/api` on the same origin, `SameSite=lax` and the default `/api` are
correct and none of this applies.

---

## H2 — Uploads on an ephemeral filesystem are lost on restart

Storage is local-folder (`STORAGE_DIR`, default `../storage`) — speaking
recordings, document imports, logos. On Render (or any container host) without a
mounted persistent disk, that folder is wiped on every deploy/restart, so
recordings and uploaded files vanish. Your own notes flag this; confirm the 1 GB
persistent disk is mounted at the storage path, or move storage to object storage
(S3/R2) for a real deployment.

---

## M1 — Alembic `batch_alter_table` migrations were authored for SQLite

Several recent migrations (e.g. `0062_log_fk_ondelete`, `0063_traffic_events`,
`0064` before it was removed) use `op.batch_alter_table`, which is SQLite's
table-recreate mechanism. On MySQL these run differently (direct ALTERs), and the
FK-recreate logic in 0062 has SQLite-specific branches. **Verify every migration
applied cleanly on the MySQL instance** (`alembic current` matches head, and
`user_sessions` / the log tables have the expected columns and FKs). A migration
that half-applied on MySQL would surface as odd runtime errors later.

---

## M2 — Per-process in-memory caches with multiple workers

The news feed cache (`exam_news_service`), the maintenance/read-only flag cache
(`core/maintenance`, 10s TTL), and the developer-action context are per-process.
Under multiple Uvicorn/Gunicorn workers, each worker has its own copy. Effects:
toggling maintenance or read-only takes up to the TTL to reach other workers, and
the news feed refreshes independently per worker. Functionally fine, mildly
surprising. If you run many workers and want instant maintenance propagation,
back the flag with a quick shared read (it already reads the DB on cache miss, so
lowering the TTL is enough).

---

## M3 — GeoIP database must be present or location reads "Unknown"

`services/geoip_service.py` degrades gracefully, but session locations show
"Unknown" until the GeoLite2 `.mmdb` is downloaded and `GEOIP_DB_PATH` points at
it. Not a bug; a deployment step.

---

## What's already deployment-safe

- **Config refuses unsafe production settings**: no encryption key, wildcard CORS
  with credentials, or `SameSite=None` outside production all fail at startup
  (`config.py:68-91`). That is exactly the right posture.
- **Access token in memory, refresh in an httpOnly cookie** — correct for a
  hosted app.
- **`pool_pre_ping=True`** handles MySQL dropping idle connections, so you won't
  get "MySQL server has gone away" after quiet periods.
- **JSON columns** are fine on MySQL 8.
- The month-grouping query in `revenue_service` already switches
  `strftime`↔`date_format` by dialect; the other `strftime` calls are on Python
  datetimes, not SQL, so they are DB-agnostic.

---

## Status

- **C1** — false alarm; already handled by migrations 0054/0058. No change.
- **C2** — client charset pinned in code ✅. Still run the `ALTER DATABASE/TABLE …
  utf8mb4` on the server if the DB wasn't created utf8mb4.
- **H1, H2, M1, M3** — these are **environment/config**, not code. Do these on your
  host:
  - **H1 (split hosting only):** set `APP_ENVIRONMENT=production`,
    `REFRESH_COOKIE_SAMESITE=none`, `CORS_ORIGINS=https://<frontend>`, and build the
    frontend with `VITE_API_BASE_URL=https://<backend>`. Skip on same-origin
    VPS+Nginx.
  - **H2:** confirm the persistent disk is mounted at your `STORAGE_DIR`.
  - **M1:** `alembic current` should equal head; check `test_attempts` has the
    generated `original_attempt_slot`/`active_attempt_slot` columns on MySQL.
  - **M3:** drop the GeoLite2 `.mmdb` at `GEOIP_DB_PATH` for session locations.

The only code fix warranted was C2, which is done. C1 was already solved by the
team's earlier MySQL work.
