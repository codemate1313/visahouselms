"""create the hero_slides table

The public home hero and the login/register hero both rendered from hardcoded
frontend arrays (the login one was editable only into the Super Admin's own
localStorage, so nothing ever reached other visitors). Both now read from this
table; the router seeds the shipped defaults on first read.

Revision ID: 0092
Revises: 0091
Create Date: 2026-08-25
"""
from alembic import op
import sqlalchemy as sa

revision = "0092"
down_revision = "0091"
branch_labels = None
depends_on = None

TABLE = "hero_slides"


def upgrade() -> None:
    bind = op.get_bind()
    if TABLE in sa.inspect(bind).get_table_names():
        return
    op.create_table(
        TABLE,
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("location", sa.String(length=20), nullable=False, server_default="home"),
        sa.Column("badge", sa.String(length=255), nullable=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("highlight", sa.String(length=255), nullable=True),
        sa.Column("subtitle", sa.Text(), nullable=True),
        sa.Column("image_url", sa.String(length=1000), nullable=False),
        sa.Column("cta_text", sa.String(length=255), nullable=True),
        sa.Column("cta_link", sa.String(length=500), nullable=True),
        sa.Column("alt_text", sa.String(length=255), nullable=True),
        sa.Column("alt_link", sa.String(length=500), nullable=True),
        sa.Column("stats", sa.JSON(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_index(f"ix_{TABLE}_location", TABLE, ["location"])
    op.create_index(f"ix_{TABLE}_is_active", TABLE, ["is_active"])
    op.create_index(f"ix_{TABLE}_display_order", TABLE, ["display_order"])


def downgrade() -> None:
    op.drop_index(f"ix_{TABLE}_display_order", table_name=TABLE)
    op.drop_index(f"ix_{TABLE}_is_active", table_name=TABLE)
    op.drop_index(f"ix_{TABLE}_location", table_name=TABLE)
    op.drop_table(TABLE)
