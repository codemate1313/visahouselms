"""widen exam module part and asset titles to text

Part titles are the candidate-facing section heading, which for Listening and
Reading is a full instruction paragraph ("You will hear a student giving a
presentation about ..."). VARCHAR(200) rejected those, so authors could not
save the wording the exam actually uses. Listening audio assets are labelled
with the same text and had the same limit.

Revision ID: 0075
Revises: 0074
Create Date: 2026-08-11

"""
from alembic import op
import sqlalchemy as sa

revision = "0075"
down_revision = "0074"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("exam_module_parts") as batch:
        batch.alter_column(
            "title",
            existing_type=sa.String(length=200),
            type_=sa.Text(),
            existing_nullable=False,
        )
    with op.batch_alter_table("exam_module_assets") as batch:
        batch.alter_column(
            "title",
            existing_type=sa.String(length=200),
            type_=sa.Text(),
            existing_nullable=False,
        )


def downgrade() -> None:
    # Anything longer than the old column has to be trimmed before the type
    # can shrink again, otherwise MySQL refuses the ALTER in strict mode.
    op.execute("UPDATE exam_module_parts SET title = LEFT(title, 200)")
    op.execute("UPDATE exam_module_assets SET title = LEFT(title, 200)")
    with op.batch_alter_table("exam_module_assets") as batch:
        batch.alter_column(
            "title",
            existing_type=sa.Text(),
            type_=sa.String(length=200),
            existing_nullable=False,
        )
    with op.batch_alter_table("exam_module_parts") as batch:
        batch.alter_column(
            "title",
            existing_type=sa.Text(),
            type_=sa.String(length=200),
            existing_nullable=False,
        )
