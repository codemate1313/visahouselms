"""create instagram_settings table

Revision ID: 0078
Revises: 0077
Create Date: 2026-08-15

"""
from alembic import op
import sqlalchemy as sa

revision = "0078"
down_revision = "0077"
branch_labels = None
depends_on = None

TABLE = "instagram_settings"


def upgrade() -> None:
    bind = op.get_bind()
    present = set(sa.inspect(bind).get_table_names())

    if TABLE not in present:
        op.create_table(
            TABLE,
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("access_token", sa.Text(), nullable=True),
            sa.Column("instagram_account_id", sa.String(length=100), nullable=True),
            sa.Column("username", sa.String(length=100), nullable=False, server_default="visahouseimmigration"),
            sa.Column("fetch_limit", sa.Integer(), nullable=False, server_default="8"),
            sa.Column("feed_data_json", sa.Text(), nullable=True),
            sa.Column("last_fetched_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        )


def downgrade() -> None:
    bind = op.get_bind()
    present = set(sa.inspect(bind).get_table_names())
    if TABLE in present:
        op.drop_table(TABLE)
