"""Add announcement scheduling and target filter columns.

Revision ID: 0031
Revises: 0030
Create Date: 2026-07-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0031"
down_revision: Union[str, None] = "0030"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("announcements") as batch_op:
        batch_op.add_column(sa.Column("scheduled_at", sa.DateTime, nullable=True))
        batch_op.add_column(sa.Column("target_institute_ids", sa.Text, nullable=True))
        batch_op.add_column(sa.Column("target_user_ids", sa.Text, nullable=True))
        batch_op.create_index("ix_announcements_scheduled_at", ["scheduled_at"])


def downgrade() -> None:
    with op.batch_alter_table("announcements") as batch_op:
        batch_op.drop_index("ix_announcements_scheduled_at")
        batch_op.drop_column("target_user_ids")
        batch_op.drop_column("target_institute_ids")
        batch_op.drop_column("scheduled_at")
