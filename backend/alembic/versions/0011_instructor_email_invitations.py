"""Rollback instructor email invitations

Revision ID: 0011_instructor_email_invitations
Revises: 0010
Create Date: 2026-07-20
"""

from typing import Sequence, Union

revision: str = "0011_instructor_email_invitations"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
