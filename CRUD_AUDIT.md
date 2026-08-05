# CRUD audit — Visa House LMS

> **Status: fixed.** H1, H2, M1, M3, M4 and L1 are resolved; M2 is partly done.
> The findings below are kept as the record of what was wrong and why the fix
> takes the shape it does. See "What was changed" at the end.


Scope: every create/update/delete path in `backend/app/services` and `backend/app/routers`,
the foreign-key graph in `backend/app/models`, and the 138 mutation call sites in the
frontend. Focus is on what happens *around* a write — what it depends on, what it leaves
behind, and what the caller is told when it fails.

Findings are ordered by severity. Each one names the file and what to change.

---

## H1 — Three of the four user-delete paths will fail with a 500

**Files**
- `services/super_admin_service.py:327` — `delete_super_admin`
- `services/super_admin_service.py:901` — direct-student delete
- `services/institute_admin_service.py:476` — institute member delete
- `services/instructor_service.py:291` — **the one that is correct**

`instructor_service` does this before `db.delete(user)`:

```python
db.query(ApiLog).filter(ApiLog.user_id == user.id).update({"user_id": None})
db.query(AuditLog).filter(AuditLog.user_id == user.id).update({"user_id": None})
db.query(ErrorLog).filter(ErrorLog.user_id == user.id).update({"user_id": None})
db.query(UserSession).filter(UserSession.user_id == user.id).delete()
db.delete(user)
```

The other three call `db.delete(user)` with none of it.

`institute_admin_service.delete_member` looks like the exception — it calls
`account_service.revoke_all_sessions` first (line 467). It is not. That helper sets
`session.revoked_at = now` (`account_service.py:201-206`); it does not delete the rows.
`user_sessions.user_id` is `nullable=False` with no `ondelete`, so the rows it leaves
behind block the delete just the same. Revoking is not deleting, and here the difference
is the whole bug.

Those four tables all reference `users.id` with **no `ondelete`**
(`models/audit_log.py:14`, `models/api_log.py:18`, `models/error_log.py:19`,
`models/user_session.py:17`), and SQLite foreign keys are explicitly enabled
(`database.py:18`, `PRAGMA foreign_keys=ON`). With no `ondelete`, the default is
`NO ACTION` — the delete is refused.

So deleting any user who has ever logged in (session row), performed an audited action,
or triggered an API/error log raises `IntegrityError`. In practice that is every real
account; only a freshly created, never-used one would delete cleanly. That is very likely
why deletes appear to work in testing and fail on real data.

The fact that the correct version clears exactly those four tables, and the others clear
none, reads as three copies that were never finished rather than a deliberate difference.

**Fix.** Extract the cleanup from `instructor_service` into one helper and call it from all
four paths. Better still, add `ondelete="SET NULL"` to the three log FKs and
`ondelete="CASCADE"` to `user_sessions.user_id`, so the database enforces it and no future
delete path can forget.

---

## H2 — A constraint violation anywhere becomes a 500

`IntegrityError` is caught in exactly one file in the entire backend
(`services/attempt_service.py:215`). Every other unique-constraint or foreign-key
violation propagates uncaught and surfaces as `500 Internal Server Error`.

This is what turns H1 from "a refused delete" into "the app is broken". It also means any
race on a unique column — two admins creating the same email at once, which the
pre-checks in `super_admin_service`, `institute_admin_service` and `instructor_service`
cannot prevent — returns a 500 rather than a 409.

**Fix.** One exception handler in `main.py` mapping `IntegrityError` to `409 Conflict`
with a safe message, plus a rollback. Roughly ten lines, and it converts a whole class of
crash into a handled error.

---

## M1 — Five different meanings of "delete a user"

| Path | Semantics | Guards |
|---|---|---|
| `institute_service.py:625` delete institute admin | **Soft** — `is_active=False`, `deleted_at=now`, sessions revoked | Owner protected, refuses last active admin |
| `instructor_service.py:291` | **Hard** | Refuses if the instructor owns courses or modules |
| `super_admin_service.py:327` | **Hard** | Not self, not owner |
| `super_admin_service.py:901` direct student | **Hard** | None |
| `institute_admin_service.py:476` | **Hard** | Sessions revoked (not deleted — see H1) |

`users.deleted_at` exists and is indexed (`models/user.py:33`) and the seat counter relies
on it (`dependencies/limits.py:40`), but only one of the five paths ever sets it. The
other four destroy the row, so a deleted student's history is gone while a deleted
institute admin's is retained.

`institute_service.delete_institute` already contains a complete, correct implementation
of user teardown — `_delete_user_operational_data`, covering 30+ tables including attempts,
answers, grading queue, enrollments and notifications. **It is called from exactly one
place.** The single-user delete paths do not use it.

**Fix.** Decide soft or hard once. If soft, the other four set `deleted_at` and every list
query filters it. If hard, they all route through `_delete_user_operational_data`.

---

## M2 — 41 of 114 foreign keys have no `ondelete`

73 FKs declare `ondelete` (48 `CASCADE`, 24 `SET NULL`, 1 `RESTRICT`). The remaining 41 do
not, which means the database refuses the parent delete rather than cascading or nulling.
Beyond the four in H1, the notable ones are:

- `users.institute_id`, `users.role_id` (`models/user.py:16-17`)
- `subscriptions.institute_id`, `.user_id`, `.plan_id` (`models/subscription.py:17-22`)
- `institute_branding.institute_id` — `unique`, `NOT NULL` (`models/institute_branding.py:14`)
- nine FKs on `payments` (`models/payment.py:16-41`)
- every `created_by_id` / `uploaded_by_id` / `assigned_by_id` across courses, modules,
  assessments and announcements

`delete_institute` works around this by hand — nulling payment and subscription FKs and
snapshotting the institute name before deleting. That is careful code, but it is
compensating for the schema rather than being supported by it.

**Fix.** Audit the 41 and give each an explicit policy. Ownership columns
(`created_by_id`) want `SET NULL`; child rows want `CASCADE`. This is a migration, so it
needs care — but leaving it implicit is what produced H1.

---

## M3 — 20 frontend mutations fail silently

Of 138 mutation call sites, 20 have neither a surrounding `try/catch` nor a `.catch()`:

```
pages/institute/StudentOverview/index.tsx:67, 78, 85
pages/institute/InstituteMembers/index.tsx:162, 177
pages/super-admin/SuperAdminTestimonials/index.tsx:96, 111, 124
pages/super-admin/InstituteForm/index.tsx:338, 343, 364, 372
pages/super-admin/SuperAdminBlogs/index.tsx:38, 52
pages/super-admin/SuperAdminBlogForm/index.tsx:54
pages/super-admin/Institutes/index.tsx:148, 174
```

The typical shape is:

```ts
apiClient.delete(`/super-admin/blogs/${id}`).then(() => { fetchItems(); });
```

The response interceptor in `api/client.ts:146` handles 401 refresh and then
`Promise.reject`s — it does not raise a toast. So when one of these fails, the refetch
never runs, no message appears, and the row is still on screen. The user's reasonable
conclusion is that the delete worked and the list is stale.

This compounds H1 directly: the delete 500s, and the UI says nothing.

**Fix.** Either add `.catch(err => showError(extractErrorMessage(err)))` at these 20 sites,
or add a default error toast in the interceptor and let call sites opt out.

---

## M4 — Deactivating a user does not free a seat

`dependencies/limits.py:29-43` counts seats with:

```python
User.institute_id == institute_id,
User.role_id.in_(role_ids),
User.deleted_at.is_(None),
```

`is_active` is not considered, so a deactivated student still occupies a seat.

That collides with the guidance the API itself gives — `instructor_service.py:281` refuses
a delete with *"deactivate the account instead"*. An institute at its cap that follows
that advice cannot then onboard the replacement.

This may be intentional (a seat is a seat, whether or not it is in use). But it is
undocumented and the two behaviours point in opposite directions.

**Fix.** Decide and write it down. If deactivated accounts should not hold seats, add
`User.is_active.is_(True)`. If they should, say so in the error message when the cap is hit,
so an admin knows deactivating will not help.

---

## L1 — Deleting a GST rate silently reprices plans

`services/gst_service.py:68` deletes a rate with no dependants check, and
`models/plan.py:55` references it as `ondelete="SET NULL"`. So deleting a rate that is in
use nulls `plan.gst_rate_id` and the affected plans quietly fall to zero GST.

Every comparable delete in the codebase guards against exactly this —
`plan_service.py:380` refuses if subscriptions exist, `coupon_service.py:160` if payments
reference it, `course_service.py:485` checks four separate dependants,
`payment_method_service.py:73` checks payments. GST is the one that does not.

**Fix.** Match the others: count plans on the rate and refuse with a 400 if any exist.

---

## What is already right

Worth stating, because it is most of the surface:

- **Dependant guards on non-user deletes.** Plans, coupons, courses, modules and payment
  methods all refuse deletion while something references them, with clear 400s.
- **`delete_institute`** is genuinely careful: it retains financial history by detaching
  and snapshotting rather than deleting, cancels subscriptions with a timestamp, and
  removes storage artefacts.
- **Email uniqueness** is pre-checked on every account-creation path.
- **Audit logging** is written before the mutation and inside the same transaction, so an
  audit row cannot survive a rolled-back change.
- **Module deletion** is restricted to drafts, so published content with attempts against
  it cannot vanish.

---

## Suggested order

1. **H2** — the global `IntegrityError` handler. Smallest change, stops the 500s, and makes
   everything below diagnosable instead of opaque.
2. **H1** — the shared user-teardown helper. This is the live bug.
3. **M3** — error handling on the 20 silent mutations, so failures are visible.
4. **M1** — decide soft vs hard delete and make the five paths agree.
5. **M2** — the FK migration, once the above have stopped the bleeding.
6. **M4 / L1** — small and self-contained.

## Caveats

Static analysis only. The backend was never executed — this sandbox has no PyPI access, so
the app cannot be imported and no query was run against a real database. Every claim above
is traceable to the cited line, but **H1 in particular deserves one manual confirmation**:
create a Super Admin, sign in as them, sign out, then delete them. That should reproduce
the 500.

---

# What was changed

Two decisions drove the shape of this: **accounts are soft-deleted**, and **a seat
stays claimed while the account exists**.

## H2 — `IntegrityError` → 409 (`app/main.py`)

A handler above the catch-all `Exception` handler. Records the driver's message to the
error log, returns a generic 409 to the caller. The driver text names tables and
constraints, so it is logged rather than forwarded.

## H1 + M1 — one soft delete, five paths (`services/account_service.py`)

New `soft_delete_user(db, user)`:

- sets `deleted_at`, sets `is_active = False`
- **deletes** session rows (revoking leaves the row, and a revoked row still blocked the
  FK — that was the bug hiding inside `institute_admin_service`)
- releases the email to `deleted+{id}@deleted.invalid`, so the address can be used again;
  `.invalid` is reserved by RFC 2606 and can never collide with a real one
- idempotent, so a double-submitted delete cannot mangle the stored address

Called from all five paths — `super_admin_service` ×2, `institute_admin_service`,
`instructor_service`, and `institute_service.delete_institute_admin` (which already
soft-deleted, and is now routed through the helper so there is one definition).

Each caller writes its audit entry **before** calling it, because the helper releases the
email and the log needs the real one.

Two things were removed from `instructor_service`, both obsolete once the row survives:

- the guard refusing to delete an instructor who had authored content — it existed because
  `created_by_id` would have dangled
- the nulling of `user_id` on that account's API, audit and error logs — damage control for
  the hard delete, and destructive of the very history soft delete preserves

**Listings had to follow.** Retired accounts are now excluded from `instructor_service`
`_base_query`, `super_admin_service` (both lists and both `*_or_404` lookups),
`institute_admin_service._member_query`, `institute_service._serialize` and
`onboarding_service._admin` — by id as well as in lists, so a stale URL cannot reach one.

`_member_query` takes `include_deleted` rather than filtering unconditionally: the members
roster already has a "Deleted" tab, and a hard filter would have silently emptied it.

Login needed nothing: it already rejects `is_active = False`, and the email no longer matches.

## M3 — silent mutations

Of the 20 reported, **9 were false positives** — `Institutes`, `InstituteMembers` and
others handle failures through `Promise.allSettled` and a shared error banner, which the
heuristic did not recognise. Fixed for real:

- `StudentOverview` — three actions now feed the error banner the page already had
- `SuperAdminBlogs`, `SuperAdminTestimonials` — no error surface at all, so they take a
  toast; includes the testimonial save, which had `.finally` but no `.catch` and so cleared
  its spinner and left the modal open saying nothing

## M4 — seat message (`dependencies/limits.py`)

Behaviour unchanged, per the decision. The cap message now says deactivating does not free
a seat, so an admin at their limit is not sent down a dead end by the advice given
elsewhere. Deleting *does* free one — the counter ignores `deleted_at` rows.

## L1 — GST rate guard (`services/gst_service.py`)

Refuses deletion while plans reference the rate, naming the count. Previously the
`SET NULL` FK let it succeed and quietly drop those plans to zero GST.

## M2 — partly done (`alembic/versions/0062_log_fk_ondelete.py`)

The four FKs behind H1 get an explicit policy: `SET NULL` for audit, API and error logs;
`CASCADE` for sessions. Models updated to match.

**37 FKs still have no `ondelete`,** and that is deliberate. Each needs its own decision
about whether the child should die, be orphaned, or block the parent, and several carry
financial history that `delete_institute` currently detaches by hand. A blind sweep of a
schema I cannot run a migration against would be worse than the gap.

## Not verified

Static analysis and syntax checks only. The backend still cannot be imported here (no PyPI
access), so **nothing below has been executed**. `frontend` type-checks clean.

Worth running locally, in order:

1. `alembic upgrade head` — 0062 uses `batch_alter_table`, which recreates four tables.
   Back up first.
2. Delete a Super Admin who has logged in. Previously a 500; should now succeed.
3. Confirm they vanish from the list, 404 by direct URL, and cannot log in.
4. Confirm their audit history is still attached and their email can be reused.
5. Delete a GST rate that is in use — expect a 400 naming the plan count.
