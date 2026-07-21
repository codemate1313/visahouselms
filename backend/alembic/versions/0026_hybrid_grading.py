"""Phase 6 hybrid grading, moderation, and reevaluation workflow.

Revision ID: 0026
Revises: 0025
Create Date: 2026-07-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0026"
down_revision: Union[str, None] = "0025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "grading_queue",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("attempt_id", sa.Integer, sa.ForeignKey("test_attempts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("assigned_to_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("routing_reason", sa.String(50), nullable=False, server_default="standard"),
        sa.Column("priority", sa.Integer, nullable=False, server_default="0"),
        sa.Column("due_at", sa.DateTime, nullable=True),
        sa.Column("claimed_at", sa.DateTime, nullable=True),
        sa.Column("completed_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=True),
        sa.UniqueConstraint("attempt_id", name="uq_grading_queue_attempt"),
    )
    op.create_index("ix_grading_queue_attempt_id", "grading_queue", ["attempt_id"])
    op.create_index("ix_grading_queue_status", "grading_queue", ["status"])

    op.create_table(
        "ai_evaluations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("attempt_id", sa.Integer, sa.ForeignKey("test_attempts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("part_id", sa.Integer, sa.ForeignKey("exam_module_parts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("requested_by_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(60), nullable=False),
        sa.Column("model", sa.String(120), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="completed"),
        sa.Column("suggestions", sa.JSON, nullable=True),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_ai_evaluations_attempt_id", "ai_evaluations", ["attempt_id"])

    op.create_table(
        "ai_eval_limits",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("scope_key", sa.String(80), nullable=False),
        sa.Column("institute_id", sa.Integer, sa.ForeignKey("institutes.id", ondelete="CASCADE"), nullable=True),
        sa.Column("period_key", sa.String(7), nullable=False),
        sa.Column("monthly_limit", sa.Integer, nullable=False),
        sa.Column("used_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime, nullable=True),
        sa.UniqueConstraint("scope_key", name="uq_ai_eval_limits_scope"),
    )
    op.create_index("ix_ai_eval_limits_institute_id", "ai_eval_limits", ["institute_id"])
    op.create_index("ix_ai_eval_limits_period_key", "ai_eval_limits", ["period_key"])

    op.create_table(
        "reevaluation_requests",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("attempt_id", sa.Integer, sa.ForeignKey("test_attempts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assigned_to_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reason", sa.Text, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("resolution_note", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_reevaluation_requests_attempt_id", "reevaluation_requests", ["attempt_id"])
    op.create_index("ix_reevaluation_requests_student_id", "reevaluation_requests", ["student_id"])
    op.create_index("ix_reevaluation_requests_status", "reevaluation_requests", ["status"])

    op.execute(
        "INSERT INTO grading_queue (attempt_id, status, routing_reason, priority, completed_at) "
        "SELECT id, CASE WHEN status = 'graded' THEN 'completed' ELSE 'pending' END, "
        "'legacy_backfill', 0, CASE WHEN status = 'graded' THEN graded_at ELSE NULL END "
        "FROM test_attempts WHERE status IN ('grading', 'graded')"
    )


def downgrade() -> None:
    op.drop_index("ix_reevaluation_requests_status", table_name="reevaluation_requests")
    op.drop_index("ix_reevaluation_requests_student_id", table_name="reevaluation_requests")
    op.drop_index("ix_reevaluation_requests_attempt_id", table_name="reevaluation_requests")
    op.drop_table("reevaluation_requests")
    op.drop_index("ix_ai_eval_limits_period_key", table_name="ai_eval_limits")
    op.drop_index("ix_ai_eval_limits_institute_id", table_name="ai_eval_limits")
    op.drop_table("ai_eval_limits")
    op.drop_index("ix_ai_evaluations_attempt_id", table_name="ai_evaluations")
    op.drop_table("ai_evaluations")
    op.drop_index("ix_grading_queue_status", table_name="grading_queue")
    op.drop_index("ix_grading_queue_attempt_id", table_name="grading_queue")
    op.drop_table("grading_queue")
