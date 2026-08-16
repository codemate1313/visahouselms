"""module_entitlements, rebuilt from every purchase a direct student ever made.

Access for a direct student used to be read off "the current subscription" - a
single row, chosen by furthest expiry. Holding two plans at once therefore got
exactly one of them honoured, and which one depended on an accident of duration:

  * bought a LONGER second plan -> it became current, and every module that
    existed only in the first plan was revoked while still paid for;
  * bought a SHORTER second plan -> the first stayed current, and the new plan's
    modules never appeared at all. The student paid and received nothing.

This table moves entitlement out of the subscription and onto the module, where
it can stack: buying a plan adds its duration to each module it contains, from
that module's own expiry rather than from today.

The backfill replays each student's purchases in the order they were made, at
the date they were made, applying that same rule - so the ledger ends up holding
what the student should have had all along. Sequential purchases land exactly
where they already were; only genuinely overlapping ones gain days, and those
are precisely the days that were paid for and never delivered.

Nothing is destroyed: subscriptions are untouched and remain the record of what
was bought. Downgrade drops the table and access falls back to the live union of
plans, which is still better than the single-row check this replaces.

Revision ID: 0084
Revises: 0083
Create Date: 2026-08-16
"""
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa
from alembic import op

revision = "0084"
down_revision = "0083"
branch_labels = None
depends_on = None


def _as_datetime(value):
    """SQLite returns timestamps as strings, MySQL as datetimes."""
    if value is None or isinstance(value, datetime):
        return value
    text = str(value).strip().replace("T", " ")
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def upgrade() -> None:
    op.create_table(
        "module_entitlements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "module_id",
            sa.Integer(),
            sa.ForeignKey("exam_modules.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False, server_default="plan"),
        sa.Column(
            "last_subscription_id",
            sa.Integer(),
            sa.ForeignKey("subscriptions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("granted_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("user_id", "module_id", name="uq_module_entitlement_user_module"),
    )
    op.create_index("ix_module_entitlements_user_id", "module_entitlements", ["user_id"])
    op.create_index("ix_module_entitlements_module_id", "module_entitlements", ["module_id"])
    op.create_index(
        "ix_module_entitlement_user_expiry", "module_entitlements", ["user_id", "expires_at"]
    )

    bind = op.get_bind()

    # ---- what each plan grants: its own modules, plus its courses' modules ---
    plan_modules: dict = {}
    for plan_id, module_id in bind.execute(
        sa.text("SELECT plan_id, module_id FROM plan_modules")
    ).fetchall():
        plan_modules.setdefault(plan_id, set()).add(module_id)

    # A course-only plan grants through the bundle, and the old access check
    # honoured that, so the rebuild has to as well or those students lose
    # everything at the moment we switch over.
    for plan_id, module_id in bind.execute(
        sa.text(
            "SELECT pc.plan_id, cm.module_id FROM plan_courses pc "
            "JOIN course_modules cm ON cm.course_id = pc.course_id"
        )
    ).fetchall():
        plan_modules.setdefault(plan_id, set()).add(module_id)

    if not plan_modules:
        return

    durations = {
        row[0]: row[1]
        for row in bind.execute(sa.text("SELECT id, duration_days FROM plans")).fetchall()
    }

    # ---- replay every direct student's purchases, oldest first -------------
    purchases = bind.execute(
        sa.text(
            "SELECT user_id, id, plan_id, starts_at FROM subscriptions "
            "WHERE user_id IS NOT NULL AND cancelled_at IS NULL "
            "ORDER BY user_id, starts_at, id"
        )
    ).fetchall()
    if not purchases:
        return

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    # (user_id, module_id) -> [expires_at, granted_days, last_subscription_id]
    ledger: dict = {}

    for user_id, subscription_id, plan_id, starts_at in purchases:
        module_ids = plan_modules.get(plan_id)
        if not module_ids:
            continue
        days = durations.get(plan_id) or 0
        if days <= 0:
            continue
        bought_at = _as_datetime(starts_at) or now
        for module_id in module_ids:
            key = (user_id, module_id)
            entry = ledger.get(key)
            # The rule, replayed: start from whichever is later - what the
            # student still had of this module, or the day they bought. Days
            # already elapsed are not resurrected; unexpired ones carry over.
            base = max(bought_at, entry[0]) if entry else bought_at
            expiry = base + timedelta(days=days)
            if entry:
                entry[0] = expiry
                entry[1] += days
                entry[2] = subscription_id
            else:
                ledger[key] = [expiry, days, subscription_id]

    if not ledger:
        return

    insert = sa.text(
        "INSERT INTO module_entitlements "
        "(user_id, module_id, expires_at, source, last_subscription_id, granted_days, created_at) "
        "VALUES (:user_id, :module_id, :expires_at, 'backfill', :sub, :days, :now)"
    )
    for (user_id, module_id), (expiry, days, subscription_id) in ledger.items():
        bind.execute(
            insert,
            {
                "user_id": user_id,
                "module_id": module_id,
                "expires_at": expiry,
                "sub": subscription_id,
                "days": days,
                "now": now,
            },
        )


def downgrade() -> None:
    op.drop_index("ix_module_entitlement_user_expiry", table_name="module_entitlements")
    op.drop_index("ix_module_entitlements_module_id", table_name="module_entitlements")
    op.drop_index("ix_module_entitlements_user_id", table_name="module_entitlements")
    op.drop_table("module_entitlements")
