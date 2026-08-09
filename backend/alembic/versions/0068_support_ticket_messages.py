"""support ticket messages

Revision ID: 0068
Revises: 0067
Create Date: 2026-08-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0068"
down_revision = "0067"
branch_labels = None
depends_on = None


def _has_table(table_name: str) -> bool:
    inspector = inspect(op.get_bind())
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    if not _has_table("support_ticket_messages"):
        op.create_table(
            "support_ticket_messages",
            sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
            sa.Column("ticket_id", sa.Integer(), sa.ForeignKey("support_tickets.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("sender_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("sender_name", sa.String(length=160), nullable=False),
            sa.Column("sender_role", sa.String(length=40), nullable=False, server_default="customer"),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP"), index=True),
        )


def downgrade() -> None:
    if _has_table("support_ticket_messages"):
        op.drop_table("support_ticket_messages")
