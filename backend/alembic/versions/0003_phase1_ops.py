"""phase 1 ops tables: error_logs, request_logs, crash_logs, jobs, backups

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-19

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "error_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("level", sa.String(20), nullable=False, server_default="ERROR"),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("stack_trace", sa.Text, nullable=True),
        sa.Column("path", sa.String(500), nullable=True),
        sa.Column("method", sa.String(10), nullable=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_error_logs_created_at", "error_logs", ["created_at"])

    op.create_table(
        "request_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("method", sa.String(10), nullable=False),
        sa.Column("path", sa.String(500), nullable=False),
        sa.Column("status_code", sa.Integer, nullable=False),
        sa.Column("latency_ms", sa.Integer, nullable=False),
        sa.Column("user_id", sa.Integer, nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.String(255), nullable=True),
        sa.Column("request_bytes", sa.Integer, nullable=True),
        sa.Column("response_bytes", sa.Integer, nullable=True),
        sa.Column("headers", sa.JSON, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_request_logs_created_at", "request_logs", ["created_at"])

    op.create_table(
        "crash_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("kind", sa.String(50), nullable=False),
        sa.Column("detail", sa.Text, nullable=False),
        sa.Column("detected_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "jobs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("payload", sa.JSON, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("result", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime, nullable=True),
        sa.Column("finished_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_jobs_status", "jobs", ["status"])

    op.create_table(
        "backups",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("size_bytes", sa.BigInteger, nullable=True),
        sa.Column("kind", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("status", sa.String(20), nullable=False, server_default="done"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("backups")
    op.drop_table("jobs")
    op.drop_table("crash_logs")
    op.drop_table("request_logs")
    op.drop_table("error_logs")
