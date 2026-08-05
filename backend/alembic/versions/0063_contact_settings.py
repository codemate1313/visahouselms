"""dynamic contact info and social links for the public site

Revision ID: 0063
Revises: 0062
Create Date: 2026-08-06

The public /contact page's info cards and the site footer's social icon row
were hardcoded into static HTML. This gives Super Admin a place to edit them:
a singleton `contact_settings` row for the info cards, and a `social_links`
table for the (variable-length, individually enable-able) footer icon list.
"""
from alembic import op
import sqlalchemy as sa

revision = "0063"
down_revision = "0062"
branch_labels = None
depends_on = None

CONTACT_TABLE = "contact_settings"
SOCIAL_TABLE = "social_links"


def upgrade() -> None:
    bind = op.get_bind()
    present = set(sa.inspect(bind).get_table_names())

    if CONTACT_TABLE not in present:
        op.create_table(
            CONTACT_TABLE,
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("email", sa.String(length=255), nullable=False, server_default="partners@visahouse.io"),
            sa.Column("email_note", sa.String(length=255), nullable=True, server_default="Replies within 1 working day"),
            sa.Column("phone", sa.String(length=50), nullable=False, server_default="+91 80 4700 8100"),
            sa.Column("phone_note", sa.String(length=255), nullable=True, server_default="Mon–Fri · 10am to 7pm IST"),
            sa.Column("support_url", sa.String(length=255), nullable=False, server_default="support.visahouse.io"),
            sa.Column("support_note", sa.String(length=255), nullable=True, server_default="Existing partners only"),
            sa.Column("office_name", sa.String(length=255), nullable=False, server_default="Visa House Learning Pvt. Ltd."),
            sa.Column(
                "office_address",
                sa.Text(),
                nullable=False,
                server_default="4th Floor, Prestige Meridian,\nMG Road, Bangalore 560001",
            ),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        )

    if SOCIAL_TABLE not in present:
        op.create_table(
            SOCIAL_TABLE,
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("platform", sa.String(length=50), nullable=False),
            sa.Column("url", sa.String(length=500), nullable=False),
            sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        )

        default_links_table = sa.table(
            SOCIAL_TABLE,
            sa.column("platform", sa.String),
            sa.column("url", sa.String),
            sa.column("is_enabled", sa.Boolean),
        )
        op.bulk_insert(
            default_links_table,
            [
                {"platform": "linkedin", "url": "https://linkedin.com", "is_enabled": True},
                {"platform": "github", "url": "https://github.com", "is_enabled": True},
                {"platform": "instagram", "url": "https://instagram.com", "is_enabled": True},
                {"platform": "youtube", "url": "https://youtube.com", "is_enabled": True},
            ],
        )


def downgrade() -> None:
    bind = op.get_bind()
    present = set(sa.inspect(bind).get_table_names())
    if SOCIAL_TABLE in present:
        op.drop_table(SOCIAL_TABLE)
    if CONTACT_TABLE in present:
        op.drop_table(CONTACT_TABLE)
