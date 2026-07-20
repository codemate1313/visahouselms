"""coupons, payments

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-20

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "coupons",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("code", sa.String(50), nullable=False, unique=True),
        sa.Column("discount_type", sa.String(10), nullable=False),
        sa.Column("value", sa.Numeric(10, 2), nullable=False),
        sa.Column("scope", sa.String(10), nullable=False, server_default="all"),
        sa.Column("scope_plan_id", sa.Integer, sa.ForeignKey("plans.id"), nullable=True),
        sa.Column("scope_course_id", sa.Integer, nullable=True),
        sa.Column("usage_limit", sa.Integer, nullable=True),
        sa.Column("usage_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("valid_from", sa.DateTime, nullable=True),
        sa.Column("valid_until", sa.DateTime, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "payments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("source", sa.String(10), nullable=False),
        sa.Column("institute_id", sa.Integer, sa.ForeignKey("institutes.id"), nullable=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("plan_id", sa.Integer, sa.ForeignKey("plans.id"), nullable=True),
        sa.Column("course_id", sa.Integer, nullable=True),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("discount_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("final_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(8), nullable=False, server_default="INR"),
        sa.Column("coupon_id", sa.Integer, sa.ForeignKey("coupons.id"), nullable=True),
        sa.Column("gateway", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("gateway_reference", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("subscription_id", sa.Integer, sa.ForeignKey("subscriptions.id"), nullable=True),
        sa.Column("invoice_number", sa.String(50), nullable=True, unique=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("paid_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_payments_institute_id", "payments", ["institute_id"])
    op.create_index("ix_payments_status", "payments", ["status"])
    op.create_index("ix_payments_created_at", "payments", ["created_at"])


def downgrade() -> None:
    op.drop_table("payments")
    op.drop_table("coupons")
