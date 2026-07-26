"""plan marketing features

Revision ID: 0036_plan_marketing_features
Revises: 0035_institute_ai_monthly_limit
Create Date: 2026-07-26

"""
from alembic import op
# pyrefly: ignore [missing-import]
import sqlalchemy as sa

revision = "0036"
down_revision = "0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "plans",
        sa.Column("features", sa.JSON, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("plans", "features")
