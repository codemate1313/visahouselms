"""Record source modules used by randomized composite tests.

Revision ID: 0015
Revises: 0014
Create Date: 2026-07-20
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable keeps this portable across SQLite/MySQL JSON implementations;
    # existing stand-alone modules are serialized as an empty source list.
    op.add_column("exam_modules", sa.Column("source_module_ids", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("exam_modules", "source_module_ids")
