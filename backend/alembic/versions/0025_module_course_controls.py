"""module-as-course visibility and institute assignments

Revision ID: 0025
Revises: 0024
Create Date: 2026-07-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0025"
down_revision: Union[str, None] = "0024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("exam_modules") as batch_op:
        batch_op.add_column(sa.Column("is_visible", sa.Boolean(), nullable=False, server_default=sa.true()))
        batch_op.add_column(sa.Column("deleted_at", sa.DateTime(), nullable=True))
    op.create_index("ix_exam_modules_is_visible", "exam_modules", ["is_visible"])
    op.create_index("ix_exam_modules_deleted_at", "exam_modules", ["deleted_at"])
    op.create_table(
        "institute_modules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("institute_id", sa.Integer(), sa.ForeignKey("institutes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("module_id", sa.Integer(), sa.ForeignKey("exam_modules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assigned_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("assigned_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("institute_id", "module_id", name="uq_institute_module"),
    )
    op.create_index("ix_institute_modules_institute_id", "institute_modules", ["institute_id"])
    op.create_index("ix_institute_modules_module_id", "institute_modules", ["module_id"])


def downgrade() -> None:
    op.drop_index("ix_institute_modules_module_id", table_name="institute_modules")
    op.drop_index("ix_institute_modules_institute_id", table_name="institute_modules")
    op.drop_table("institute_modules")
    op.drop_index("ix_exam_modules_deleted_at", table_name="exam_modules")
    op.drop_index("ix_exam_modules_is_visible", table_name="exam_modules")
    with op.batch_alter_table("exam_modules") as batch_op:
        batch_op.drop_column("deleted_at")
        batch_op.drop_column("is_visible")
