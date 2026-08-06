"""give the account-referencing log tables an explicit ondelete policy

Revision ID: 0062
Revises: 0061
Create Date: 2026-08-05

Four tables point at `users.id` with no `ondelete`: audit_logs, api_logs,
error_logs and user_sessions. With `PRAGMA foreign_keys=ON` (see
app/database.py) the default of NO ACTION means the database refuses to remove
any account that has ever logged in or been recorded doing anything - which is
every real account.

Account deletion is now a soft delete, so nothing depends on this being fixed;
the row survives and the references stay valid. This migration is about the
next person. An explicit policy states the intent at the schema level, so a
future hard delete - a GDPR erasure job, a test fixture teardown - behaves
predictably instead of failing on a constraint nobody knew was there.

The three log tables get SET NULL: the entry is the record of what happened and
outlives the account that caused it, with a null actor meaning "a deleted user".
Their columns are already nullable. Sessions get CASCADE: a session belongs to
its account and is worthless without one.

Deliberately narrow. There are ~37 other FKs without an ondelete, but each needs
its own decision about whether the child should die, be orphaned, or block the
parent, and several are load-bearing for financial history that
`institute_service.delete_institute` currently detaches by hand. Those want
individual review, not a sweep.

SQLite cannot alter a constraint in place, so batch_alter_table recreates each
table. All four are append-only logs or short-lived session rows; none is
referenced by anything else, which is what makes the recreate safe here.
"""
from alembic import op
import sqlalchemy as sa

revision = "0062"
down_revision = "0061"
branch_labels = None
depends_on = None


# table -> (constraint name, ondelete policy)
TARGETS = [
    ("audit_logs", "fk_audit_logs_user_id_users", "SET NULL"),
    ("api_logs", "fk_api_logs_user_id_users", "SET NULL"),
    ("error_logs", "fk_error_logs_user_id_users", "SET NULL"),
    ("user_sessions", "fk_user_sessions_user_id_users", "CASCADE"),
]


def _existing_tables(bind) -> set:
    return set(sa.inspect(bind).get_table_names())


def upgrade() -> None:
    bind = op.get_bind()
    present = _existing_tables(bind)
    inspector = sa.inspect(bind)

    for table, constraint, ondelete in TARGETS:
        if table not in present:
            # Log tables are created by earlier revisions that a partial
            # environment may not have run; skipping keeps this idempotent
            # rather than failing the whole upgrade on a missing table.
            continue

        # user_sessions.user_id is NOT NULL and must stay that way; the log
        # tables are already nullable, which is what SET NULL requires.
        nullable = table != "user_sessions"

        existing_fks = inspector.get_foreign_keys(table) if bind.dialect.name != "sqlite" else []
        user_fk = next((fk for fk in existing_fks if fk.get("constrained_columns") == ["user_id"]), None)
        fk_to_drop = user_fk.get("name") if user_fk else None

        with op.batch_alter_table(table) as batch:
            if bind.dialect.name != "sqlite" and fk_to_drop:
                batch.drop_constraint(fk_to_drop, type_="foreignkey")
            batch.alter_column("user_id", existing_type=sa.Integer(), nullable=nullable)
            batch.create_foreign_key(
                constraint,
                "users",
                ["user_id"],
                ["id"],
                ondelete=ondelete,
            )


def downgrade() -> None:
    bind = op.get_bind()
    present = _existing_tables(bind)

    for table, constraint, _ondelete in TARGETS:
        if table not in present:
            continue
        with op.batch_alter_table(table) as batch:
            if bind.dialect.name != "sqlite":
                batch.drop_constraint(constraint, type_="foreignkey")
            batch.create_foreign_key(constraint, "users", ["user_id"], ["id"])
