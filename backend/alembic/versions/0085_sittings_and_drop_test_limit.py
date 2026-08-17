"""Buying a plan again buys another sitting; and plans/institutes lose test_limit.

Two changes, both about the same thing: what a purchase actually entitles you to.

**sittings_granted.** A test could be sat exactly once, ever. The only way back
in was a Retake Request - a goodwill workflow for when something went wrong,
approved by staff. So a student who bought the same plan a second time paid full
price and received more days to look at a paper they had already sat, and
nothing else. Each purchase now grants one sitting per module it contains, and
they accumulate the same way the days do.

The backfill counts, per student and per module, how many non-cancelled
purchases included it - so someone who bought a plan three times ends up with
three sittings, which is what they paid for. Anyone with a single purchase is
left at one, exactly as before.

**test_limit.** A column on both `plans` and `institutes`, editable in the admin
UI, rendered to buyers as "Unlimited mock tests" or "N mock tests per cycle" -
and read by nothing. No code ever enforced it. A number an admin can set that
changes nothing is worse than no number at all: it reads as a working cap, and
the customer-facing feature line built from it was a claim the product never
kept. Sittings are per module and per purchase, which is what the new column
above actually counts.

Revision ID: 0085
Revises: 0084
Create Date: 2026-08-16
"""
import sqlalchemy as sa
from alembic import op

revision = "0085"
down_revision = "0084"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    me_cols = {c["name"] for c in insp.get_columns("module_entitlements")} if "module_entitlements" in insp.get_table_names() else set()
    if "sittings_granted" not in me_cols:
        with op.batch_alter_table("module_entitlements") as batch:
            batch.add_column(
                sa.Column("sittings_granted", sa.Integer(), nullable=False, server_default="1")
            )

    # One sitting per purchase that included the module. Counted from the same
    # plan->module mapping the entitlement backfill used, courses included, so
    # the two cannot disagree about what a plan contains.
    plan_modules: dict = {}
    for plan_id, module_id in bind.execute(
        sa.text("SELECT plan_id, module_id FROM plan_modules")
    ).fetchall():
        plan_modules.setdefault(plan_id, set()).add(module_id)
    for plan_id, module_id in bind.execute(
        sa.text(
            "SELECT pc.plan_id, cm.module_id FROM plan_courses pc "
            "JOIN course_modules cm ON cm.course_id = pc.course_id"
        )
    ).fetchall():
        plan_modules.setdefault(plan_id, set()).add(module_id)

    if plan_modules:
        counts: dict = {}
        for user_id, plan_id in bind.execute(
            sa.text(
                "SELECT user_id, plan_id FROM subscriptions "
                "WHERE user_id IS NOT NULL AND cancelled_at IS NULL"
            )
        ).fetchall():
            for module_id in plan_modules.get(plan_id, ()):  # noqa: B905
                counts[(user_id, module_id)] = counts.get((user_id, module_id), 0) + 1

        update = sa.text(
            "UPDATE module_entitlements SET sittings_granted = :count "
            "WHERE user_id = :user_id AND module_id = :module_id"
        )
        for (user_id, module_id), count in counts.items():
            if count > 1:
                bind.execute(
                    update, {"count": count, "user_id": user_id, "module_id": module_id}
                )

    # ---- one row per purchased sitting --------------------------------
    ta_cols = {c["name"] for c in insp.get_columns("test_attempts")} if "test_attempts" in insp.get_table_names() else set()
    if "sitting_number" not in ta_cols:
        with op.batch_alter_table("test_attempts") as batch:
            batch.add_column(
                sa.Column("sitting_number", sa.Integer(), nullable=False, server_default="1")
            )

    indexes = [idx["name"] for idx in insp.get_indexes("test_attempts")] if "test_attempts" in insp.get_table_names() else []
    if "uq_test_attempt_original_user_module" in indexes:
        op.drop_index("uq_test_attempt_original_user_module", table_name="test_attempts")
        op.create_index(
            "uq_test_attempt_original_user_module",
            "test_attempts",
            ["user_id", "module_id", "sitting_number"],
            unique=True,
            sqlite_where=sa.text("is_retake = 0"),
            postgresql_where=sa.text("is_retake = false"),
        )

    # ---- drop the column nothing reads --------------------------------
    plan_cols = {c["name"] for c in insp.get_columns("plans")} if "plans" in insp.get_table_names() else set()
    if "test_limit" in plan_cols:
        with op.batch_alter_table("plans") as batch:
            batch.drop_column("test_limit")

    inst_cols = {c["name"] for c in insp.get_columns("institutes")} if "institutes" in insp.get_table_names() else set()
    if "test_limit" in inst_cols:
        with op.batch_alter_table("institutes") as batch:
            batch.drop_column("test_limit")


def downgrade() -> None:
    op.drop_index("uq_test_attempt_original_user_module", table_name="test_attempts")
    op.create_index(
        "uq_test_attempt_original_user_module",
        "test_attempts",
        ["user_id", "module_id"],
        unique=True,
        sqlite_where=sa.text("is_retake = 0"),
        postgresql_where=sa.text("is_retake = false"),
    )
    with op.batch_alter_table("test_attempts") as batch:
        batch.drop_column("sitting_number")
    with op.batch_alter_table("institutes") as batch:
        batch.add_column(sa.Column("test_limit", sa.Integer(), nullable=True))
    with op.batch_alter_table("plans") as batch:
        batch.add_column(
            sa.Column("test_limit", sa.Integer(), nullable=False, server_default="0")
        )
    with op.batch_alter_table("module_entitlements") as batch:
        batch.drop_column("sittings_granted")
