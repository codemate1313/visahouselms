"""Phase 3.1: Super Admin Instructor profiles

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-20

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "instructor_profiles",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("bio", sa.Text, nullable=True),
        sa.Column("specializations", sa.JSON, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_instructor_profiles_user_id", "instructor_profiles", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_instructor_profiles_user_id", table_name="instructor_profiles")
    op.drop_table("instructor_profiles")
