"""add ACID consistency guards

Revision ID: 0044
Revises: 0043
Create Date: 2026-07-30

"""
from alembic import op
# pyrefly: ignore [missing-import]
import sqlalchemy as sa


revision = "0044"
down_revision = "0043"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "uq_test_attempt_final_user_module",
        "test_attempts",
        ["user_id", "module_id"],
        unique=True,
        sqlite_where=sa.text("is_final = 1"),
        postgresql_where=sa.text("is_final = true"),
    )
    op.create_index(
        "uq_test_attempt_active_user_module",
        "test_attempts",
        ["user_id", "module_id"],
        unique=True,
        sqlite_where=sa.text("status = 'in_progress'"),
        postgresql_where=sa.text("status = 'in_progress'"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_test_attempt_active_user_module",
        table_name="test_attempts",
    )
    op.drop_index(
        "uq_test_attempt_final_user_module",
        table_name="test_attempts",
    )
