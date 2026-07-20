"""institute_branding table + institutes.contact_email

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-19

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("institutes", sa.Column("contact_email", sa.String(255), nullable=True))

    op.create_table(
        "institute_branding",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("institute_id", sa.Integer, sa.ForeignKey("institutes.id"), nullable=False, unique=True),
        sa.Column("logo_path", sa.String(500), nullable=True),
        sa.Column("primary_color", sa.String(9), nullable=False, server_default="#4f46e5"),
        sa.Column("secondary_color", sa.String(9), nullable=False, server_default="#1e2130"),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("institute_branding")
    op.drop_column("institutes", "contact_email")
