"""traffic_events table for site analytics

Revision ID: 0063
Revises: 0062
Create Date: 2026-08-05

Backs the developer panel's traffic view: one row per page view or click,
reported by the browser. Indexed on the columns the aggregates group by -
created_at for the time series, path for the top-pages list, visitor_id for the
unique-visitor count, event_type to split views from clicks.
"""
from alembic import op
import sqlalchemy as sa

revision = "0063"
down_revision = "0062"
branch_labels = None
depends_on = None

TABLE = "traffic_events"


def upgrade() -> None:
    bind = op.get_bind()
    if TABLE in sa.inspect(bind).get_table_names():
        return

    op.create_table(
        TABLE,
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_type", sa.String(length=20), nullable=False),
        sa.Column("path", sa.String(length=500), nullable=False),
        sa.Column("referrer", sa.String(length=500), nullable=True),
        sa.Column("visitor_id", sa.String(length=64), nullable=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("label", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
    )
    op.create_index("ix_traffic_events_event_type", TABLE, ["event_type"])
    op.create_index("ix_traffic_events_path", TABLE, ["path"])
    op.create_index("ix_traffic_events_visitor_id", TABLE, ["visitor_id"])
    op.create_index("ix_traffic_events_created_at", TABLE, ["created_at"])


def downgrade() -> None:
    bind = op.get_bind()
    if TABLE not in sa.inspect(bind).get_table_names():
        return
    op.drop_table(TABLE)
