"""Record what was sent to the AI evaluator and what came back.

The ai_evaluations table stored the normalized suggestion and, on failure, an
error string - enough to know an evaluation happened, not enough to answer
"why did that take two minutes and then fall to the instructor?". These three
columns keep the request as a summary (never the audio itself), the provider's
own reply, and how long the call took, so the AI evaluation log can show both
halves of the exchange.

Revision ID: 0094
Revises: aa0fc0d8d7a4
Create Date: 2026-08-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0094"
down_revision: Union[str, None] = "aa0fc0d8d7a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("ai_evaluations", sa.Column("request_summary", sa.JSON(), nullable=True))
    op.add_column("ai_evaluations", sa.Column("response_raw", sa.Text(), nullable=True))
    op.add_column("ai_evaluations", sa.Column("duration_ms", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("ai_evaluations", "duration_ms")
    op.drop_column("ai_evaluations", "response_raw")
    op.drop_column("ai_evaluations", "request_summary")
