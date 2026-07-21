"""Per-institute admin permissions.

Revision ID: 0020
Revises: 0019
Create Date: 2026-07-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("institutes") as batch_op:
        batch_op.add_column(sa.Column("admin_permissions", sa.JSON, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("institutes") as batch_op:
        batch_op.drop_column("admin_permissions")
