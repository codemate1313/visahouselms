"""add gender to users table

Revision ID: 0057
Revises: 0056
Create Date: 2026-08-02

"""
from alembic import op
import sqlalchemy as sa


revision = "0057"
down_revision = "0056"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("gender", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "gender")
