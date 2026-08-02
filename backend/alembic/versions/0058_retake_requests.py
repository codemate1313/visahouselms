"""add retake requests and generalize the one-sitting policy to every module type

Every module type (reading, writing, listening, speaking, full_mock,
final_test) previously only enforced a hard one-attempt-ever cap for
final_test. This generalizes that cap to all six via a new `is_retake` flag
and relaxes the existing `uq_test_attempt_final_user_module` index into
`uq_test_attempt_original_user_module` (one non-retake attempt per student
per module). A `RetakeRequest`, once approved by a Super Admin, grants
exactly one extra attempt, linked back via `test_attempts.retake_request_id`
so it can never be redeemed twice.

MySQL has no native partial/filtered unique index support, so the new
"original attempt" index is emulated there with a stored generated column,
mirroring the fix already applied to the final-test index in 0054.

Revision ID: 0058
Revises: 0057
Create Date: 2026-08-02

"""
from alembic import op
import sqlalchemy as sa

revision = "0058"
down_revision = "0057"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "retake_requests",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("attempt_id", sa.Integer, sa.ForeignKey("test_attempts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reviewed_by_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reason", sa.Text, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("review_note", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("reviewed_at", sa.DateTime, nullable=True),
        sa.Column("consumed_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_retake_requests_attempt_id", "retake_requests", ["attempt_id"])
    op.create_index("ix_retake_requests_student_id", "retake_requests", ["student_id"])
    op.create_index("ix_retake_requests_status", "retake_requests", ["status"])

    with op.batch_alter_table("test_attempts") as batch_op:
        batch_op.add_column(sa.Column("is_retake", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column("retake_request_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_test_attempts_retake_request_id",
            "retake_requests",
            ["retake_request_id"],
            ["id"],
            ondelete="SET NULL",
        )

    op.create_index(
        "uq_test_attempt_retake_request",
        "test_attempts",
        ["retake_request_id"],
        unique=True,
    )

    bind = op.get_bind()
    op.drop_index("uq_test_attempt_final_user_module", table_name="test_attempts")

    if bind.dialect.name == "mysql":
        op.execute("ALTER TABLE test_attempts DROP COLUMN final_attempt_slot")
        op.execute(
            "ALTER TABLE test_attempts "
            "ADD COLUMN original_attempt_slot INT "
            "GENERATED ALWAYS AS (CASE WHEN is_retake = 0 THEN module_id ELSE NULL END) STORED"
        )
        op.create_index(
            "uq_test_attempt_original_user_module",
            "test_attempts",
            ["user_id", "original_attempt_slot"],
            unique=True,
        )
    else:
        op.create_index(
            "uq_test_attempt_original_user_module",
            "test_attempts",
            ["user_id", "module_id"],
            unique=True,
            sqlite_where=sa.text("is_retake = 0"),
            postgresql_where=sa.text("is_retake = false"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    op.drop_index("uq_test_attempt_original_user_module", table_name="test_attempts")

    if bind.dialect.name == "mysql":
        op.execute("ALTER TABLE test_attempts DROP COLUMN original_attempt_slot")
        op.execute(
            "ALTER TABLE test_attempts "
            "ADD COLUMN final_attempt_slot INT "
            "GENERATED ALWAYS AS (CASE WHEN is_final = 1 THEN module_id ELSE NULL END) STORED"
        )
        op.create_index(
            "uq_test_attempt_final_user_module",
            "test_attempts",
            ["user_id", "final_attempt_slot"],
            unique=True,
        )
    else:
        op.create_index(
            "uq_test_attempt_final_user_module",
            "test_attempts",
            ["user_id", "module_id"],
            unique=True,
            sqlite_where=sa.text("is_final = 1"),
            postgresql_where=sa.text("is_final = true"),
        )

    op.drop_index("uq_test_attempt_retake_request", table_name="test_attempts")
    with op.batch_alter_table("test_attempts") as batch_op:
        batch_op.drop_constraint("fk_test_attempts_retake_request_id", type_="foreignkey")
        batch_op.drop_column("retake_request_id")
        batch_op.drop_column("is_retake")

    op.drop_index("ix_retake_requests_status", table_name="retake_requests")
    op.drop_index("ix_retake_requests_student_id", table_name="retake_requests")
    op.drop_index("ix_retake_requests_attempt_id", table_name="retake_requests")
    op.drop_table("retake_requests")
