"""create voucher system tables (voucher_types, voucher_offerings, voucher_codes, voucher_purchases)

Revision ID: 0059
Revises: 0058
Create Date: 2026-08-02

"""
from alembic import op
import sqlalchemy as sa

revision = "0059"
down_revision = "0058"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("voucher_types"):
        op.create_table(
            "voucher_types",
            sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
            sa.Column("name", sa.String(length=100), nullable=False),
            sa.Column("code", sa.String(length=50), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("badge_color", sa.String(length=20), nullable=False, server_default="#0284c7"),
            sa.Column("default_price", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"),
            sa.Column("default_validity_days", sa.Integer(), nullable=False, server_default="180"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("code"),
        )
        try:
            op.create_index("ix_voucher_types_code", "voucher_types", ["code"])
        except Exception:
            pass

    if not inspector.has_table("voucher_offerings"):
        op.create_table(
            "voucher_offerings",
            sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
            sa.Column("voucher_type_id", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("price", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("discount_price", sa.Numeric(precision=10, scale=2), nullable=True),
            sa.Column("validity_days", sa.Integer(), nullable=False, server_default="180"),
            sa.Column("gst_rate_id", sa.Integer(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["voucher_type_id"], ["voucher_types.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["gst_rate_id"], ["gst_rates.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        try:
            op.create_index("ix_voucher_offerings_voucher_type_id", "voucher_offerings", ["voucher_type_id"])
        except Exception:
            pass

    if not inspector.has_table("voucher_purchases"):
        op.create_table(
            "voucher_purchases",
            sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
            sa.Column("purchase_number", sa.String(length=50), nullable=False),
            sa.Column("voucher_offering_id", sa.Integer(), nullable=False),
            sa.Column("voucher_code_id", sa.Integer(), nullable=True),
            sa.Column("student_id", sa.Integer(), nullable=True),
            sa.Column("buyer_name", sa.String(length=255), nullable=False),
            sa.Column("buyer_email", sa.String(length=255), nullable=False),
            sa.Column("buyer_phone", sa.String(length=50), nullable=True),
            sa.Column("amount", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("discount_amount", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"),
            sa.Column("gst_percentage", sa.Numeric(precision=5, scale=2), nullable=False, server_default="0.00"),
            sa.Column("gst_amount", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"),
            sa.Column("final_amount", sa.Numeric(precision=10, scale=2), nullable=False),
            sa.Column("currency", sa.String(length=8), nullable=False, server_default="INR"),
            sa.Column("gateway", sa.String(length=50), nullable=False, server_default="demo"),
            sa.Column("gateway_transaction_id", sa.String(length=255), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="completed"),
            sa.Column("valid_until", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["voucher_offering_id"], ["voucher_offerings.id"]),
            sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("purchase_number"),
        )
        try:
            op.create_index("ix_voucher_purchases_purchase_number", "voucher_purchases", ["purchase_number"])
            op.create_index("ix_voucher_purchases_voucher_offering_id", "voucher_purchases", ["voucher_offering_id"])
            op.create_index("ix_voucher_purchases_student_id", "voucher_purchases", ["student_id"])
            op.create_index("ix_voucher_purchases_buyer_email", "voucher_purchases", ["buyer_email"])
            op.create_index("ix_voucher_purchases_status", "voucher_purchases", ["status"])
        except Exception:
            pass

    if not inspector.has_table("voucher_codes"):
        op.create_table(
            "voucher_codes",
            sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
            sa.Column("voucher_type_id", sa.Integer(), nullable=False),
            sa.Column("code", sa.String(length=50), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="available"),
            sa.Column("added_by_id", sa.Integer(), nullable=True),
            sa.Column("source_filename", sa.String(length=255), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("purchased_at", sa.DateTime(), nullable=True),
            sa.Column("purchase_id", sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(["voucher_type_id"], ["voucher_types.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["added_by_id"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["purchase_id"], ["voucher_purchases.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("code"),
        )
        try:
            op.create_index("ix_voucher_codes_voucher_type_id", "voucher_codes", ["voucher_type_id"])
            op.create_index("ix_voucher_codes_code", "voucher_codes", ["code"])
            op.create_index("ix_voucher_codes_status", "voucher_codes", ["status"])
        except Exception:
            pass

    # Ensure voucher_purchases has voucher_code_id foreign key constraint
    vp_cols = [c["name"] for c in inspector.get_columns("voucher_purchases")]
    if "voucher_code_id" not in vp_cols:
        with op.batch_alter_table("voucher_purchases") as batch_op:
            batch_op.add_column(sa.Column("voucher_code_id", sa.Integer(), nullable=True))
            batch_op.create_foreign_key("fk_voucher_purchases_voucher_code_id", "voucher_codes", ["voucher_code_id"], ["id"])
            batch_op.create_unique_constraint("uq_voucher_purchases_voucher_code_id", ["voucher_code_id"])


def downgrade() -> None:
    pass
