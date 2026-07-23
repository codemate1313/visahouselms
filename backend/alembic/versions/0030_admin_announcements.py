"""Add admin announcement notifications.

Revision ID: 0030
Revises: 0029
Create Date: 2026-07-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0030"
down_revision: Union[str, None] = "0029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("announcements"):
        op.create_table(
            "announcements",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("institute_id", sa.Integer, sa.ForeignKey("institutes.id", ondelete="CASCADE"), nullable=True),
            sa.Column("title", sa.String(180), nullable=False),
            sa.Column("message", sa.Text, nullable=False),
            sa.Column("audience", sa.String(20), nullable=False, server_default="students"),
            sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
            sa.Column("published_at", sa.DateTime, nullable=True),
            sa.Column("expires_at", sa.DateTime, nullable=True),
            sa.Column("created_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
            sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_announcements_institute_id", "announcements", ["institute_id"])
        op.create_index("ix_announcements_status", "announcements", ["status"])

    existing_cols = [c["name"] for c in inspector.get_columns("student_notifications")]
    with op.batch_alter_table("student_notifications") as batch_op:
        if "announcement_id" not in existing_cols:
            batch_op.add_column(sa.Column("announcement_id", sa.Integer, nullable=True))
            batch_op.create_foreign_key(
                "fk_student_notifications_announcement_id",
                "announcements",
                ["announcement_id"],
                ["id"],
                ondelete="SET NULL",
            )
            batch_op.create_index("ix_student_notifications_announcement_id", ["announcement_id"])
        if "link_url" not in existing_cols:
            batch_op.add_column(sa.Column("link_url", sa.String(500), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("student_notifications") as batch_op:
        batch_op.drop_index("ix_student_notifications_announcement_id")
        batch_op.drop_constraint("fk_student_notifications_announcement_id", type_="foreignkey")
        batch_op.drop_column("link_url")
        batch_op.drop_column("announcement_id")

    op.drop_index("ix_announcements_status", table_name="announcements")
    op.drop_index("ix_announcements_institute_id", table_name="announcements")
    op.drop_table("announcements")

