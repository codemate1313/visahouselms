"""drop trial_configs.test_limit

A trial student can sit each demo module exactly once, so the number of tests
they get is already decided by how many courses are ticked as demos. The extra
"tests allowed" cap only created a second, invisible ceiling that could
contradict the course list - tick five demos with a limit of three and two of
them silently could not be opened.

Revision ID: 0081
Revises: 0080
Create Date: 2026-08-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0081"
down_revision = "0080"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("trial_configs") as batch:
        batch.drop_column("test_limit")


def downgrade() -> None:
    with op.batch_alter_table("trial_configs") as batch:
        batch.add_column(sa.Column("test_limit", sa.Integer(), nullable=False, server_default="3"))
