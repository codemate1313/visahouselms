"""Per-student access windows, and a seat state that is not `is_active`.

An institute buys a fixed number of seats for roughly a year, but a student
account had no end date, so a seat was held forever once taken. The only thing
that ever gave a seat back was deleting the account - and deleting releases the
email and blocks reactivation, so reclaiming a seat meant destroying the record
of the student who had it.

Three columns fix that.

`access_starts_at` / `access_ends_at` are the student's own window inside the
institute's subscription. They are set per student by the institute admin, and
are always required at creation - there is no default, because a silent default
is how a student ends up outliving the subscription that paid for them.

`access_state` exists because `is_active` was one boolean doing four jobs, and
that is precisely why "expired" and "deleted" collided:

    active     may log in, holds a seat
    suspended  admin turned them off, still holds a seat
    expired    window closed, still holds a seat
    released   seat given back; record, email and history all intact,
               searchable, and reactivatable into a free seat later

Only `released` reduces the seat count, and only a deliberate admin action
produces it. A date passing never frees a seat - otherwise editing an end date
backwards and then forwards would mint seats out of nothing.

`deleted_at` is untouched and keeps its existing meaning. `released` sits
between "in use" and "archived", which is the state the seat model needed and
did not have.

Backfill is explicit for every row. Institute students get their institute's
current subscription expiry, falling back to created_at + access_duration_days,
falling back to one year. Nothing is left NULL and then read as "forever".

Revision ID: 0082
Revises: 0081
Create Date: 2026-08-16
"""
from datetime import timedelta

import sqlalchemy as sa
from alembic import op

revision = "0082"
down_revision = "0081"
branch_labels = None
depends_on = None

DEFAULT_DURATION_DAYS = 365


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("access_starts_at", sa.DateTime(), nullable=True))
        batch.add_column(sa.Column("access_ends_at", sa.DateTime(), nullable=True))
        batch.add_column(
            sa.Column(
                "access_state",
                sa.String(length=20),
                nullable=False,
                server_default="active",
            )
        )
    op.create_index("ix_users_access_state", "users", ["access_state"])
    op.create_index("ix_users_access_ends_at", "users", ["access_ends_at"])

    bind = op.get_bind()

    # Suspended accounts are recorded as such rather than left reading "active"
    # with is_active false, so the two columns cannot contradict each other from
    # the first minute. Retired accounts hold no seat, so they are released.
    bind.execute(
        sa.text(
            "UPDATE users SET access_state = 'released' WHERE deleted_at IS NOT NULL"
        )
    )
    bind.execute(
        sa.text(
            "UPDATE users SET access_state = 'suspended' "
            "WHERE deleted_at IS NULL AND is_active = :inactive"
        ),
        {"inactive": False},
    )

    # Windows apply to institute students only. B2C students run off their own
    # subscription, and staff are counted against a separate limit that this
    # change does not touch.
    students = bind.execute(
        sa.text(
            "SELECT u.id, u.institute_id, u.created_at "
            "FROM users u JOIN roles r ON r.id = u.role_id "
            "WHERE r.name = 'STUDENT' AND u.institute_id IS NOT NULL"
        )
    ).fetchall()
    if not students:
        return

    institute_ids = sorted({row[1] for row in students})

    # The governing term is the latest one that has actually started; a term
    # bought for next year is not access yet.
    expiry_by_institute: dict[int, object] = {}
    for row in bind.execute(
        sa.text(
            "SELECT institute_id, MAX(expires_at) FROM subscriptions "
            "WHERE institute_id IS NOT NULL AND cancelled_at IS NULL "
            "AND starts_at <= CURRENT_TIMESTAMP "
            "GROUP BY institute_id"
        )
    ).fetchall():
        if row[1] is not None:
            expiry_by_institute[row[0]] = row[1]

    duration_by_institute: dict[int, int] = {}
    for row in bind.execute(
        sa.text(
            "SELECT id, access_duration_days FROM institutes WHERE id IN :ids"
        ).bindparams(sa.bindparam("ids", expanding=True)),
        {"ids": institute_ids},
    ).fetchall():
        duration_by_institute[row[0]] = row[1] or DEFAULT_DURATION_DAYS

    update = sa.text(
        "UPDATE users SET access_starts_at = :starts, access_ends_at = :ends "
        "WHERE id = :id"
    )
    for user_id, institute_id, created_at in students:
        ends = expiry_by_institute.get(institute_id)
        if ends is None:
            # No live term - an institute still in onboarding, or one whose
            # subscription lapsed. Give the agreed duration from signup so the
            # row has a real date rather than an implicit forever.
            days = duration_by_institute.get(institute_id, DEFAULT_DURATION_DAYS)
            ends = (created_at or sa.func.now()) + timedelta(days=days)
        bind.execute(update, {"starts": created_at, "ends": ends, "id": user_id})


def downgrade() -> None:
    op.drop_index("ix_users_access_ends_at", table_name="users")
    op.drop_index("ix_users_access_state", table_name="users")
    with op.batch_alter_table("users") as batch:
        batch.drop_column("access_state")
        batch.drop_column("access_ends_at")
        batch.drop_column("access_starts_at")
