"""exam module onboarding instructions

Revision ID: 0067
Revises: 0066
Create Date: 2026-08-09

"""
from alembic import op
# pyrefly: ignore [missing-import]
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "0067"
down_revision = "0066"
branch_labels = None
depends_on = None


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = inspect(op.get_bind())
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_column("exam_modules", "show_onboarding_instructions"):
        op.add_column(
            "exam_modules",
            sa.Column(
                "show_onboarding_instructions",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            ),
        )
        if bind.dialect.name != "sqlite":
            op.alter_column("exam_modules", "show_onboarding_instructions", server_default=None)

    if not _has_column("exam_modules", "onboarding_instructions"):
        op.add_column(
            "exam_modules",
            sa.Column("onboarding_instructions", sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    if _has_column("exam_modules", "onboarding_instructions"):
        op.drop_column("exam_modules", "onboarding_instructions")
    if _has_column("exam_modules", "show_onboarding_instructions"):
        op.drop_column("exam_modules", "show_onboarding_instructions")
