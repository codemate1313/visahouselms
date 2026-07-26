"""ai per student quota

Revision ID: 0037_ai_per_student_quota
Revises: 0036_plan_marketing_features
Create Date: 2026-07-26

"""
from alembic import op
# pyrefly: ignore [missing-import]
import sqlalchemy as sa

revision = "0037"
down_revision = "0036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Per-student slice of the institute's monthly AI pool. NULL/0 means the
    # institute pool is the only ceiling, matching today's behaviour.
    op.add_column(
        "institutes",
        sa.Column("ai_student_monthly_limit", sa.Integer, nullable=True),
    )
    # Per-student buckets live in the same table as the institute pool rows;
    # user_id makes them reportable rather than only parseable out of scope_key.
    op.add_column(
        "ai_eval_limits",
        sa.Column("user_id", sa.Integer, nullable=True),
    )
    op.create_index("ix_ai_eval_limits_user_id", "ai_eval_limits", ["user_id"])
    op.create_foreign_key(
        "fk_ai_eval_limits_user_id",
        "ai_eval_limits",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_ai_eval_limits_user_id", "ai_eval_limits", type_="foreignkey")
    op.drop_index("ix_ai_eval_limits_user_id", table_name="ai_eval_limits")
    op.drop_column("ai_eval_limits", "user_id")
    op.drop_column("institutes", "ai_student_monthly_limit")
