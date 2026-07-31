"""add gst_rates table and plan/payment gst fields

Revision ID: 0051
Revises: 0050
Create Date: 2026-07-31

"""
from alembic import op
import sqlalchemy as sa

revision = "0051"
down_revision = "0050"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create gst_rates table
    op.create_table(
        "gst_rates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("percentage", sa.Numeric(precision=5, scale=2), nullable=False, server_default="18.00"),
        sa.Column("tax_type", sa.String(length=20), nullable=False, server_default="exclusive"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # Insert default standard GST rates
    op.execute(
        "INSERT INTO gst_rates (name, percentage, tax_type, is_active, is_default) VALUES "
        "('Standard GST (18% Exclusive)', 18.00, 'exclusive', 1, 1), "
        "('Inclusive GST (18% Inclusive)', 18.00, 'inclusive', 1, 0), "
        "('Reduced Rate (5% Exclusive)', 5.00, 'exclusive', 1, 0), "
        "('Exempt (0%)', 0.00, 'exclusive', 1, 0)"
    )

    # 2. Add gst_rate_id to plans
    op.add_column("plans", sa.Column("gst_rate_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_plans_gst_rate_id", "plans", "gst_rates", ["gst_rate_id"], ["id"], ondelete="SET NULL")

    # 3. Add GST fields to payments
    op.add_column("payments", sa.Column("subtotal_amount", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"))
    op.add_column("payments", sa.Column("gst_rate_id", sa.Integer(), nullable=True))
    op.add_column("payments", sa.Column("gst_percentage", sa.Numeric(precision=5, scale=2), nullable=False, server_default="0.00"))
    op.add_column("payments", sa.Column("gst_tax_type", sa.String(length=20), nullable=False, server_default="exclusive"))
    op.add_column("payments", sa.Column("gst_amount", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"))
    op.create_foreign_key("fk_payments_gst_rate_id", "payments", "gst_rates", ["gst_rate_id"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    op.drop_constraint("fk_payments_gst_rate_id", "payments", type_="foreignkey")
    op.drop_column("payments", "gst_amount")
    op.drop_column("payments", "gst_tax_type")
    op.drop_column("payments", "gst_percentage")
    op.drop_column("payments", "gst_rate_id")
    op.drop_column("payments", "subtotal_amount")

    op.drop_constraint("fk_plans_gst_rate_id", "plans", type_="foreignkey")
    op.drop_column("plans", "gst_rate_id")

    op.drop_table("gst_rates")
