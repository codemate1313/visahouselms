"""add TOTP (authenticator 2FA) columns to users

Revision ID: 0064
Revises: 0063
Create Date: 2026-08-06

Two nullable columns: the encrypted authenticator secret and an enabled flag.
Only the developer account uses them today, but they live on users so any role
could be given 2FA later without another migration.
"""
from alembic import op
import sqlalchemy as sa

revision = "0064"
down_revision = "0063"
branch_labels = None
depends_on = None


def _columns(bind) -> set:
    return {c["name"] for c in sa.inspect(bind).get_columns("users")}


def upgrade() -> None:
    bind = op.get_bind()
    existing = _columns(bind)
    with op.batch_alter_table("users") as batch:
        if "totp_secret" not in existing:
            batch.add_column(sa.Column("totp_secret", sa.String(length=255), nullable=True))
        if "totp_enabled" not in existing:
            batch.add_column(
                sa.Column("totp_enabled", sa.Boolean(), nullable=False, server_default="0")
            )


def downgrade() -> None:
    bind = op.get_bind()
    existing = _columns(bind)
    with op.batch_alter_table("users") as batch:
        if "totp_enabled" in existing:
            batch.drop_column("totp_enabled")
        if "totp_secret" in existing:
            batch.drop_column("totp_secret")
