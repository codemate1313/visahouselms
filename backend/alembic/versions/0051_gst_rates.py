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
    with op.batch_alter_table("plans") as batch_op:
        batch_op.add_column(sa.Column("gst_rate_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key("fk_plans_gst_rate_id", "gst_rates", ["gst_rate_id"], ["id"], ondelete="SET NULL")

    # 3. Add GST fields to payments
    with op.batch_alter_table("payments") as batch_op:
        batch_op.add_column(sa.Column("subtotal_amount", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"))
        batch_op.add_column(sa.Column("gst_rate_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("gst_percentage", sa.Numeric(precision=5, scale=2), nullable=False, server_default="0.00"))
        batch_op.add_column(sa.Column("gst_tax_type", sa.String(length=20), nullable=False, server_default="exclusive"))
        batch_op.add_column(sa.Column("gst_amount", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"))
        batch_op.create_foreign_key("fk_payments_gst_rate_id", "gst_rates", ["gst_rate_id"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    with op.batch_alter_table("payments") as batch_op:
        batch_op.drop_constraint("fk_payments_gst_rate_id", type_="foreignkey")
        batch_op.drop_column("gst_amount")
        batch_op.drop_column("gst_tax_type")
        batch_op.drop_column("gst_percentage")
        batch_op.drop_column("gst_rate_id")
        batch_op.drop_column("subtotal_amount")

    with op.batch_alter_table("plans") as batch_op:
        batch_op.drop_constraint("fk_plans_gst_rate_id", type_="foreignkey")
        batch_op.drop_column("gst_rate_id")

    op.drop_table("gst_rates")
