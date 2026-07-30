"""store browser TTS playback settings

Revision ID: 0049
Revises: 0048
Create Date: 2026-07-30

"""
from alembic import op
# pyrefly: ignore [missing-import]
import sqlalchemy as sa


revision = "0049"
down_revision = "0048"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "exam_module_assets",
        sa.Column("tts_rate", sa.String(length=12), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("exam_module_assets", "tts_rate")
