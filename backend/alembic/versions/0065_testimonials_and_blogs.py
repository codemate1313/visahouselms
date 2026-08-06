"""testimonials and blog_posts tables for super-admin managed content

Revision ID: 0065
Revises: 0064
Create Date: 2026-08-07

The landing page's "Student success stories" and "Latest from our blog"
sections were hardcoded static content. Both features already have working
routers/schemas/admin UI (see testimonials_router.py, blogs_router.py) but
the tables were only ever created ad hoc via Base.metadata.create_all() in
the seed scripts, never through a real migration. This adds them properly,
guarded by existence checks since dev DBs may already have them.
"""
from alembic import op
import sqlalchemy as sa

revision = "0065"
down_revision = "0064"
branch_labels = None
depends_on = None

TESTIMONIALS_TABLE = "testimonials"
BLOG_POSTS_TABLE = "blog_posts"


def upgrade() -> None:
    bind = op.get_bind()
    present = set(sa.inspect(bind).get_table_names())

    if TESTIMONIALS_TABLE not in present:
        op.create_table(
            TESTIMONIALS_TABLE,
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("student_name", sa.String(length=255), nullable=False),
            sa.Column("student_role", sa.String(length=255), nullable=True, server_default="Academic IELTS Student"),
            sa.Column("target_score", sa.String(length=50), nullable=True, server_default="Band 7.5+"),
            sa.Column("avatar_url", sa.String(length=500), nullable=True),
            sa.Column("rating", sa.Integer(), nullable=False, server_default="5"),
            sa.Column("quote", sa.Text(), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_testimonials_is_active", TESTIMONIALS_TABLE, ["is_active"])
        op.create_index("ix_testimonials_display_order", TESTIMONIALS_TABLE, ["display_order"])

    if BLOG_POSTS_TABLE not in present:
        op.create_table(
            BLOG_POSTS_TABLE,
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("slug", sa.String(length=255), nullable=False),
            sa.Column("summary", sa.Text(), nullable=False),
            sa.Column("content_markdown", sa.Text(), nullable=False),
            sa.Column("featured_image_url", sa.String(length=500), nullable=True),
            sa.Column("category", sa.String(length=100), nullable=False, server_default="IELTS Tips"),
            sa.Column("tags", sa.String(length=255), nullable=True, server_default="IELTS, Preparation, Speaking, Writing"),
            sa.Column("author_name", sa.String(length=100), nullable=False, server_default="IELTS LMS Editorial Team"),
            sa.Column("read_time_minutes", sa.Integer(), nullable=False, server_default="5"),
            sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("meta_title", sa.String(length=255), nullable=True),
            sa.Column("meta_description", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_blog_posts_slug", BLOG_POSTS_TABLE, ["slug"], unique=True)
        op.create_index("ix_blog_posts_category", BLOG_POSTS_TABLE, ["category"])
        op.create_index("ix_blog_posts_is_published", BLOG_POSTS_TABLE, ["is_published"])


def downgrade() -> None:
    bind = op.get_bind()
    present = set(sa.inspect(bind).get_table_names())
    if BLOG_POSTS_TABLE in present:
        op.drop_table(BLOG_POSTS_TABLE)
    if TESTIMONIALS_TABLE in present:
        op.drop_table(TESTIMONIALS_TABLE)
