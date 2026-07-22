"""Add student assessment notifications.

Revision ID: 0029
Revises: 0028
Create Date: 2026-07-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0029"
down_revision: Union[str, None] = "0028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "student_notifications",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "attempt_id",
            sa.Integer,
            sa.ForeignKey("test_attempts.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("kind", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("read_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("attempt_id", "kind", name="uq_student_notification_attempt_kind"),
    )
    op.create_index("ix_student_notifications_user_id", "student_notifications", ["user_id"])
    op.create_index("ix_student_notifications_attempt_id", "student_notifications", ["attempt_id"])
    op.create_index("ix_student_notifications_kind", "student_notifications", ["kind"])
    op.create_index(
        "ix_student_notifications_user_created",
        "student_notifications",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_student_notifications_user_created", table_name="student_notifications")
    op.drop_index("ix_student_notifications_kind", table_name="student_notifications")
    op.drop_index("ix_student_notifications_attempt_id", table_name="student_notifications")
    op.drop_index("ix_student_notifications_user_id", table_name="student_notifications")
    op.drop_table("student_notifications")
