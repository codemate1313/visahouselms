"""institute ai monthly limit

Revision ID: 0035_institute_ai_monthly_limit
Revises: 0034_institute_deletion_financial_snapshots
Create Date: 2026-07-26

"""
from alembic import op
# pyrefly: ignore [missing-import]
import sqlalchemy as sa

revision = "0035"
down_revision = "0034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "institutes",
        sa.Column("ai_monthly_limit", sa.Integer, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("institutes", "ai_monthly_limit")
