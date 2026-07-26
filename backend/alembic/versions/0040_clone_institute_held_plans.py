"""clone institute-held plans into the institute catalogue

Revision ID: 0040_clone_institute_held_plans
Revises: 0039_split_plan_catalogues
Create Date: 2026-07-27

"""
from alembic import op
# pyrefly: ignore [missing-import]
import sqlalchemy as sa

revision = "0040"
down_revision = "0039"
branch_labels = None
depends_on = None

PLAN_COLUMNS = (
    "description",
    "price",
    "currency",
    "duration_days",
    "student_limit",
    "test_limit",
    "staff_limit",
    "grace_days",
    "features",
)


def upgrade() -> None:
    """Give institutes holding a direct-student plan a plan of their own.

    Before the catalogues were split there was only one plan-authoring screen,
    so institutes were put on direct-student plans for want of an alternative.
    Those subscriptions would otherwise be unrenewable, since assign/renew now
    refuse a direct plan. Each affected plan is copied into the institute
    catalogue (unpublished - institute plans are never listed publicly) and the
    institute subscriptions are repointed at the copy. The original plan keeps
    its direct-student subscribers and its place on the pricing page.
    """
    conn = op.get_bind()
    stranded = conn.execute(
        sa.text(
            """
            SELECT DISTINCT p.id, p.name
            FROM plans p
            JOIN subscriptions s ON s.plan_id = p.id
            WHERE s.institute_id IS NOT NULL
              AND p.audience = 'direct_students'
              AND p.is_internal = 0
            """
        )
    ).fetchall()

    for plan_id, name in stranded:
        clone_name = _unique_name(conn, f"{name} (Institutes)")
        columns = ", ".join(PLAN_COLUMNS)
        conn.execute(
            sa.text(
                f"""
                INSERT INTO plans (name, audience, is_active, is_published, is_internal, {columns})
                SELECT :clone_name, 'institutes', is_active, 0, 0, {columns}
                FROM plans WHERE id = :plan_id
                """
            ),
            {"clone_name": clone_name, "plan_id": plan_id},
        )
        clone_id = conn.execute(
            sa.text("SELECT id FROM plans WHERE name = :clone_name"), {"clone_name": clone_name}
        ).scalar()

        for table, column in (("plan_modules", "module_id"), ("plan_courses", "course_id")):
            conn.execute(
                sa.text(
                    f"""
                    INSERT INTO {table} (plan_id, {column})
                    SELECT :clone_id, {column} FROM {table} WHERE plan_id = :plan_id
                    """
                ),
                {"clone_id": clone_id, "plan_id": plan_id},
            )

        conn.execute(
            sa.text(
                """
                UPDATE subscriptions SET plan_id = :clone_id
                WHERE plan_id = :plan_id AND institute_id IS NOT NULL
                """
            ),
            {"clone_id": clone_id, "plan_id": plan_id},
        )


def _unique_name(conn, candidate: str) -> str:
    """plans.name is unique, and the copy has to land beside the original."""
    name = candidate
    suffix = 2
    while conn.execute(
        sa.text("SELECT 1 FROM plans WHERE name = :name"), {"name": name}
    ).first() is not None:
        name = f"{candidate} {suffix}"
        suffix += 1
    return name


def downgrade() -> None:
    # The clones are ordinary plans from here on; repointing subscriptions back
    # would re-create exactly the cross-catalogue state this release removes.
    pass
