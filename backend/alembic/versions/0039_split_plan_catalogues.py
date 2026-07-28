"""split plan catalogues

Revision ID: 0039_split_plan_catalogues
Revises: 0038_password_change_tracking
Create Date: 2026-07-27

"""
from alembic import op
# pyrefly: ignore [missing-import]
import sqlalchemy as sa

revision = "0039"
down_revision = "0038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Retire the 'both' audience so the direct-student and institute
    catalogues are fully independent.

    Existing 'both' plans are sorted by how they were actually used: a plan any
    institute has ever subscribed to becomes an institute plan, everything else
    joins the direct-student catalogue (which is what the only plan-authoring
    screen has been writing all along).
    """
    op.execute(
        """
        UPDATE plans
        SET audience = 'institutes'
        WHERE audience = 'both'
          AND id IN (SELECT plan_id FROM subscriptions WHERE institute_id IS NOT NULL)
        """
    )
    op.execute("UPDATE plans SET audience = 'direct_students' WHERE audience = 'both'")
    # SQLite doesn't support ALTER COLUMN — use batch mode (copy-and-move)
    with op.batch_alter_table("plans") as batch_op:
        batch_op.alter_column(
            "audience",
            existing_type=sa.String(30),
            nullable=False,
            server_default="direct_students",
        )


def downgrade() -> None:
    with op.batch_alter_table("plans") as batch_op:
        batch_op.alter_column(
            "audience",
            existing_type=sa.String(30),
            nullable=False,
            server_default="both",
        )
