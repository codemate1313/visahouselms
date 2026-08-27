"""Record how many tokens each AI evaluation actually spent.

Gemini returns usageMetadata with every reply, and tokens - not requests - are
what the per-minute quota is really consumed by (a Speaking answer is worth
thousands). Without storing it the quota screen could only ever guess.

Revision ID: 0095
Revises: 0094
Create Date: 2026-08-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0095"
down_revision: Union[str, None] = "0094"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("ai_evaluations", sa.Column("tokens_used", sa.Integer(), nullable=True))
    op.add_column("ai_evaluations", sa.Column("key_label", sa.String(length=80), nullable=True))


def downgrade() -> None:
    op.drop_column("ai_evaluations", "key_label")
    op.drop_column("ai_evaluations", "tokens_used")
