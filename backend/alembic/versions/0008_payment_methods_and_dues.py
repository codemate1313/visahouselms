"""payment_methods master + partial payment tracking on payments

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-20

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_METHODS = ["Cash", "Bank Transfer", "UPI", "Card", "Cheque", "Other"]


def upgrade() -> None:
    op.create_table(
        "payment_methods",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(50), nullable=False, unique=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    methods_table = sa.table("payment_methods", sa.column("id", sa.Integer), sa.column("name", sa.String))
    op.bulk_insert(methods_table, [{"name": name} for name in DEFAULT_METHODS])

    op.add_column("payments", sa.Column("payment_method_id", sa.Integer, sa.ForeignKey("payment_methods.id"), nullable=True))
    op.add_column("payments", sa.Column("amount_paid", sa.Numeric(10, 2), nullable=False, server_default="0"))
    op.alter_column("payments", "gateway_reference", existing_type=sa.String(255), type_=sa.Text, nullable=True)

    # backfill: existing rows are all fully-paid one-shot payments
    op.execute("UPDATE payments SET amount_paid = final_amount WHERE status = 'paid'")


def downgrade() -> None:
    op.alter_column("payments", "gateway_reference", existing_type=sa.Text, type_=sa.String(255), nullable=True)
    op.drop_column("payments", "amount_paid")
    op.drop_column("payments", "payment_method_id")
    op.drop_table("payment_methods")
