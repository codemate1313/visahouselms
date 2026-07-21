"""plan_modules join table + personal (B2C) subscriptions

Revision ID: 0018
Revises: 0017
Create Date: 2026-07-21

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "plan_modules",
        sa.Column("plan_id", sa.Integer, sa.ForeignKey("plans.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("module_id", sa.Integer, sa.ForeignKey("exam_modules.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_index("ix_plan_modules_module_id", "plan_modules", ["module_id"])

    # Batch mode recreates the table on SQLite (which cannot ALTER a NOT NULL
    # column or add a new foreign key in place) and emits normal ALTER
    # statements on MySQL.
    with op.batch_alter_table("subscriptions") as batch_op:
        batch_op.alter_column("institute_id", existing_type=sa.Integer, nullable=True)
        batch_op.add_column(
            sa.Column(
                "user_id",
                sa.Integer,
                sa.ForeignKey("users.id", name="fk_subscriptions_user_id"),
                nullable=True,
            )
        )
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_subscriptions_user_id", table_name="subscriptions")
    with op.batch_alter_table("subscriptions") as batch_op:
        batch_op.drop_column("user_id")
        batch_op.alter_column("institute_id", existing_type=sa.Integer, nullable=False)
    op.drop_index("ix_plan_modules_module_id", table_name="plan_modules")
    op.drop_table("plan_modules")
