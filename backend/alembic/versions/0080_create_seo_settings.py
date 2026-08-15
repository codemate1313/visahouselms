"""create the seo_settings table

The SEOSetting model and /seo-settings router shipped without a migration, so a
database built only from migrations - which is what a fresh deploy does - has no
such table and every SEO settings read or write fails. Existing databases picked
the table up another way and were unaffected, which is why it went unnoticed.

Created conditionally so it is a no-op on those existing databases.

Revision ID: 0080
Revises: 0079
Create Date: 2026-08-15
"""
from alembic import op
import sqlalchemy as sa

revision = "0080"
down_revision = "0079"
branch_labels = None
depends_on = None

TABLE = "seo_settings"


def upgrade() -> None:
    bind = op.get_bind()
    if TABLE in sa.inspect(bind).get_table_names():
        return
    op.create_table(
        TABLE,
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("site_name", sa.String(length=255), nullable=True),
        sa.Column("default_title", sa.String(length=255), nullable=True),
        sa.Column("title_template", sa.String(length=255), nullable=True),
        sa.Column("default_meta_description", sa.Text(), nullable=True),
        sa.Column("default_meta_keywords", sa.Text(), nullable=True),
        sa.Column("default_og_image", sa.String(length=500), nullable=True),
        sa.Column("twitter_handle", sa.String(length=100), nullable=True),
        sa.Column("robots_txt", sa.Text(), nullable=True),
        sa.Column("custom_head_tags", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table(TABLE)
