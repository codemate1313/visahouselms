"""trial_configs, demo_accounts, users.trial_started_at

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-20

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("trial_started_at", sa.DateTime, nullable=True))

    op.create_table(
        "trial_configs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("trial_duration_days", sa.Integer, nullable=False, server_default="14"),
        sa.Column("course_limit", sa.Integer, nullable=False, server_default="1"),
        sa.Column("test_limit", sa.Integer, nullable=False, server_default="3"),
        sa.Column("is_enabled", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )

    op.create_table(
        "demo_accounts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("institute_id", sa.Integer, sa.ForeignKey("institutes.id"), nullable=False, unique=True),
        sa.Column("duration_days", sa.Integer, nullable=False),
        sa.Column("course_limit", sa.Integer, nullable=False),
        sa.Column("test_limit", sa.Integer, nullable=False),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("converted_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("demo_accounts")
    op.drop_table("trial_configs")
    op.drop_column("users", "trial_started_at")
