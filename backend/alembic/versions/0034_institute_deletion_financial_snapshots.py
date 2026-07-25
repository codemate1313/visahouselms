"""retain financial identity after institute deletion

Revision ID: 0034
Revises: 0033
Create Date: 2026-07-26

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0034"
down_revision: Union[str, None] = "0033"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table_name in ("payments", "subscriptions"):
        op.add_column(table_name, sa.Column("institute_id_snapshot", sa.Integer(), nullable=True))
        op.add_column(table_name, sa.Column("institute_name_snapshot", sa.String(length=255), nullable=True))
        op.add_column(table_name, sa.Column("institute_slug_snapshot", sa.String(length=255), nullable=True))
        op.create_index(
            f"ix_{table_name}_institute_id_snapshot",
            table_name,
            ["institute_id_snapshot"],
        )


def downgrade() -> None:
    for table_name in ("subscriptions", "payments"):
        op.drop_index(f"ix_{table_name}_institute_id_snapshot", table_name=table_name)
        op.drop_column(table_name, "institute_slug_snapshot")
        op.drop_column(table_name, "institute_name_snapshot")
        op.drop_column(table_name, "institute_id_snapshot")
