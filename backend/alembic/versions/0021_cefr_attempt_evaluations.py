"""Persist versioned CEFR attempt evaluations.

Revision ID: 0021
Revises: 0020
Create Date: 2026-07-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("test_attempts") as batch_op:
        batch_op.add_column(sa.Column("cefr_level", sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column("cefr_profile", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("cefr_policy_version", sa.String(length=60), nullable=True))
        batch_op.create_index("ix_test_attempts_cefr_level", ["cefr_level"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("test_attempts") as batch_op:
        batch_op.drop_index("ix_test_attempts_cefr_level")
        batch_op.drop_column("cefr_policy_version")
        batch_op.drop_column("cefr_profile")
        batch_op.drop_column("cefr_level")
