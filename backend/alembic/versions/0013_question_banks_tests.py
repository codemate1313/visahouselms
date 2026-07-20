"""Phase 3.3: question banks and test builder

Revision ID: 0013
Revises: 0012
Create Date: 2026-07-20
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "question_banks",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("course_id", sa.Integer, sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.String(1000), nullable=True),
        sa.Column("section", sa.String(20), nullable=False),
        sa.Column("created_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_question_banks_course_id", "question_banks", ["course_id"])
    op.create_index("ix_question_banks_section", "question_banks", ["section"])
    op.create_index("ix_question_banks_created_by_id", "question_banks", ["created_by_id"])

    op.create_table(
        "questions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("bank_id", sa.Integer, sa.ForeignKey("question_banks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_type", sa.String(40), nullable=False),
        sa.Column("prompt", sa.Text, nullable=False),
        sa.Column("instructions", sa.Text, nullable=True),
        sa.Column("passage", sa.Text, nullable=True),
        sa.Column("options", sa.JSON, nullable=False),
        sa.Column("correct_answers", sa.JSON, nullable=False),
        sa.Column("explanation", sa.Text, nullable=True),
        sa.Column("points", sa.Numeric(6, 2), nullable=False, server_default="1"),
        sa.Column("difficulty", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("source_type", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("source_filename", sa.String(255), nullable=True),
        sa.Column("created_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_questions_bank_id", "questions", ["bank_id"])
    op.create_index("ix_questions_question_type", "questions", ["question_type"])
    op.create_index("ix_questions_created_by_id", "questions", ["created_by_id"])

    op.create_table(
        "assessments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("course_id", sa.Integer, sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.String(1000), nullable=True),
        sa.Column("assessment_type", sa.String(30), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("duration_minutes", sa.Integer, nullable=True),
        sa.Column("instructions", sa.Text, nullable=True),
        sa.Column("created_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("published_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_assessments_course_id", "assessments", ["course_id"])
    op.create_index("ix_assessments_assessment_type", "assessments", ["assessment_type"])
    op.create_index("ix_assessments_status", "assessments", ["status"])
    op.create_index("ix_assessments_created_by_id", "assessments", ["created_by_id"])

    op.create_table(
        "assessment_questions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("assessment_id", sa.Integer, sa.ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", sa.Integer, sa.ForeignKey("questions.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("points_override", sa.Numeric(6, 2), nullable=True),
        sa.UniqueConstraint("assessment_id", "question_id", name="uq_assessment_question"),
    )
    op.create_index("ix_assessment_questions_assessment_id", "assessment_questions", ["assessment_id"])
    op.create_index("ix_assessment_questions_question_id", "assessment_questions", ["question_id"])


def downgrade() -> None:
    op.drop_index("ix_assessment_questions_question_id", table_name="assessment_questions")
    op.drop_index("ix_assessment_questions_assessment_id", table_name="assessment_questions")
    op.drop_table("assessment_questions")
    op.drop_index("ix_assessments_created_by_id", table_name="assessments")
    op.drop_index("ix_assessments_status", table_name="assessments")
    op.drop_index("ix_assessments_assessment_type", table_name="assessments")
    op.drop_index("ix_assessments_course_id", table_name="assessments")
    op.drop_table("assessments")
    op.drop_index("ix_questions_created_by_id", table_name="questions")
    op.drop_index("ix_questions_question_type", table_name="questions")
    op.drop_index("ix_questions_bank_id", table_name="questions")
    op.drop_table("questions")
    op.drop_index("ix_question_banks_created_by_id", table_name="question_banks")
    op.drop_index("ix_question_banks_section", table_name="question_banks")
    op.drop_index("ix_question_banks_course_id", table_name="question_banks")
    op.drop_table("question_banks")
