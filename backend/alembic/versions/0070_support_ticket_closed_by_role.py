"""support ticket closed_by_role

Revision ID: 0070
Revises: 0069
Create Date: 2026-08-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0070"
down_revision = "0069"
branch_labels = None
depends_on = None


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = inspect(op.get_bind())
    cols = [c["name"] for c in inspector.get_columns(table_name)]
    return column_name in cols


def upgrade() -> None:
    if not _has_column("support_tickets", "closed_by_role"):
        op.add_column(
            "support_tickets",
            sa.Column("closed_by_role", sa.String(length=40), nullable=True, server_default=None),
        )


def downgrade() -> None:
    if _has_column("support_tickets", "closed_by_role"):
        op.drop_column("support_tickets", "closed_by_role")
