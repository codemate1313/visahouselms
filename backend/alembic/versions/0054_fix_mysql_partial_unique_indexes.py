"""fix test_attempts unique indexes on MySQL to be partial, not global

MySQL has no native partial/filtered unique index support, so the
sqlite_where / postgresql_where clauses on the two indexes added in 0044
were silently ignored on MySQL, producing plain unique indexes on
(user_id, module_id). That made it impossible to ever start a second
attempt of any kind (final or not) for the same user+module, once the
first attempt row existed - e.g. re-attempting a Speaking test after the
first attempt finished grading failed with an IntegrityError.

This emulates the partial index on MySQL using stored generated columns
that are NULL for rows outside the intended scope; MySQL treats NULLs as
distinct for the purpose of a unique index, so uniqueness is effectively
only enforced among the "in scope" rows, matching sqlite_where/postgresql_where
behavior. SQLite and Postgres already work correctly via 0044 and are untouched.

Revision ID: 0054
Revises: 0053
Create Date: 2026-08-01

"""
from alembic import op

revision = "0054"
down_revision = "0053"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "mysql":
        return

    op.drop_index("uq_test_attempt_final_user_module", table_name="test_attempts")
    op.drop_index("uq_test_attempt_active_user_module", table_name="test_attempts")

    op.execute(
        "ALTER TABLE test_attempts "
        "ADD COLUMN final_attempt_slot INT "
        "GENERATED ALWAYS AS (CASE WHEN is_final = 1 THEN module_id ELSE NULL END) STORED, "
        "ADD COLUMN active_attempt_slot INT "
        "GENERATED ALWAYS AS (CASE WHEN status = 'in_progress' THEN module_id ELSE NULL END) STORED"
    )

    op.create_index(
        "uq_test_attempt_final_user_module",
        "test_attempts",
        ["user_id", "final_attempt_slot"],
        unique=True,
    )
    op.create_index(
        "uq_test_attempt_active_user_module",
        "test_attempts",
        ["user_id", "active_attempt_slot"],
        unique=True,
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "mysql":
        return

    op.drop_index("uq_test_attempt_active_user_module", table_name="test_attempts")
    op.drop_index("uq_test_attempt_final_user_module", table_name="test_attempts")

    op.execute(
        "ALTER TABLE test_attempts "
        "DROP COLUMN active_attempt_slot, "
        "DROP COLUMN final_attempt_slot"
    )

    op.create_index(
        "uq_test_attempt_final_user_module",
        "test_attempts",
        ["user_id", "module_id"],
        unique=True,
    )
    op.create_index(
        "uq_test_attempt_active_user_module",
        "test_attempts",
        ["user_id", "module_id"],
        unique=True,
    )
