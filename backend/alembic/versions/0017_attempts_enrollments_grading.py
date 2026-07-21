"""Phase 3.2/3.4: course-module bundling, B2C enrollments, and the student
test-attempt + grading engine.

Revision ID: 0017
Revises: 0016
Create Date: 2026-07-20

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "course_modules",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("course_id", sa.Integer, sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("module_id", sa.Integer, sa.ForeignKey("exam_modules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("course_id", "module_id", name="uq_course_module"),
    )
    op.create_index("ix_course_modules_course_id", "course_modules", ["course_id"])
    op.create_index("ix_course_modules_module_id", "course_modules", ["module_id"])

    op.create_table(
        "enrollments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", sa.Integer, sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source", sa.String(30), nullable=False),
        sa.Column("payment_id", sa.Integer, sa.ForeignKey("payments.id"), nullable=True),
        sa.Column("institute_course_id", sa.Integer, sa.ForeignKey("institute_courses.id"), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("granted_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime, nullable=True),
        sa.UniqueConstraint("user_id", "course_id", name="uq_enrollment_user_course"),
    )
    op.create_index("ix_enrollments_user_id", "enrollments", ["user_id"])
    op.create_index("ix_enrollments_course_id", "enrollments", ["course_id"])

    op.create_table(
        "test_attempts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("module_id", sa.Integer, sa.ForeignKey("exam_modules.id"), nullable=False),
        sa.Column("course_id", sa.Integer, sa.ForeignKey("courses.id"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="in_progress"),
        sa.Column("is_final", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("started_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("submitted_at", sa.DateTime, nullable=True),
        sa.Column("raw_score", sa.Numeric(7, 2), nullable=True),
        sa.Column("max_score", sa.Numeric(7, 2), nullable=True),
        sa.Column("band_label", sa.String(60), nullable=True),
        sa.Column("graded_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_test_attempts_user_id", "test_attempts", ["user_id"])
    op.create_index("ix_test_attempts_module_id", "test_attempts", ["module_id"])
    op.create_index("ix_test_attempts_status", "test_attempts", ["status"])

    op.create_table(
        "attempt_answers",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("attempt_id", sa.Integer, sa.ForeignKey("test_attempts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", sa.Integer, sa.ForeignKey("exam_module_questions.id"), nullable=False),
        sa.Column("part_id", sa.Integer, sa.ForeignKey("exam_module_parts.id"), nullable=False),
        sa.Column("response", sa.JSON, nullable=True),
        sa.Column("is_correct", sa.Boolean, nullable=True),
        sa.Column("points_awarded", sa.Numeric(7, 2), nullable=True),
        sa.Column("audio_path", sa.String(500), nullable=True),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint("attempt_id", "question_id", name="uq_attempt_answer_question"),
    )
    op.create_index("ix_attempt_answers_attempt_id", "attempt_answers", ["attempt_id"])
    op.create_index("ix_attempt_answers_question_id", "attempt_answers", ["question_id"])
    op.create_index("ix_attempt_answers_part_id", "attempt_answers", ["part_id"])

    op.create_table(
        "attempt_part_grades",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("attempt_id", sa.Integer, sa.ForeignKey("test_attempts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("part_id", sa.Integer, sa.ForeignKey("exam_module_parts.id"), nullable=False),
        sa.Column("criteria", sa.JSON, nullable=False),
        sa.Column("total_marks", sa.Numeric(7, 2), nullable=True),
        sa.Column("comment", sa.Text, nullable=True),
        sa.Column("grader_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("graded_at", sa.DateTime, nullable=True),
        sa.UniqueConstraint("attempt_id", "part_id", name="uq_attempt_part_grade"),
    )
    op.create_index("ix_attempt_part_grades_attempt_id", "attempt_part_grades", ["attempt_id"])
    op.create_index("ix_attempt_part_grades_part_id", "attempt_part_grades", ["part_id"])

    op.create_table(
        "attempt_flags",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("attempt_id", sa.Integer, sa.ForeignKey("test_attempts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("flag_type", sa.String(30), nullable=False),
        sa.Column("occurred_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("meta", sa.JSON, nullable=True),
    )
    op.create_index("ix_attempt_flags_attempt_id", "attempt_flags", ["attempt_id"])

    # payments.course_id predates the Course table and was left without a
    # real FK ("no FK yet - Phase 3"); add it now that courses are wired up.
    # Any existing rows referencing a course id that no longer exists would
    # break this - none are expected pre-launch, but guard anyway.
    op.execute(
        "UPDATE payments SET course_id = NULL WHERE course_id IS NOT NULL "
        "AND course_id NOT IN (SELECT id FROM courses)"
    )
    op.create_foreign_key(
        "fk_payments_course_id", "payments", "courses", ["course_id"], ["id"]
    )


def downgrade() -> None:
    op.drop_constraint("fk_payments_course_id", "payments", type_="foreignkey")

    op.drop_index("ix_attempt_flags_attempt_id", table_name="attempt_flags")
    op.drop_table("attempt_flags")

    op.drop_index("ix_attempt_part_grades_part_id", table_name="attempt_part_grades")
    op.drop_index("ix_attempt_part_grades_attempt_id", table_name="attempt_part_grades")
    op.drop_table("attempt_part_grades")

    op.drop_index("ix_attempt_answers_part_id", table_name="attempt_answers")
    op.drop_index("ix_attempt_answers_question_id", table_name="attempt_answers")
    op.drop_index("ix_attempt_answers_attempt_id", table_name="attempt_answers")
    op.drop_table("attempt_answers")

    op.drop_index("ix_test_attempts_status", table_name="test_attempts")
    op.drop_index("ix_test_attempts_module_id", table_name="test_attempts")
    op.drop_index("ix_test_attempts_user_id", table_name="test_attempts")
    op.drop_table("test_attempts")

    op.drop_index("ix_enrollments_course_id", table_name="enrollments")
    op.drop_index("ix_enrollments_user_id", table_name="enrollments")
    op.drop_table("enrollments")

    op.drop_index("ix_course_modules_module_id", table_name="course_modules")
    op.drop_index("ix_course_modules_course_id", table_name="course_modules")
    op.drop_table("course_modules")
