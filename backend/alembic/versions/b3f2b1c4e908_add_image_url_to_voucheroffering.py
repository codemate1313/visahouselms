"""Add image_url to VoucherOffering

Revision ID: b3f2b1c4e908
Revises: 998516f007bf
Create Date: 2026-08-03 19:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b3f2b1c4e908'
down_revision = '998516f007bf'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('voucher_offerings', sa.Column('image_url', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('voucher_offerings', 'image_url')
