"""add dual pricing international columns to plans

Revision ID: 0052
Revises: 0051
Create Date: 2026-07-31

"""
from alembic import op
import sqlalchemy as sa

revision = "0052"
down_revision = "0051"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("plans", sa.Column("is_international_enabled", sa.Boolean(), nullable=False, server_default=sa.text("0")))
    op.add_column("plans", sa.Column("usd_price", sa.Numeric(precision=10, scale=2), nullable=True))


def downgrade() -> None:
    op.drop_column("plans", "usd_price")
    op.drop_column("plans", "is_international_enabled")
