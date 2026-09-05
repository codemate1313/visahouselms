"""update seo site name and title to visa house lms

Revision ID: 0099
Revises: 0098
Create Date: 2026-09-05

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0099"
down_revision: Union[str, None] = "0098"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE seo_settings
        SET site_name = 'Visa House LMS',
            default_title = 'Visa House LMS | Computer-Delivered Exam Platform & AI Feedback',
            title_template = '%s | Visa House LMS',
            default_meta_keywords = 'Visa House LMS, LanguageCert Practice, AI LanguageCert Evaluation, Computer Delivered LanguageCert',
            twitter_handle = '@visahouselms'
        WHERE site_name IN ('Language CERT Pro', 'LanguageCert Pro', 'LanguageCert')
           OR default_title LIKE '%Language CERT Pro%'
           OR default_title LIKE '%LanguageCert Pro%'
           OR default_title LIKE '%LanguageCert%';
        """
    )


def downgrade() -> None:
    pass
