"""password change tracking

Revision ID: 0038_password_change_tracking
Revises: 0037_ai_per_student_quota
Create Date: 2026-07-27

"""
from alembic import op
# pyrefly: ignore [missing-import]
import sqlalchemy as sa

revision = "0038"
down_revision = "0037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Last time this account's password actually changed after creation - NULL
    # means "still on the password it was created with". The full history (who
    # changed it, from where) stays in audit_logs; this column exists so the
    # directory can sort/show it without joining the log on every row.
    op.add_column(
        "users",
        sa.Column("password_changed_at", sa.DateTime, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "password_changed_at")
