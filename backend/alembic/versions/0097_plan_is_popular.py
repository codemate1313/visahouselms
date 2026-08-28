"""add is_popular to plans

Allows the Super Admin to mark at most 1 plan as popular per catalogue
(direct_students and institutes), highlighting it with featured badge styling.

Revision ID: 0097
Revises: 0096
Create Date: 2026-08-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0097"
down_revision: Union[str, None] = "0096"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    dialect = op.get_bind().dialect.name
    server_default = sa.text("0" if dialect == "sqlite" else "false")
    op.add_column("plans", sa.Column("is_popular", sa.Boolean(), nullable=False, server_default=server_default))


def downgrade() -> None:
    op.drop_column("plans", "is_popular")
