"""institute self-signup applications from the public site

Revision ID: 0061
Revises: b3f2b1c4e908
Create Date: 2026-08-04

An application is not an institute. Anyone can submit one, so it lives in its
own table holding only the applicant's own words until a Super Admin approves
it; only then are a real institute and admin account created. Approved and
rejected rows are kept, so this table doubles as the record of who was let in.
"""
from alembic import op
import sqlalchemy as sa

revision = "0061"
down_revision = "b3f2b1c4e908"
branch_labels = None
depends_on = None

TABLE = "institute_signup_requests"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if TABLE in inspector.get_table_names():
        return

    op.create_table(
        TABLE,
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("institute_name", sa.String(length=255), nullable=False),
        sa.Column("contact_email", sa.String(length=255), nullable=False),
        sa.Column("contact_phone", sa.String(length=40), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("country", sa.String(length=120), nullable=True),
        sa.Column("website", sa.String(length=255), nullable=True),
        sa.Column("admin_first_name", sa.String(length=100), nullable=False),
        sa.Column("admin_last_name", sa.String(length=100), nullable=False),
        sa.Column("admin_email", sa.String(length=255), nullable=False),
        sa.Column("expected_students", sa.Integer(), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column(
            "interested_plan_id",
            sa.Integer(),
            sa.ForeignKey("plans.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column(
            "reviewed_by_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_institute_id",
            sa.Integer(),
            sa.ForeignKey("institutes.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("submitted_ip", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    # The queue is read by status and worked newest-first; the email indexes
    # back the duplicate-application guard on submission.
    op.create_index(f"ix_{TABLE}_status", TABLE, ["status"])
    op.create_index(f"ix_{TABLE}_created_at", TABLE, ["created_at"])
    op.create_index(f"ix_{TABLE}_admin_email", TABLE, ["admin_email"])
    op.create_index(f"ix_{TABLE}_contact_email", TABLE, ["contact_email"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if TABLE not in inspector.get_table_names():
        return
    for suffix in ("status", "created_at", "admin_email", "contact_email"):
        op.drop_index(f"ix_{TABLE}_{suffix}", table_name=TABLE)
    op.drop_table(TABLE)
