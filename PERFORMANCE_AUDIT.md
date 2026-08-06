# Performance audit — Visa House LMS

Static analysis of the request path, database query patterns and the frontend
render/observer costs. Ordered by impact. Items marked **[fixed]** are applied
in this pass; the rest are recommendations, kept as recommendations because they
touch query logic or the logs UI and I could not run the app to verify them.

The backend cannot be executed in this environment (no PyPI), so none of this is
profiler-measured — it is read from the code. Every claim cites a file and line.

---

## H1 — Every request writes two near-identical log rows **[fixed]**

`middleware/request_logging.py:84-108` inserts **both** an `ApiLog` and a
`RequestLog` on every request that is not developer/skip-listed, then commits.
The two rows carry the same method, path, status, latency, user_id and ip; only
`RequestLog` adds user-agent and byte counts.

That is two INSERTs plus a COMMIT on the hot path of **every** API call. On a
busy platform this is the single largest avoidable write load, and it grows two
log tables in lockstep. Both are surfaced separately in the Logs UI
(`services/log_service.py:15`, types `api` and `request`), which is the only
reason to keep them distinct.

**Fixed.** The `ApiLog` write is removed - only `RequestLog` (the superset) is
written now, halving per-request inserts. The redundant "API" tab is dropped
from the Logs UI; "Request" shows the same data. `api_logs` is left in place with
its history and can be dropped in a later migration once you are sure nothing
external reads it.

---

## H2 — Grading queue is N+1 on the student and the institute check **[fixed]**

`services/grading_service.py:297` builds the queue as:

```python
[a for a in query...all() if can_grade_attempt(db, actor, a)]
```

`can_grade_attempt` (line 52) reads `attempt.user.institute_id` — a lazy load
per attempt, since the query joins `User` for filtering but never eager-loads it
— and for an SA instructor calls `_institute_has_active_instructor(db, ...)`,
which is a fresh query **per attempt**. A queue of N attempts therefore issues up
to 2N extra queries, and the later `attempt.part_grades` access adds another
lazy load each.

**Fixed** by eager-loading `user` and `part_grades`, and memoising the
institute-has-instructor check for the duration of one request so the same
institute is queried once, not once per attempt.

---

## H3 — Institute list is N+1 across several tables **[fixed]**

`routers/institutes.py:196` returns `[_serialize(db, i) for i in query.all()]`,
and `_serialize` (`services/institute_service.py:114`) runs, per institute:
`current_subscription`, a branding query, an admin query, a modules query, and
more. Listing M institutes is M × (~5 queries).

**Fixed.** `list_institutes` now builds a prefetch (subscriptions via a new
`current_subscription_map`, plus branding, admins, module ids, latest payment and
plans - one query each, keyed by institute id) and the serializer reads from it.
Single-institute calls are unchanged: `_serialize` still does the direct queries
when no prefetch is passed. ~5M queries become ~6.

---

## M1 — The mobile-table observer re-scans the whole document **[fixed]**

`components/ResponsiveTableCards.tsx:58` attaches a `MutationObserver` to
`document.body` with `subtree: true`, and every mutation triggers
`applyResponsiveTableCards()`, which runs `document.querySelectorAll("table")`
and re-derives labels for **every table on the page**. Route changes and list
renders add many nodes, so the whole-document table scan runs repeatedly during
ordinary navigation.

**Fixed** by debouncing the callback (rapid mutation bursts collapse to one scan
after they settle) instead of scheduling a scan per animation frame.

---

## M2 — bcrypt work factor on the hot login path

`core/security.py:20` hashes login passwords at bcrypt's default cost (12).
That is correct for security, and is called once per login, so it is not a
per-request cost — noted only so it is not mistaken for one. The raised cost (14)
is reserved for the shutdown password, which is right. **No change.**

---

## M3 — Per-request middleware database reads

The maintenance/read-only gate (`main.py`) opens a DB session on every
non-exempt request to read two settings. It is cached in-process for 10 seconds
(`core/maintenance.py`), so the DB is hit at most once per 10s per worker, not
per request — acceptable. The developer-action and impersonation checks decode
the JWT per request, which is cheap (no DB). **No change**, documented so the
caching is not removed by accident.

---

## L1 — Traffic beacon and status poll

The page-view beacon fires once per route change via `sendBeacon`
(`utils/traffic.ts`), and the maintenance-status poll runs every 30s
(`MaintenanceNotice.tsx`). Both are light and correctly out of the render path.
Each beacon is one row insert; if traffic grows very large, add a periodic prune
of `traffic_events` older than N days. **No change now.**

---

## What is already good

- Hot foreign keys on `test_attempts` and `payments` are indexed
  (`models/attempt.py`, `models/payment.py`), and `traffic_events` is indexed on
  the columns its aggregates group by.
- The revenue summary computes its breakdowns in SQL aggregates rather than
  pulling rows into Python.
- List endpoints that resolve actor emails do so in one `IN (...)` query, not per
  row (e.g. `developer_ops_service.audit_trail`).
- The frontend lazy-loads every route, so the initial bundle is small.

---

## Status

All four flagged items are now fixed: H1 (duplicate log write), H2 (grading
N+1), H3 (institute-list N+1) and M1 (table observer). H2/H3 change query logic
and want a live pass — the app could not be run here, so this is static analysis
plus type/syntax checks only.
