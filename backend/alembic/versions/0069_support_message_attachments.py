"""support message attachments

Revision ID: 0069
Revises: 0068
Create Date: 2026-08-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision = "0069"
down_revision = "0068"
branch_labels = None
depends_on = None


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = inspect(op.get_bind())
    cols = [c["name"] for c in inspector.get_columns(table_name)]
    return column_name in cols


def upgrade() -> None:
    if not _has_column("support_ticket_messages", "attachments"):
        op.add_column(
            "support_ticket_messages",
            sa.Column("attachments", sa.Text(), nullable=True, server_default=None),
        )


def downgrade() -> None:
    if _has_column("support_ticket_messages", "attachments"):
        op.drop_column("support_ticket_messages", "attachments")
