"""drop demo_accounts table

Revision ID: 998516f007bf
Revises: 0060
Create Date: 2026-08-03 16:35:26.247049

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = '998516f007bf'
down_revision: Union[str, None] = '0060'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table('demo_accounts')

def downgrade() -> None:
    op.create_table('demo_accounts',
    sa.Column('id', mysql.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('institute_id', mysql.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('duration_days', mysql.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('course_limit', mysql.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('test_limit', mysql.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('expires_at', mysql.DATETIME(), nullable=False),
    sa.Column('converted_at', mysql.DATETIME(), nullable=True),
    sa.Column('created_at', mysql.DATETIME(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
    sa.ForeignKeyConstraint(['institute_id'], ['institutes.id'], name='demo_accounts_ibfk_1'),
    sa.PrimaryKeyConstraint('id'),
    mysql_collate='utf8mb4_0900_ai_ci',
    mysql_default_charset='utf8mb4',
    mysql_engine='InnoDB'
    )
    op.create_index('institute_id', 'demo_accounts', ['institute_id'], unique=True)
