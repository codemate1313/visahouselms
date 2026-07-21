"""course distribution controls and plan course bundles

Revision ID: 0023
Revises: 0022
Create Date: 2026-07-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0023"
down_revision: Union[str, None] = "0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("courses") as batch_op:
        batch_op.add_column(sa.Column("is_visible", sa.Boolean(), nullable=False, server_default=sa.true()))
        batch_op.add_column(sa.Column("deleted_at", sa.DateTime(), nullable=True))
    op.create_index("ix_courses_is_visible", "courses", ["is_visible"])
    op.create_index("ix_courses_deleted_at", "courses", ["deleted_at"])

    with op.batch_alter_table("plans") as batch_op:
        batch_op.add_column(sa.Column("audience", sa.String(30), nullable=False, server_default="both"))
        batch_op.add_column(sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.true()))

    op.create_table(
        "plan_courses",
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("plans.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_index("ix_plan_courses_course_id", "plan_courses", ["course_id"])


def downgrade() -> None:
    op.drop_index("ix_plan_courses_course_id", table_name="plan_courses")
    op.drop_table("plan_courses")
    with op.batch_alter_table("plans") as batch_op:
        batch_op.drop_column("is_published")
        batch_op.drop_column("audience")
    op.drop_index("ix_courses_deleted_at", table_name="courses")
    op.drop_index("ix_courses_is_visible", table_name="courses")
    with op.batch_alter_table("courses") as batch_op:
        batch_op.drop_column("deleted_at")
        batch_op.drop_column("is_visible")
