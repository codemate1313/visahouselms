"""route support tickets through institute admins

Revision ID: 0047
Revises: 0046
Create Date: 2026-07-30

"""
from alembic import op
# pyrefly: ignore [missing-import]
import sqlalchemy as sa


revision = "0047"
down_revision = "0046"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("support_tickets") as batch:
        batch.add_column(sa.Column("requester_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("institute_id", sa.Integer(), nullable=True))
        batch.add_column(
            sa.Column(
                "queue",
                sa.String(length=30),
                nullable=False,
                server_default="super_admin",
            )
        )
        batch.add_column(sa.Column("escalated_at", sa.DateTime(), nullable=True))
        batch.add_column(sa.Column("escalated_by_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_support_tickets_requester_id_users",
            "users",
            ["requester_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch.create_foreign_key(
            "fk_support_tickets_institute_id_institutes",
            "institutes",
            ["institute_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch.create_foreign_key(
            "fk_support_tickets_escalated_by_id_users",
            "users",
            ["escalated_by_id"],
            ["id"],
            ondelete="SET NULL",
        )

    op.create_index(op.f("ix_support_tickets_requester_id"), "support_tickets", ["requester_id"], unique=False)
    op.create_index(op.f("ix_support_tickets_institute_id"), "support_tickets", ["institute_id"], unique=False)
    op.create_index(op.f("ix_support_tickets_queue"), "support_tickets", ["queue"], unique=False)
    op.create_index(op.f("ix_support_tickets_escalated_at"), "support_tickets", ["escalated_at"], unique=False)
    op.create_index(
        op.f("ix_support_tickets_escalated_by_id"),
        "support_tickets",
        ["escalated_by_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_support_tickets_escalated_by_id"), table_name="support_tickets")
    op.drop_index(op.f("ix_support_tickets_escalated_at"), table_name="support_tickets")
    op.drop_index(op.f("ix_support_tickets_queue"), table_name="support_tickets")
    op.drop_index(op.f("ix_support_tickets_institute_id"), table_name="support_tickets")
    op.drop_index(op.f("ix_support_tickets_requester_id"), table_name="support_tickets")

    with op.batch_alter_table("support_tickets") as batch:
        batch.drop_constraint("fk_support_tickets_escalated_by_id_users", type_="foreignkey")
        batch.drop_constraint("fk_support_tickets_institute_id_institutes", type_="foreignkey")
        batch.drop_constraint("fk_support_tickets_requester_id_users", type_="foreignkey")
        batch.drop_column("escalated_by_id")
        batch.drop_column("escalated_at")
        batch.drop_column("queue")
        batch.drop_column("institute_id")
        batch.drop_column("requester_id")
