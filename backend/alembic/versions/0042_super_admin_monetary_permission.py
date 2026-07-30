"""add monetary analytics permission to super admins

Revision ID: 0042
Revises: 0041
Create Date: 2026-07-30

"""
from alembic import op
# pyrefly: ignore [missing-import]
import sqlalchemy as sa

revision = "0042"
down_revision = "0041"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(
            sa.Column(
                "can_view_monetary_analytics",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
    op.execute("UPDATE users SET can_view_monetary_analytics = 0 WHERE is_owner = 0")


def downgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.drop_column("can_view_monetary_analytics")
