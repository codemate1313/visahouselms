"""negotiated institute onboarding workflow

Revision ID: 0024
Revises: 0023
Create Date: 2026-07-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0024"
down_revision: Union[str, None] = "0023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("institutes") as batch_op:
        batch_op.add_column(sa.Column("onboarding_status", sa.String(20), nullable=False, server_default="published"))
        batch_op.add_column(sa.Column("agreement_reference", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("agreement_notes", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("agreed_amount", sa.Numeric(10, 2), nullable=True))
        batch_op.add_column(sa.Column("agreement_currency", sa.String(8), nullable=False, server_default="INR"))
        batch_op.add_column(sa.Column("student_limit", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("staff_limit", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("test_limit", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("access_duration_days", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("published_at", sa.DateTime(), nullable=True))
    op.create_index("ix_institutes_onboarding_status", "institutes", ["onboarding_status"])

    with op.batch_alter_table("plans") as batch_op:
        batch_op.add_column(sa.Column("is_internal", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    with op.batch_alter_table("plans") as batch_op:
        batch_op.drop_column("is_internal")
    op.drop_index("ix_institutes_onboarding_status", table_name="institutes")
    with op.batch_alter_table("institutes") as batch_op:
        batch_op.drop_column("published_at")
        batch_op.drop_column("access_duration_days")
        batch_op.drop_column("test_limit")
        batch_op.drop_column("staff_limit")
        batch_op.drop_column("student_limit")
        batch_op.drop_column("agreement_currency")
        batch_op.drop_column("agreed_amount")
        batch_op.drop_column("agreement_notes")
        batch_op.drop_column("agreement_reference")
        batch_op.drop_column("onboarding_status")
