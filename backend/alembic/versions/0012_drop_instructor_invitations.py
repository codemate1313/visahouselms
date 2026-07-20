"""Drop rolled-back instructor invitations table

Revision ID: 0012
Revises: 0011_instructor_email_invitations
Create Date: 2026-07-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011_instructor_email_invitations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "instructor_invitations" in inspector.get_table_names():
        index_names = {
            index["name"] for index in inspector.get_indexes("instructor_invitations")
        }
        for index_name in (
            "ix_instructor_invitations_expires_at",
            "ix_instructor_invitations_token_hash",
            "ix_instructor_invitations_user_id",
        ):
            if index_name in index_names:
                op.drop_index(index_name, table_name="instructor_invitations")
        op.drop_table("instructor_invitations")


def downgrade() -> None:
    pass
