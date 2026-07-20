"""Replace Phase 3.3 authoring with module-first assessment authoring.

Revision ID: 0014
Revises: 0013
Create Date: 2026-07-20

The old course/question-bank/test tables are deliberately retained so an
existing installation can migrate without destroying previously entered data.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "exam_modules",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("module_type", sa.String(30), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.String(2000), nullable=True),
        sa.Column("instructions", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("duration_minutes", sa.Integer, nullable=False),
        sa.Column("blueprint_version", sa.String(80), nullable=False, server_default="LanguageCert Academic 2025"),
        sa.Column("created_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("published_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_exam_modules_module_type", "exam_modules", ["module_type"])
    op.create_index("ix_exam_modules_status", "exam_modules", ["status"])
    op.create_index("ix_exam_modules_created_by_id", "exam_modules", ["created_by_id"])

    op.create_table(
        "exam_module_parts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("module_id", sa.Integer, sa.ForeignKey("exam_modules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("section_type", sa.String(20), nullable=False),
        sa.Column("part_code", sa.String(40), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("skill_focus", sa.Text, nullable=False),
        sa.Column("instructions", sa.Text, nullable=True),
        sa.Column("question_limit", sa.Integer, nullable=True),
        sa.Column("minimum_questions", sa.Integer, nullable=False, server_default="1"),
        sa.Column("max_marks", sa.Numeric(7, 2), nullable=True),
        sa.Column("duration_minutes", sa.Integer, nullable=True),
        sa.Column("auto_marked", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("answer_constraints", sa.JSON, nullable=False),
        sa.Column("rubric", sa.JSON, nullable=False),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.UniqueConstraint("module_id", "part_code", name="uq_exam_module_part_code"),
    )
    op.create_index("ix_exam_module_parts_module_id", "exam_module_parts", ["module_id"])
    op.create_index("ix_exam_module_parts_section_type", "exam_module_parts", ["section_type"])

    op.create_table(
        "exam_module_questions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("part_id", sa.Integer, sa.ForeignKey("exam_module_parts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_type", sa.String(40), nullable=False),
        sa.Column("prompt", sa.Text, nullable=False),
        sa.Column("instructions", sa.Text, nullable=True),
        sa.Column("passage", sa.Text, nullable=True),
        sa.Column("options", sa.JSON, nullable=False),
        sa.Column("correct_answers", sa.JSON, nullable=False),
        sa.Column("explanation", sa.Text, nullable=True),
        sa.Column("points", sa.Numeric(7, 2), nullable=False, server_default="1"),
        sa.Column("difficulty", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("source_type", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("source_filename", sa.String(255), nullable=True),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_exam_module_questions_part_id", "exam_module_questions", ["part_id"])
    op.create_index("ix_exam_module_questions_question_type", "exam_module_questions", ["question_type"])
    op.create_index("ix_exam_module_questions_created_by_id", "exam_module_questions", ["created_by_id"])

    op.create_table(
        "exam_module_assets",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("module_id", sa.Integer, sa.ForeignKey("exam_modules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("part_id", sa.Integer, sa.ForeignKey("exam_module_parts.id", ondelete="CASCADE"), nullable=True),
        sa.Column("asset_type", sa.String(20), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False, unique=True),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("file_size", sa.Integer, nullable=False),
        sa.Column("transcript", sa.Text, nullable=True),
        sa.Column("tts_voice", sa.String(120), nullable=True),
        sa.Column("uploaded_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_exam_module_assets_module_id", "exam_module_assets", ["module_id"])
    op.create_index("ix_exam_module_assets_part_id", "exam_module_assets", ["part_id"])


def downgrade() -> None:
    op.drop_index("ix_exam_module_assets_part_id", table_name="exam_module_assets")
    op.drop_index("ix_exam_module_assets_module_id", table_name="exam_module_assets")
    op.drop_table("exam_module_assets")
    op.drop_index("ix_exam_module_questions_created_by_id", table_name="exam_module_questions")
    op.drop_index("ix_exam_module_questions_question_type", table_name="exam_module_questions")
    op.drop_index("ix_exam_module_questions_part_id", table_name="exam_module_questions")
    op.drop_table("exam_module_questions")
    op.drop_index("ix_exam_module_parts_section_type", table_name="exam_module_parts")
    op.drop_index("ix_exam_module_parts_module_id", table_name="exam_module_parts")
    op.drop_table("exam_module_parts")
    op.drop_index("ix_exam_modules_created_by_id", table_name="exam_modules")
    op.drop_index("ix_exam_modules_status", table_name="exam_modules")
    op.drop_index("ix_exam_modules_module_type", table_name="exam_modules")
    op.drop_table("exam_modules")
