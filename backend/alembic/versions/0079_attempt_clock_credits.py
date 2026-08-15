"""add clock_credits to test_attempts

The Speaking exam clock previously counted only the candidate's own preparation
and response time as elapsed, while the examiner avatar speaking each prompt and
the wait for each recording to upload also ran the countdown down. This column
records the seconds already credited back, keyed per event, so a credit is
granted exactly once.

Revision ID: 0079
Revises: 0078
Create Date: 2026-08-15
"""
from alembic import op
import sqlalchemy as sa

revision = "0079"
down_revision = "0078"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("test_attempts", sa.Column("clock_credits", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("test_attempts", "clock_credits")
