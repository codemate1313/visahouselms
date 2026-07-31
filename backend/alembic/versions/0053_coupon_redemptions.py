"""add coupon_redemptions table for per-customer usage limits

Revision ID: 0053
Revises: 0052
Create Date: 2026-07-31

"""
from alembic import op
import sqlalchemy as sa

revision = "0053"
down_revision = "0052"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "coupon_redemptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("coupon_id", sa.Integer(), sa.ForeignKey("coupons.id"), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("payment_id", sa.Integer(), sa.ForeignKey("payments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("redeemed_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_coupon_redemptions_coupon_id", "coupon_redemptions", ["coupon_id"])
    op.create_index("ix_coupon_redemptions_email", "coupon_redemptions", ["email"])
    op.create_index("ix_coupon_redemptions_coupon_email", "coupon_redemptions", ["coupon_id", "email"])


def downgrade() -> None:
    op.drop_index("ix_coupon_redemptions_coupon_email", table_name="coupon_redemptions")
    op.drop_index("ix_coupon_redemptions_email", table_name="coupon_redemptions")
    op.drop_index("ix_coupon_redemptions_coupon_id", table_name="coupon_redemptions")
    op.drop_table("coupon_redemptions")
