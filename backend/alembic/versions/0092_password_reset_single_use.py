"""make the self-service password reset link single-use

The reset link is a stateless signed JWT with a 10-minute `exp` claim and
nothing tracking it server-side, so the same link could be replayed to change
the password again and again for the whole 10-minute window. This column
records the jti of the one outstanding reset token for a user; it's set when
the reset email goes out and cleared the moment the token is redeemed, and a
new "forgot password" request overwrites it rather than adding to it - so
requesting a fresh link also silently kills any earlier unused one.

Revision ID: 0092
Revises: 0091
Create Date: 2026-08-25

"""
from alembic import op
# pyrefly: ignore [missing-import]
import sqlalchemy as sa

revision = "0092"
down_revision = "0091"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("password_reset_token_id", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "password_reset_token_id")
