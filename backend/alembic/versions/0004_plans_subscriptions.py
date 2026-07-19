"""plans and subscriptions

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-19

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "plans",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(8), nullable=False, server_default="INR"),
        sa.Column("duration_days", sa.Integer, nullable=False),
        sa.Column("student_limit", sa.Integer, nullable=False),
        sa.Column("test_limit", sa.Integer, nullable=False),
        sa.Column("staff_limit", sa.Integer, nullable=False),
        sa.Column("grace_days", sa.Integer, nullable=False, server_default="7"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )

    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("institute_id", sa.Integer, sa.ForeignKey("institutes.id"), nullable=False),
        sa.Column("plan_id", sa.Integer, sa.ForeignKey("plans.id"), nullable=False),
        sa.Column("starts_at", sa.DateTime, nullable=False),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("grace_days", sa.Integer, nullable=False, server_default="7"),
        sa.Column("cancelled_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_subscriptions_institute_id", "subscriptions", ["institute_id"])


def downgrade() -> None:
    op.drop_table("subscriptions")
    op.drop_table("plans")
