"""ai per student quota

Revision ID: 0037_ai_per_student_quota
Revises: 0036_plan_marketing_features
Create Date: 2026-07-26

"""
from alembic import op
# pyrefly: ignore [missing-import]
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0037"
down_revision = "0036"
branch_labels = None
depends_on = None


def _col_exists(table: str, col: str) -> bool:
    conn = op.get_bind()
    return col in [c["name"] for c in inspect(conn).get_columns(table)]


def upgrade() -> None:
    # Per-student slice of the institute's monthly AI pool. NULL/0 means the
    # institute pool is the only ceiling, matching today's behaviour.
    if not _col_exists("institutes", "ai_student_monthly_limit"):
        op.add_column(
            "institutes",
            sa.Column("ai_student_monthly_limit", sa.Integer, nullable=True),
        )
    # Per-student buckets: add user_id column and FK via batch mode (SQLite compatible).
    # batch_alter_table recreates the table so it is always idempotent on SQLite.
    with op.batch_alter_table("ai_eval_limits") as batch_op:
        if not _col_exists("ai_eval_limits", "user_id"):
            batch_op.add_column(sa.Column("user_id", sa.Integer, nullable=True))
        batch_op.create_index("ix_ai_eval_limits_user_id", ["user_id"])
        batch_op.create_foreign_key(
            "fk_ai_eval_limits_user_id",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    with op.batch_alter_table("ai_eval_limits") as batch_op:
        batch_op.drop_constraint("fk_ai_eval_limits_user_id", type_="foreignkey")
        batch_op.drop_index("ix_ai_eval_limits_user_id")
        batch_op.drop_column("user_id")
    op.drop_column("institutes", "ai_student_monthly_limit")
