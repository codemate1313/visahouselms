"""Student device history, bound sessions, and archived accounts.

Revision ID: 0019
Revises: 0018
Create Date: 2026-07-21

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("deleted_at", sa.DateTime, nullable=True))
    op.create_index("ix_users_deleted_at", "users", ["deleted_at"])

    op.create_table(
        "user_devices",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("identifier_hash", sa.String(64), nullable=False),
        sa.Column("name", sa.String(120), nullable=True),
        sa.Column("user_agent", sa.String(255), nullable=True),
        sa.Column("last_ip_address", sa.String(64), nullable=True),
        sa.Column("login_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("first_seen_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("last_seen_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "identifier_hash", name="uq_user_device_identifier"),
    )
    op.create_index("ix_user_devices_user_id", "user_devices", ["user_id"])

    with op.batch_alter_table("user_sessions") as batch_op:
        batch_op.add_column(sa.Column("device_id", sa.Integer, nullable=True))
        batch_op.add_column(sa.Column("session_key", sa.String(64), nullable=True))
        batch_op.create_foreign_key(
            "fk_user_sessions_device_id",
            "user_devices",
            ["device_id"],
            ["id"],
            ondelete="SET NULL",
        )
    op.create_index("ix_user_sessions_device_id", "user_sessions", ["device_id"])
    op.create_index("uq_user_sessions_session_key", "user_sessions", ["session_key"], unique=True)


def downgrade() -> None:
    op.drop_index("uq_user_sessions_session_key", table_name="user_sessions")
    op.drop_index("ix_user_sessions_device_id", table_name="user_sessions")
    with op.batch_alter_table("user_sessions") as batch_op:
        batch_op.drop_constraint("fk_user_sessions_device_id", type_="foreignkey")
        batch_op.drop_column("session_key")
        batch_op.drop_column("device_id")
    op.drop_index("ix_user_devices_user_id", table_name="user_devices")
    op.drop_table("user_devices")
    op.drop_index("ix_users_deleted_at", table_name="users")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("deleted_at")
