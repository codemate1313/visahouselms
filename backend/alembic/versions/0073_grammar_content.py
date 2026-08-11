"""grammar_contents table for SA Instructor grammar content / student study material

Revision ID: 0073
Revises: 0072
Create Date: 2026-08-11

"""
from alembic import op
import sqlalchemy as sa

revision = "0073"
down_revision = "0072"
branch_labels = None
depends_on = None

GRAMMAR_CONTENTS_TABLE = "grammar_contents"


def upgrade() -> None:
    bind = op.get_bind()
    present = set(sa.inspect(bind).get_table_names())

    if GRAMMAR_CONTENTS_TABLE not in present:
        op.create_table(
            GRAMMAR_CONTENTS_TABLE,
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("file_path", sa.String(length=500), nullable=False),
            sa.Column("file_name", sa.String(length=255), nullable=False),
            sa.Column("file_size", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        )
        op.create_index("ix_grammar_contents_is_active", GRAMMAR_CONTENTS_TABLE, ["is_active"])


def downgrade() -> None:
    bind = op.get_bind()
    present = set(sa.inspect(bind).get_table_names())
    if GRAMMAR_CONTENTS_TABLE in present:
        op.drop_table(GRAMMAR_CONTENTS_TABLE)
