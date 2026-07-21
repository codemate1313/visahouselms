"""Add strict Final Test security state and audit metadata.

Revision ID: 0027
Revises: 0026
Create Date: 2026-07-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0027"
down_revision: Union[str, None] = "0026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("test_attempts") as batch_op:
        batch_op.add_column(sa.Column("security_required", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column("security_started_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("security_device_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("security_client_id", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("security_token_hash", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("security_ip_address", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("security_last_heartbeat_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("security_heartbeat_sequence", sa.Integer(), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("security_risk_score", sa.Integer(), nullable=False, server_default="0"))
        batch_op.add_column(sa.Column("security_media_state", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("content_snapshot", sa.JSON(), nullable=True))
        batch_op.create_foreign_key(
            "fk_test_attempts_security_device_id_user_devices",
            "user_devices",
            ["security_device_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("ix_test_attempts_security_device_id", ["security_device_id"], unique=False)

    op.execute("UPDATE test_attempts SET security_required = 1 WHERE is_final = 1")

    with op.batch_alter_table("attempt_answers") as batch_op:
        batch_op.add_column(sa.Column("revision", sa.Integer(), nullable=False, server_default="0"))

    with op.batch_alter_table("attempt_flags") as batch_op:
        batch_op.add_column(sa.Column("severity", sa.String(length=20), nullable=False, server_default="low"))
        batch_op.add_column(sa.Column("client_sequence", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("client_occurred_at", sa.DateTime(), nullable=True))
        batch_op.create_index("ix_attempt_flags_client_sequence", ["attempt_id", "client_sequence"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("attempt_flags") as batch_op:
        batch_op.drop_index("ix_attempt_flags_client_sequence")
        batch_op.drop_column("client_occurred_at")
        batch_op.drop_column("client_sequence")
        batch_op.drop_column("severity")

    with op.batch_alter_table("attempt_answers") as batch_op:
        batch_op.drop_column("revision")

    with op.batch_alter_table("test_attempts") as batch_op:
        batch_op.drop_index("ix_test_attempts_security_device_id")
        batch_op.drop_constraint("fk_test_attempts_security_device_id_user_devices", type_="foreignkey")
        batch_op.drop_column("content_snapshot")
        batch_op.drop_column("security_media_state")
        batch_op.drop_column("security_risk_score")
        batch_op.drop_column("security_heartbeat_sequence")
        batch_op.drop_column("security_last_heartbeat_at")
        batch_op.drop_column("security_ip_address")
        batch_op.drop_column("security_token_hash")
        batch_op.drop_column("security_client_id")
        batch_op.drop_column("security_device_id")
        batch_op.drop_column("security_started_at")
        batch_op.drop_column("security_required")
