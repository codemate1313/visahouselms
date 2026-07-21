"""add dob, phone_number, address to users table

Revision ID: 0016
Revises: 0015
Create Date: 2026-07-20

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("dob", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("phone_number", sa.String(50), nullable=True))
    op.add_column("users", sa.Column("address", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "address")
    op.drop_column("users", "phone_number")
    op.drop_column("users", "dob")
