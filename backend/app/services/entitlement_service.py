"""Which modules a direct student may open, and until when.

The rule, in one line: **buying a plan adds that plan's duration to every module
it contains, starting from that module's own current expiry.**

Worked through, because the edges are where this went wrong before. A student
holds Plan A (Reading + Writing, 180 days) bought on 1 January. On 1 March they
buy Plan B (Writing + Speaking, 90 days):

    Reading    only in A     untouched          -> 30 Jun
    Writing    in both       150 left, +90      -> 28 Sep
    Speaking   only in B     new, 90 from today -> 30 May

Writing gains the days of both plans instead of wasting the overlap; Speaking
opens immediately rather than waiting for A to run out; Reading is not disturbed
by a purchase that had nothing to do with it.

Before this module existed, entitlement was read off "the current subscription"
- one row, chosen by furthest expiry - so the same purchase produced one of two
wrong answers depending on which plan happened to be longer: either Reading was
revoked with 150 paid-for days left, or Speaking never appeared at all and the
student's money bought nothing. Both are proven in tests/test_plan_stacking.py.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional, Sequence

from sqlalchemy.orm import Session, joinedload

from app.models.module_entitlement import (
    SOURCE_BACKFILL,
    SOURCE_PLAN,
    ModuleEntitlement,
)
from app.models.plan import Plan
from app.models.subscription import Subscription


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def plan_module_ids(plan: Plan) -> List[int]:
    """Every module a plan grants, directly or through one of its courses.

    A plan can list modules outright and can also bundle courses that contain
    modules; the old access check honoured both, so this must too, or a course-
    only plan would silently grant nothing.
    """
    ids = {module.id for module in plan.modules}
    for course in plan.courses:
        for link in course.course_modules:
            ids.add(link.module_id)
    return sorted(ids)


# --------------------------------------------------------------- granting


def grant_plan(
    db: Session,
    user_id: int,
    plan: Plan,
    *,
    at: Optional[datetime] = None,
    subscription_id: Optional[int] = None,
    source: str = SOURCE_PLAN,
) -> Dict[int, dict]:
    """Stack `plan.duration_days` onto every module the plan contains.

    Returns {module_id: {"from": old_expiry_or_None, "to": new_expiry}} so the
    caller can audit, report or show the student what they just gained.

    `at` exists for the backfill, which replays historical purchases at the date
    they were actually made rather than today. Everything else leaves it None.
    """
    at = at or _now()
    module_ids = plan_module_ids(plan)
    if not module_ids:
        return {}

    existing = {
        row.module_id: row
        for row in db.query(ModuleEntitlement)
        .filter(
            ModuleEntitlement.user_id == user_id,
            ModuleEntitlement.module_id.in_(module_ids),
        )
        .all()
    }

    changes: Dict[int, dict] = {}
    for module_id in module_ids:
        row = existing.get(module_id)
        previous = row.expires_at if row is not None else None
        # The whole rule is this one line. Start from whichever is later - the
        # module's own remaining validity, or now - so unexpired days are
        # carried forward and long-lapsed ones are not resurrected.
        base = max(at, previous) if previous is not None else at
        new_expiry = base + timedelta(days=plan.duration_days)

        if row is None:
            row = ModuleEntitlement(
                user_id=user_id,
                module_id=module_id,
                expires_at=new_expiry,
                source=source,
                last_subscription_id=subscription_id,
                granted_days=plan.duration_days,
                sittings_granted=1,
            )
            db.add(row)
        else:
            row.expires_at = new_expiry
            row.last_subscription_id = subscription_id
            row.granted_days = (row.granted_days or 0) + plan.duration_days
            # Paying again buys another go at the test, not just more days to
            # look at a paper already sat.
            row.sittings_granted = (row.sittings_granted or 0) + 1
            if source == SOURCE_BACKFILL and row.source != SOURCE_BACKFILL:
                pass  # a real purchase outranks a rebuild; leave the source
            else:
                row.source = source
            db.add(row)

        changes[module_id] = {
            "from": previous,
            "to": new_expiry,
            "sittings": row.sittings_granted,
        }

    db.flush()
    return changes


# ---------------------------------------------------------------- reading


def entitled_module_ids(db: Session, user_id: int, *, at: Optional[datetime] = None) -> set:
    at = at or _now()
    rows = (
        db.query(ModuleEntitlement.module_id)
        .filter(
            ModuleEntitlement.user_id == user_id,
            ModuleEntitlement.expires_at > at,
        )
        .all()
    )
    return {row[0] for row in rows}


def module_expiry(db: Session, user_id: int, module_id: int) -> Optional[datetime]:
    row = (
        db.query(ModuleEntitlement)
        .filter(
            ModuleEntitlement.user_id == user_id,
            ModuleEntitlement.module_id == module_id,
        )
        .first()
    )
    return row.expires_at if row is not None else None


def has_entitlement(db: Session, user_id: int, module_id: int, *, at: Optional[datetime] = None) -> bool:
    expiry = module_expiry(db, user_id, module_id)
    return expiry is not None and expiry > (at or _now())


def entitlements_for(db: Session, user_id: int) -> List[dict]:
    """Every module the student holds, for the "my plan" screen.

    Expired rows are included deliberately: a student who let a module lapse
    should see that it lapsed and when, rather than have it vanish and look
    like a billing error.
    """
    now = _now()
    rows = (
        db.query(ModuleEntitlement)
        .options(joinedload(ModuleEntitlement.module))
        .filter(ModuleEntitlement.user_id == user_id)
        .order_by(ModuleEntitlement.expires_at.desc())
        .all()
    )
    return [
        {
            "module_id": row.module_id,
            "module_title": row.module.title if row.module else None,
            "module_type": row.module.module_type if row.module else None,
            "expires_at": row.expires_at,
            "is_live": row.expires_at > now,
            "days_remaining": max(0, (row.expires_at - now).days),
            "total_days_granted": row.granted_days,
        }
        for row in rows
    ]


# --------------------------------------------------------------- rebuild


def replay_subscriptions(
    db: Session,
    user_id: int,
    subscriptions: Sequence[Subscription],
    *,
    dry_run: bool = False,
) -> Dict[int, dict]:
    """Rebuild one student's ledger from their purchase history.

    Replays in purchase order, at the date each purchase was made, so the
    arithmetic is the same one that would have run had this module existed at
    the time. Sequential purchases therefore land where they should; only
    genuinely overlapping ones produce extra days, which is the point - those
    are the days the student paid for and never received.
    """
    ordered = sorted(subscriptions, key=lambda s: (s.starts_at, s.id))
    total: Dict[int, dict] = {}
    for subscription in ordered:
        if subscription.cancelled_at is not None or subscription.plan is None:
            continue
        changes = grant_plan(
            db,
            user_id,
            subscription.plan,
            at=subscription.starts_at,
            subscription_id=subscription.id,
            source=SOURCE_BACKFILL,
        )
        for module_id, change in changes.items():
            if module_id in total:
                total[module_id]["to"] = change["to"]
            else:
                total[module_id] = dict(change)
    if dry_run:
        db.rollback()
    return total


def direct_student_ids_with_subscriptions(db: Session) -> List[int]:
    rows = (
        db.query(Subscription.user_id)
        .filter(Subscription.user_id.isnot(None))
        .distinct()
        .all()
    )
    return sorted({row[0] for row in rows})


def subscriptions_for_user(db: Session, user_id: int) -> List[Subscription]:
    return (
        db.query(Subscription)
        .options(
            joinedload(Subscription.plan).joinedload(Plan.modules),
            joinedload(Subscription.plan).joinedload(Plan.courses),
        )
        .filter(Subscription.user_id == user_id)
        .order_by(Subscription.starts_at, Subscription.id)
        .all()
    )


def iter_users_with_overlap(db: Session) -> Iterable[int]:
    """Students whose purchases overlap - the ones the old code short-changed."""
    for user_id in direct_student_ids_with_subscriptions(db):
        subs = [s for s in subscriptions_for_user(db, user_id) if s.cancelled_at is None]
        if len(subs) < 2:
            continue
        subs.sort(key=lambda s: s.starts_at)
        if any(subs[i + 1].starts_at < subs[i].expires_at for i in range(len(subs) - 1)):
            yield user_id


def sittings_granted(db: Session, user_id: int, module_id: int) -> int:
    """How many times this student has bought the right to sit this test."""
    row = (
        db.query(ModuleEntitlement)
        .filter(
            ModuleEntitlement.user_id == user_id,
            ModuleEntitlement.module_id == module_id,
        )
        .first()
    )
    return row.sittings_granted if row is not None else 0


def sittings_remaining(db: Session, user_id: int, module_id: int) -> int:
    """Sittings bought, minus sittings used.

    Retake sittings are excluded from the count of "used" because an approved
    Retake Request is a separate grant - a goodwill re-sit after something went
    wrong - and consuming a purchased sitting to honour one would charge the
    student for the platform's own mistake.
    """
    from app.models.attempt import TestAttempt

    granted = sittings_granted(db, user_id, module_id)
    if granted <= 0:
        return 0
    used = (
        db.query(TestAttempt)
        .filter(
            TestAttempt.user_id == user_id,
            TestAttempt.module_id == module_id,
            TestAttempt.is_retake.is_(False),
            TestAttempt.status.notin_(["cancelled", "ready"]),
        )
        .count()
    )
    return max(0, granted - used)
