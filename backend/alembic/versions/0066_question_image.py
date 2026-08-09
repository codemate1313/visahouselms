"""exam module question image

Revision ID: 0066
Revises: 0065
Create Date: 2026-08-09

"""
from alembic import op
# pyrefly: ignore [missing-import]
import sqlalchemy as sa

revision = "0066"
down_revision = "0065"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Instructor-uploaded WebP visual (chart, diagram, photo) attached to a
    # single question - most commonly the Task 1 graph on a Writing prompt.
    op.add_column(
        "exam_module_questions",
        sa.Column("image_path", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("exam_module_questions", "image_path")
