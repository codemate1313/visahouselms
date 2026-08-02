"""add part-level ai evaluation toggle

Revision ID: 0056
Revises: 0055
Create Date: 2026-08-02

"""
from alembic import op
import sqlalchemy as sa


revision = "0056"
down_revision = "0055"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "exam_module_parts",
        sa.Column("ai_evaluation_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute(
        """
        UPDATE exam_module_parts
        SET ai_evaluation_enabled = TRUE
        WHERE auto_marked = 0 AND section_type IN ('writing', 'speaking')
        """
    )


def downgrade() -> None:
    op.drop_column("exam_module_parts", "ai_evaluation_enabled")
