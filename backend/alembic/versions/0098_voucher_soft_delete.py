"""add deleted_at to voucher tables for soft delete

Allows deleting voucher types, offerings, and codes while preserving
historical purchase records, invoices, and student redemption data.

Revision ID: 0098
Revises: 0097
Create Date: 2026-08-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0098"
down_revision: Union[str, None] = "0097"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("voucher_types", sa.Column("deleted_at", sa.DateTime(), nullable=True))
    op.create_index(op.f("ix_voucher_types_deleted_at"), "voucher_types", ["deleted_at"], unique=False)

    op.add_column("voucher_offerings", sa.Column("deleted_at", sa.DateTime(), nullable=True))
    op.create_index(op.f("ix_voucher_offerings_deleted_at"), "voucher_offerings", ["deleted_at"], unique=False)

    op.add_column("voucher_codes", sa.Column("deleted_at", sa.DateTime(), nullable=True))
    op.create_index(op.f("ix_voucher_codes_deleted_at"), "voucher_codes", ["deleted_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_voucher_codes_deleted_at"), table_name="voucher_codes")
    op.drop_column("voucher_codes", "deleted_at")

    op.drop_index(op.f("ix_voucher_offerings_deleted_at"), table_name="voucher_offerings")
    op.drop_column("voucher_offerings", "deleted_at")

    op.drop_index(op.f("ix_voucher_types_deleted_at"), table_name="voucher_types")
    op.drop_column("voucher_types", "deleted_at")
