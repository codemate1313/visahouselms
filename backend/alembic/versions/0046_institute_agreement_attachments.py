"""add institute agreement attachments

Revision ID: 0046
Revises: 0045
Create Date: 2026-07-30

"""
from alembic import op
# pyrefly: ignore [missing-import]
import sqlalchemy as sa


revision = "0046"
down_revision = "0045"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("institutes") as batch:
        batch.add_column(sa.Column("agreement_document_path", sa.String(length=500), nullable=True))
        batch.add_column(sa.Column("agreement_document_name", sa.String(length=255), nullable=True))
        batch.add_column(sa.Column("payment_proof_path", sa.String(length=500), nullable=True))
        batch.add_column(sa.Column("payment_proof_name", sa.String(length=255), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("institutes") as batch:
        batch.drop_column("payment_proof_name")
        batch.drop_column("payment_proof_path")
        batch.drop_column("agreement_document_name")
        batch.drop_column("agreement_document_path")
