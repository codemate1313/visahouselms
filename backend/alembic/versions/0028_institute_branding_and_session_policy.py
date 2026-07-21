"""Add institute typography and session policy.

Revision ID: 0028
Revises: 0027
Create Date: 2026-07-21
"""

from alembic import op
import sqlalchemy as sa


revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "institute_branding",
        sa.Column("font_family", sa.String(length=50), nullable=False, server_default="Plus Jakarta Sans"),
    )
    op.add_column(
        "institute_branding",
        sa.Column("heading_font_weight", sa.Integer(), nullable=False, server_default="700"),
    )
    op.add_column(
        "institute_branding",
        sa.Column("body_font_weight", sa.Integer(), nullable=False, server_default="400"),
    )
    op.add_column(
        "institutes",
        sa.Column("session_duration_hours", sa.Integer(), nullable=False, server_default="24"),
    )


def downgrade() -> None:
    op.drop_column("institutes", "session_duration_hours")
    op.drop_column("institute_branding", "body_font_weight")
    op.drop_column("institute_branding", "heading_font_weight")
    op.drop_column("institute_branding", "font_family")
