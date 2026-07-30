"""add support tickets

Revision ID: 0043
Revises: 0042
Create Date: 2026-07-30

"""
from alembic import op
# pyrefly: ignore [missing-import]
import sqlalchemy as sa

revision = "0043"
down_revision = "0042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "support_tickets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone_number", sa.String(length=50), nullable=True),
        sa.Column("institute_name", sa.String(length=180), nullable=True),
        sa.Column("subject", sa.String(length=220), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=60), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("priority", sa.String(length=20), nullable=False),
        sa.Column("admin_note", sa.Text(), nullable=True),
        sa.Column("assigned_to_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("ip_address", sa.String(length=80), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(["assigned_to_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_support_tickets_assigned_to_id"), "support_tickets", ["assigned_to_id"], unique=False)
    op.create_index(op.f("ix_support_tickets_category"), "support_tickets", ["category"], unique=False)
    op.create_index(op.f("ix_support_tickets_created_at"), "support_tickets", ["created_at"], unique=False)
    op.create_index(op.f("ix_support_tickets_email"), "support_tickets", ["email"], unique=False)
    op.create_index(op.f("ix_support_tickets_institute_name"), "support_tickets", ["institute_name"], unique=False)
    op.create_index(op.f("ix_support_tickets_priority"), "support_tickets", ["priority"], unique=False)
    op.create_index(op.f("ix_support_tickets_resolved_at"), "support_tickets", ["resolved_at"], unique=False)
    op.create_index(op.f("ix_support_tickets_source"), "support_tickets", ["source"], unique=False)
    op.create_index(op.f("ix_support_tickets_status"), "support_tickets", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_support_tickets_status"), table_name="support_tickets")
    op.drop_index(op.f("ix_support_tickets_source"), table_name="support_tickets")
    op.drop_index(op.f("ix_support_tickets_resolved_at"), table_name="support_tickets")
    op.drop_index(op.f("ix_support_tickets_priority"), table_name="support_tickets")
    op.drop_index(op.f("ix_support_tickets_institute_name"), table_name="support_tickets")
    op.drop_index(op.f("ix_support_tickets_email"), table_name="support_tickets")
    op.drop_index(op.f("ix_support_tickets_created_at"), table_name="support_tickets")
    op.drop_index(op.f("ix_support_tickets_category"), table_name="support_tickets")
    op.drop_index(op.f("ix_support_tickets_assigned_to_id"), table_name="support_tickets")
    op.drop_table("support_tickets")
