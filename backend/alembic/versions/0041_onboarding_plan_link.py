"""link an onboarding draft to the institute plan it was sold on

Revision ID: 0041_onboarding_plan_link
Revises: 0040_clone_institute_held_plans
Create Date: 2026-07-27

"""
from alembic import op
# pyrefly: ignore [missing-import]
import sqlalchemy as sa

revision = "0041"
down_revision = "0040"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """The plan is now chosen during onboarding rather than synthesised at
    publish, so the draft has to remember it across the branding step.

    Drafts created before this release have no plan and keep publishing through
    the legacy internal-plan path, so the column stays nullable.
    """
    with op.batch_alter_table("institutes") as batch:
        batch.add_column(sa.Column("onboarding_plan_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_institutes_onboarding_plan_id",
            "plans",
            ["onboarding_plan_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("institutes") as batch:
        batch.drop_constraint("fk_institutes_onboarding_plan_id", type_="foreignkey")
        batch.drop_column("onboarding_plan_id")
