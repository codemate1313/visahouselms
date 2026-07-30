"""repair legacy foreign keys and remove a stale SQLite batch table

Revision ID: 0045
Revises: 0044
Create Date: 2026-07-30

"""
from alembic import op
# pyrefly: ignore [missing-import]
import sqlalchemy as sa


revision = "0045"
down_revision = "0044"
branch_labels = None
depends_on = None


def _has_foreign_key(table_name: str, columns: list[str]) -> bool:
    inspector = sa.inspect(op.get_bind())
    return any(
        foreign_key.get("constrained_columns") == columns
        for foreign_key in inspector.get_foreign_keys(table_name)
    )


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "_alembic_tmp_ai_eval_limits" in inspector.get_table_names():
        op.drop_table("_alembic_tmp_ai_eval_limits")

    if not _has_foreign_key("ai_eval_limits", ["user_id"]):
        with op.batch_alter_table("ai_eval_limits") as batch:
            batch.create_foreign_key(
                "fk_ai_eval_limits_user_id",
                "users",
                ["user_id"],
                ["id"],
                ondelete="CASCADE",
            )

    if not _has_foreign_key("payments", ["course_id"]):
        with op.batch_alter_table("payments") as batch:
            batch.create_foreign_key(
                "fk_payments_course_id",
                "courses",
                ["course_id"],
                ["id"],
            )


def downgrade() -> None:
    if _has_foreign_key("payments", ["course_id"]):
        with op.batch_alter_table("payments") as batch:
            batch.drop_constraint("fk_payments_course_id", type_="foreignkey")
    if _has_foreign_key("ai_eval_limits", ["user_id"]):
        with op.batch_alter_table("ai_eval_limits") as batch:
            batch.drop_constraint("fk_ai_eval_limits_user_id", type_="foreignkey")
