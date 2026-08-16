"""contact_settings head and branch office fields

Revision ID: 0084
Revises: 0083
Create Date: 2026-08-17
"""
import sqlalchemy as sa
from alembic import op

revision = "0084"
down_revision = "0083"
branch_labels = None
depends_on = None

DEFAULT_HEAD_NAME = "Amritsar Office (Head Office)"
DEFAULT_HEAD_ADDR = "Mezzanine floor, Sco-21, B-Block, Ranjit Avenue, Amritsar, Punjab 143001"
DEFAULT_HEAD_LINK = "https://www.google.com/maps/place/VISA+HOUSE+immigration/@31.65075,74.8629167,17z"
DEFAULT_HEAD_EMBED = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3692.6816320116436!2d74.8629167!3d31.65075!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3919650028ff0af9%3A0x7c60b7408534d94d!2sVISA%20HOUSE%20immigration!5e0!3m2!1sen!2sin!4v1786779632431!5m2!1sen!2sin"

DEFAULT_BRANCH_NAME = "Tarn Taran Office (Branch Office)"
DEFAULT_BRANCH_ADDR = "Gali Lakeer Sahib Wali, Amritsar Bypass Road, Tarn Taran, Punjab 143401"
DEFAULT_BRANCH_LINK = "https://maps.app.goo.gl/9DfwXmJcfyzQnwC67"
DEFAULT_BRANCH_EMBED = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3403.475908208477!2d74.9170435!3d31.4638482!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39197f991e05cd0f%3A0x64c8d99f3ec4c656!2sVisa%20House!5e0!3m2!1sen!2sin!4v1786779800000!5m2!1sen!2sin"


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("contact_settings")} if "contact_settings" in insp.get_table_names() else set()

    with op.batch_alter_table("contact_settings") as batch:
        if "head_office_name" not in cols:
            batch.add_column(sa.Column("head_office_name", sa.String(length=255), nullable=True))
        if "head_office_address" not in cols:
            batch.add_column(sa.Column("head_office_address", sa.String(length=1000), nullable=True))
        if "head_office_map_link" not in cols:
            batch.add_column(sa.Column("head_office_map_link", sa.String(length=1000), nullable=True))
        if "head_office_map_embed" not in cols:
            batch.add_column(sa.Column("head_office_map_embed", sa.String(length=2000), nullable=True))
        if "branch_office_name" not in cols:
            batch.add_column(sa.Column("branch_office_name", sa.String(length=255), nullable=True))
        if "branch_office_address" not in cols:
            batch.add_column(sa.Column("branch_office_address", sa.String(length=1000), nullable=True))
        if "branch_office_map_link" not in cols:
            batch.add_column(sa.Column("branch_office_map_link", sa.String(length=1000), nullable=True))
        if "branch_office_map_embed" not in cols:
            batch.add_column(sa.Column("branch_office_map_embed", sa.String(length=2000), nullable=True))

    contact_table = sa.table(
        "contact_settings",
        sa.column("head_office_name", sa.String),
        sa.column("head_office_address", sa.String),
        sa.column("head_office_map_link", sa.String),
        sa.column("head_office_map_embed", sa.String),
        sa.column("branch_office_name", sa.String),
        sa.column("branch_office_address", sa.String),
        sa.column("branch_office_map_link", sa.String),
        sa.column("branch_office_map_embed", sa.String),
    )
    bind.execute(
        contact_table.update().values(
            head_office_name=DEFAULT_HEAD_NAME,
            head_office_address=DEFAULT_HEAD_ADDR,
            head_office_map_link=DEFAULT_HEAD_LINK,
            head_office_map_embed=DEFAULT_HEAD_EMBED,
            branch_office_name=DEFAULT_BRANCH_NAME,
            branch_office_address=DEFAULT_BRANCH_ADDR,
            branch_office_map_link=DEFAULT_BRANCH_LINK,
            branch_office_map_embed=DEFAULT_BRANCH_EMBED,
        )
    )


def downgrade() -> None:
    with op.batch_alter_table("contact_settings") as batch:
        batch.drop_column("branch_office_map_embed")
        batch.drop_column("branch_office_map_link")
        batch.drop_column("branch_office_address")
        batch.drop_column("branch_office_name")
        batch.drop_column("head_office_map_embed")
        batch.drop_column("head_office_map_link")
        batch.drop_column("head_office_address")
        batch.drop_column("head_office_name")
