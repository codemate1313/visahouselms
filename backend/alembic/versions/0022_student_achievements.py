"""Student badges and institute leaderboard snapshots.

Revision ID: 0022
Revises: 0021
Create Date: 2026-07-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    badges = op.create_table(
        "badges",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("icon", sa.String(40), nullable=False),
        sa.Column("criteria", sa.JSON, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("code", name="uq_badges_code"),
    )
    op.create_index("ix_badges_code", "badges", ["code"])

    op.bulk_insert(
        badges,
        [
            {"code": "FIRST_TEST", "name": "First Step", "description": "Complete your first graded test.", "icon": "flag", "criteria": {"graded_attempts": 1}, "is_active": True},
            {"code": "CEFR_B2", "name": "Independent User", "description": "Demonstrate CEFR B2 or higher in a graded test.", "icon": "compass", "criteria": {"minimum_cefr": "B2"}, "is_active": True},
            {"code": "CEFR_C1", "name": "Advanced Communicator", "description": "Demonstrate CEFR C1 or higher in a graded test.", "icon": "spark", "criteria": {"minimum_cefr": "C1"}, "is_active": True},
            {"code": "CEFR_C2", "name": "Mastery", "description": "Demonstrate CEFR C2 in a graded test.", "icon": "crown", "criteria": {"minimum_cefr": "C2"}, "is_active": True},
            {"code": "FOUR_SKILLS", "name": "Four Skills", "description": "Complete assessed work in Listening, Reading, Writing, and Speaking.", "icon": "grid", "criteria": {"skills": 4}, "is_active": True},
            {"code": "PERFECT_OBJECTIVE", "name": "Perfect Accuracy", "description": "Earn full marks in an auto-marked test.", "icon": "target", "criteria": {"objective_percentage": 100}, "is_active": True},
            {"code": "TEN_TESTS", "name": "Committed Learner", "description": "Complete ten graded tests.", "icon": "streak", "criteria": {"graded_attempts": 10}, "is_active": True},
        ],
    )

    op.create_table(
        "student_badges",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("badge_id", sa.Integer, sa.ForeignKey("badges.id", ondelete="CASCADE"), nullable=False),
        sa.Column("attempt_id", sa.Integer, sa.ForeignKey("test_attempts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("awarded_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "badge_id", name="uq_student_badge"),
    )
    op.create_index("ix_student_badges_user_id", "student_badges", ["user_id"])
    op.create_index("ix_student_badges_badge_id", "student_badges", ["badge_id"])

    op.create_table(
        "leaderboard_snapshots",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("institute_id", sa.Integer, sa.ForeignKey("institutes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("period_key", sa.String(30), nullable=False, server_default="all_time"),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rank", sa.Integer, nullable=False),
        sa.Column("attempts_count", sa.Integer, nullable=False),
        sa.Column("average_percentage", sa.Numeric(5, 2), nullable=False),
        sa.Column("best_cefr_level", sa.String(20), nullable=True),
        sa.Column("generated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("institute_id", "period_key", "user_id", name="uq_leaderboard_student_period"),
    )
    op.create_index("ix_leaderboard_snapshots_institute_id", "leaderboard_snapshots", ["institute_id"])
    op.create_index("ix_leaderboard_snapshots_period_key", "leaderboard_snapshots", ["period_key"])
    op.create_index("ix_leaderboard_snapshots_user_id", "leaderboard_snapshots", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_leaderboard_snapshots_user_id", table_name="leaderboard_snapshots")
    op.drop_index("ix_leaderboard_snapshots_period_key", table_name="leaderboard_snapshots")
    op.drop_index("ix_leaderboard_snapshots_institute_id", table_name="leaderboard_snapshots")
    op.drop_table("leaderboard_snapshots")
    op.drop_index("ix_student_badges_badge_id", table_name="student_badges")
    op.drop_index("ix_student_badges_user_id", table_name="student_badges")
    op.drop_table("student_badges")
    op.drop_index("ix_badges_code", table_name="badges")
    op.drop_table("badges")
