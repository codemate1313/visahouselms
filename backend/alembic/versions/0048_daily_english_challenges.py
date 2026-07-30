"""add daily English challenges

Revision ID: 0048
Revises: 0047
Create Date: 2026-07-30

"""
from alembic import op
# pyrefly: ignore [missing-import]
import sqlalchemy as sa


revision = "0048"
down_revision = "0047"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "daily_english_challenges",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("challenge_date", sa.Date(), nullable=False),
        sa.Column("question_keys", sa.JSON(), nullable=False),
        sa.Column("answers", sa.JSON(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "challenge_date", name="uq_daily_english_student_date"),
    )
    op.create_index(op.f("ix_daily_english_challenges_user_id"), "daily_english_challenges", ["user_id"], unique=False)
    op.create_index(op.f("ix_daily_english_challenges_challenge_date"), "daily_english_challenges", ["challenge_date"], unique=False)
    op.create_index(op.f("ix_daily_english_challenges_completed_at"), "daily_english_challenges", ["completed_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_daily_english_challenges_completed_at"), table_name="daily_english_challenges")
    op.drop_index(op.f("ix_daily_english_challenges_challenge_date"), table_name="daily_english_challenges")
    op.drop_index(op.f("ix_daily_english_challenges_user_id"), table_name="daily_english_challenges")
    op.drop_table("daily_english_challenges")
