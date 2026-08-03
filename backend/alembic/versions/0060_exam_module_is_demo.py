"""add is_demo flag to exam_modules for free sample tests

Revision ID: 0060
Revises: 46e5c817bb04
Create Date: 2026-08-03

"""
from alembic import op
import sqlalchemy as sa

revision = "0060"
down_revision = "46e5c817bb04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("exam_modules")}
    if "is_demo" not in columns:
        op.add_column(
            "exam_modules",
            sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
        op.create_index("ix_exam_modules_is_demo", "exam_modules", ["is_demo"])


def downgrade() -> None:
    op.drop_index("ix_exam_modules_is_demo", table_name="exam_modules")
    op.drop_column("exam_modules", "is_demo")
