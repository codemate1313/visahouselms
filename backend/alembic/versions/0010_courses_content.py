"""Phase 3.2: courses, PDF/MP3 assets, and institute assignments

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-20

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "courses",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(220), nullable=False, unique=True),
        sa.Column("summary", sa.String(500), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("level", sa.String(30), nullable=False, server_default="all_levels"),
        sa.Column("estimated_duration_minutes", sa.Integer, nullable=True),
        sa.Column("price", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(8), nullable=False, server_default="INR"),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("is_featured", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("created_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("published_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_courses_slug", "courses", ["slug"])
    op.create_index("ix_courses_status", "courses", ["status"])
    op.create_index("ix_courses_created_by_id", "courses", ["created_by_id"])

    op.create_table(
        "course_assets",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("course_id", sa.Integer, sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("asset_type", sa.String(20), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False, unique=True),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column("file_size", sa.Integer, nullable=False),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("uploaded_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_course_assets_course_id", "course_assets", ["course_id"])

    op.create_table(
        "institute_courses",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("institute_id", sa.Integer, sa.ForeignKey("institutes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", sa.Integer, sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assigned_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("assigned_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=True),
        sa.UniqueConstraint("institute_id", "course_id", name="uq_institute_course"),
    )
    op.create_index("ix_institute_courses_institute_id", "institute_courses", ["institute_id"])
    op.create_index("ix_institute_courses_course_id", "institute_courses", ["course_id"])


def downgrade() -> None:
    op.drop_index("ix_institute_courses_course_id", table_name="institute_courses")
    op.drop_index("ix_institute_courses_institute_id", table_name="institute_courses")
    op.drop_table("institute_courses")
    op.drop_index("ix_course_assets_course_id", table_name="course_assets")
    op.drop_table("course_assets")
    op.drop_index("ix_courses_created_by_id", table_name="courses")
    op.drop_index("ix_courses_status", table_name="courses")
    op.drop_index("ix_courses_slug", table_name="courses")
    op.drop_table("courses")
