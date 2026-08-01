"""add ai_evaluation_limit to plans

Direct-student AI evaluation quotas were a single shared platform-wide pool
(see ai_evaluation_service._limit_rows), so no individual direct student
could be given a bigger or smaller monthly allowance. This adds a per-plan
ceiling - set on a direct-student plan when it is created/edited - mirroring
Institute.ai_student_monthly_limit for the institute catalogue. NULL/0 keeps
falling back to the platform-wide default.

Revision ID: 0055
Revises: 0054
Create Date: 2026-08-01

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0055"
down_revision = "0054"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("plans", sa.Column("ai_evaluation_limit", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("plans", "ai_evaluation_limit")
