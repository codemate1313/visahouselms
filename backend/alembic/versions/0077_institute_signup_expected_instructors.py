"""add expected_instructors to institute_signup_requests

Revision ID: 0077
Revises: 0076
Create Date: 2026-08-15

"""
from alembic import op
import sqlalchemy as sa

revision = "0077"
down_revision = "0076"
branch_labels = None
depends_on = None

TABLE = "institute_signup_requests"
COLUMN = "expected_instructors"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [col["name"] for col in inspector.get_columns(TABLE)]
    if COLUMN not in columns:
        op.add_column(TABLE, sa.Column(COLUMN, sa.Integer(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [col["name"] for col in inspector.get_columns(TABLE)]
    if COLUMN in columns:
        op.drop_column(TABLE, COLUMN)
