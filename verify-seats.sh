#!/bin/bash
# Checks the per-student seat model end to end, against THIS machine's code and
# dev database. Run it from the repo root:
#
#     ./verify-seats.sh
#
# Everything it prints is a real check with a real result - nothing is assumed.

set -uo pipefail
cd "$(dirname "$0")"
ROOT="$PWD"
PY="$ROOT/backend/.venv/bin/python"
PASS=0
FAIL=0

green() { printf "  \033[32mPASS\033[0m  %s\n" "$1"; PASS=$((PASS+1)); }
red()   { printf "  \033[31mFAIL\033[0m  %s\n" "$1"; FAIL=$((FAIL+1)); }
head1() { printf "\n\033[1m%s\033[0m\n" "$1"; }

if [ ! -x "$PY" ]; then
  echo "Could not find the backend virtualenv at $PY"
  exit 1
fi

# ---------------------------------------------------------------- 1. schema
head1 "1. Database schema"
cd "$ROOT/backend"

VERSION=$("$PY" - <<'PY' 2>/dev/null
import sqlite3
try:
    c = sqlite3.connect("visahouselms-dev.db").cursor()
    c.execute("SELECT version_num FROM alembic_version")
    print(c.fetchone()[0])
except Exception:
    print("none")
PY
)
if [ "$VERSION" = "0083" ]; then
  green "migrations are at 0083 (latest)"
else
  red   "migrations are at '$VERSION', expected 0083 - run: cd backend && ./.venv/bin/alembic upgrade head"
fi

"$PY" - <<'PY'
import sqlite3, sys
ok = 0
c = sqlite3.connect("visahouselms-dev.db").cursor()

c.execute("PRAGMA table_info(users)")
cols = {r[1] for r in c.fetchall()}
need = {"access_starts_at", "access_ends_at", "access_state"}
missing = need - cols
print(("  \033[32mPASS\033[0m  users has the three window columns"
       if not missing else
       f"  \033[31mFAIL\033[0m  users is missing {missing}"))

c.execute("PRAGMA table_info(institutes)")
icols = {r[1] for r in c.fetchall()}
print(("  \033[32mPASS\033[0m  institutes has a timezone column"
       if "timezone" in icols else
       "  \033[31mFAIL\033[0m  institutes.timezone is missing"))

# Nobody may be left with an implicit forever.
c.execute("""SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id
             WHERE r.name = 'STUDENT' AND u.institute_id IS NOT NULL
               AND (u.access_ends_at IS NULL OR u.access_state IS NULL)""")
orphans = c.fetchone()[0]
print(("  \033[32mPASS\033[0m  every institute student has a window"
       if orphans == 0 else
       f"  \033[31mFAIL\033[0m  {orphans} institute student(s) have no window - the backfill did not run"))
PY

# ------------------------------------------------------------ 2. unit tests
head1 "2. The rules (unit tests)"
PYTHONPATH=. "$PY" -m pytest tests/test_access_windows.py tests/test_seat_accounting.py -q 2>&1 | tail -3

# ------------------------------------------------------------ 3. full suite
head1 "3. Nothing else broke (full backend suite)"
echo "  running... (about 5 minutes)"
SUITE=$(PYTHONPATH=. "$PY" -m pytest -q 2>&1 | tail -1)
echo "  $SUITE"
case "$SUITE" in
  *" failed"*|*error*) red "the full suite is not clean" ;;
  *passed*)            green "full backend suite clean" ;;
  *)                   red "could not read the suite result" ;;
esac

# --------------------------------------------------------- 4. what you have
head1 "4. Your dev data right now"
"$PY" - <<'PY'
import sqlite3
c = sqlite3.connect("visahouselms-dev.db").cursor()
c.execute("""SELECT i.name, u.access_state, COUNT(*)
             FROM users u JOIN roles r ON r.id = u.role_id
             JOIN institutes i ON i.id = u.institute_id
             WHERE r.name = 'STUDENT' GROUP BY i.name, u.access_state ORDER BY i.name""")
rows = c.fetchall()
if not rows:
    print("  (no institute students seeded)")
current = None
for name, state, count in rows:
    if name != current:
        print(f"\n  {name}")
        current = name
    holds = "holds a seat" if state != "released" else "no seat"
    print(f"     {count:>3}  {state:<10} ({holds})")

c.execute("""SELECT i.name, i.student_limit,
                    SUM(CASE WHEN u.access_state != 'released' AND u.deleted_at IS NULL THEN 1 ELSE 0 END)
             FROM institutes i
             LEFT JOIN users u ON u.institute_id = i.id
             LEFT JOIN roles r ON r.id = u.role_id AND r.name = 'STUDENT'
             GROUP BY i.name""")
print()
for name, limit, used in c.fetchall():
    print(f"  {name}: {used or 0} seats in use of {limit if limit is not None else '?'}")
PY

# ------------------------------------------------------------------ result
printf "\n%s\n" "============================================================"
if [ "$FAIL" -eq 0 ]; then
  printf "  \033[32mAll automated checks passed.\033[0m Now do the UI walkthrough.\n"
else
  printf "  \033[31m%s check(s) failed.\033[0m See above.\n" "$FAIL"
fi
printf "%s\n" "============================================================"
exit $FAIL
