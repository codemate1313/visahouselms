"""notification pinning

Revision ID: 0033
Revises: 0032
Create Date: 2026-07-25

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0033"
down_revision: Union[str, None] = "0032"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("student_notifications", sa.Column("pinned_at", sa.DateTime(), nullable=True))
    op.create_index(
        "ix_student_notifications_pinned_at",
        "student_notifications",
        ["pinned_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_student_notifications_pinned_at", table_name="student_notifications")
    op.drop_column("student_notifications", "pinned_at")
