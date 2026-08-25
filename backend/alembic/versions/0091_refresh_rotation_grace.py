"""give refresh-token rotation a grace window instead of a hard revoke

Rotation was strictly single-use: /auth/refresh revoked the presented token
before issuing its replacement, so any reload that aborted the request
mid-flight - or two refreshes racing on the same cookie - left the browser
holding a token the server had already killed, and the next call signed the
user out. These two columns separate "rotated away by a refresh" from "revoked
by a logout or a takeover login", so a rotated token can still be honoured for
a few seconds and reuse long after that can be treated as theft.

`rotated_from_id` is a self-referential FK back to the token a session was
rotated out of, so the lineage a stolen token belongs to can be walked and
revoked in one go. It points at the parent rather than the replacement because
one token can be rotated more than once - a replay inside the grace window
mints a sibling - and every sibling has to stay reachable.

Revision ID: 0091
Revises: 0090
Create Date: 2026-08-25

"""
from alembic import op
# pyrefly: ignore [missing-import]
import sqlalchemy as sa

revision = "0091"
down_revision = "0090"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("user_sessions") as batch_op:
        batch_op.add_column(sa.Column("rotated_at", sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column("rotated_from_id", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_user_sessions_rotated_from_id",
            "user_sessions",
            ["rotated_from_id"],
            ["id"],
            ondelete="SET NULL",
        )
    op.create_index(
        op.f("ix_user_sessions_rotated_from_id"),
        "user_sessions",
        ["rotated_from_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_user_sessions_rotated_from_id"), table_name="user_sessions")
    with op.batch_alter_table("user_sessions") as batch_op:
        batch_op.drop_constraint("fk_user_sessions_rotated_from_id", type_="foreignkey")
        batch_op.drop_column("rotated_from_id")
        batch_op.drop_column("rotated_at")
