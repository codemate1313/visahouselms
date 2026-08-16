"""institutes.timezone

A student access window is a pair of calendar dates as far as an institute admin
is concerned - "runs 1 April to 31 March". Turning those into instants needs a
timezone, and the only defensible one is the institute's.

Without this column every window resolves at UTC midnight, which for a Delhi
institute means a student whose access "ends 31 March" is locked out at 05:30 on
the morning of the 31st - most of a day they were told they had. The mirror
problem hits the start date: access beginning "1 April" would not open until
05:30 IST, so a student logging in before breakfast on their first day is told
their access has not started.

Defaults to Asia/Kolkata rather than UTC because that is where the institutes
are; a super admin can change it per institute.

Revision ID: 0083
Revises: 0082
Create Date: 2026-08-16
"""
import sqlalchemy as sa
from alembic import op

revision = "0083"
down_revision = "0082"
branch_labels = None
depends_on = None

DEFAULT_TIMEZONE = "Asia/Kolkata"


def upgrade() -> None:
    with op.batch_alter_table("institutes") as batch:
        batch.add_column(
            sa.Column(
                "timezone",
                sa.String(length=64),
                nullable=False,
                server_default=DEFAULT_TIMEZONE,
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("institutes") as batch:
        batch.drop_column("timezone")
