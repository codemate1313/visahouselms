"""question interaction metadata

Revision ID: 0071
Revises: 0070
Create Date: 2026-08-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "0071"
down_revision = "0070"
branch_labels = None
depends_on = None


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = inspect(op.get_bind())
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    if not _has_column("exam_module_questions", "interaction"):
        op.add_column(
            "exam_module_questions",
            sa.Column("interaction", sa.JSON(), nullable=True),
        )
        op.execute(
            sa.text(
                "UPDATE exam_module_questions "
                "SET interaction = :empty_object "
                "WHERE interaction IS NULL"
            ).bindparams(empty_object="{}")
        )

        if op.get_bind().dialect.name == "sqlite":
            with op.batch_alter_table("exam_module_questions") as batch_op:
                batch_op.alter_column(
                    "interaction",
                    existing_type=sa.JSON(),
                    nullable=False,
                )
        else:
            op.alter_column(
                "exam_module_questions",
                "interaction",
                existing_type=sa.JSON(),
                nullable=False,
            )


def downgrade() -> None:
    if _has_column("exam_module_questions", "interaction"):
        op.drop_column("exam_module_questions", "interaction")
