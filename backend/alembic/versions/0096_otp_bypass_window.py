"""Let a device that just completed an email OTP skip it on the next login.

Adds a per-device expiry timestamp: set when an OTP challenge succeeds, checked
before a fresh challenge is issued. A login from the same device before it
lapses is treated as already verified; nothing extends it, so the window is
always anchored to the original verification, not to later logins.

Revision ID: 0096
Revises: 0095
Create Date: 2026-08-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0096"
down_revision: Union[str, None] = "0095"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_devices", sa.Column("otp_verified_until", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("user_devices", "otp_verified_until")
