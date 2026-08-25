"""add_send_email_to_announcements

Revision ID: aa0fc0d8d7a4
Revises: 0092
Create Date: 2026-08-25 23:58:43.353205

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aa0fc0d8d7a4'
down_revision: Union[str, None] = '0093'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('announcements', sa.Column('send_email', sa.Boolean(), server_default='0', nullable=False))


def downgrade() -> None:
    op.drop_column('announcements', 'send_email')
