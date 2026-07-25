"""owner account and developer access controls

Revision ID: 0032
Revises: 0031
Create Date: 2026-07-25

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0032"
down_revision: Union[str, None] = "0031"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_owner", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("is_developer_verified", sa.Boolean(), nullable=False, server_default=sa.false()))

    roles_table = sa.table("roles", sa.column("name", sa.String))
    op.bulk_insert(roles_table, [{"name": "DEVELOPER"}])

    connection = op.get_bind()
    super_admin_role_id = connection.execute(
        sa.text("SELECT id FROM roles WHERE name = 'SUPER_ADMIN'")
    ).scalar()
    if super_admin_role_id is not None:
        owner_id = connection.execute(
            sa.text(
                """
                SELECT id
                FROM users
                WHERE role_id = :role_id AND is_active = 1
                ORDER BY created_at ASC, id ASC
                LIMIT 1
                """
            ),
            {"role_id": super_admin_role_id},
        ).scalar()
        if owner_id is not None:
            connection.execute(
                sa.text("UPDATE users SET is_owner = 1 WHERE id = :owner_id"),
                {"owner_id": owner_id},
            )


def downgrade() -> None:
    op.execute("DELETE FROM roles WHERE name = 'DEVELOPER'")
    op.drop_column("users", "is_developer_verified")
    op.drop_column("users", "is_owner")
