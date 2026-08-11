"""update LanguageCert landing contact and voucher defaults

Revision ID: 0074
Revises: 0073
Create Date: 2026-08-11

"""
from alembic import op
import sqlalchemy as sa

revision = "0074"
down_revision = "0073"
branch_labels = None
depends_on = None


OLD_CONTACT = {
    "email": "partners@visahouse.io",
    "phone": "+91 80 4700 8100",
    "phone_note": "Mon-Fri · 10am to 7pm IST",
    "support_url": "support.visahouse.io",
    "office_name": "Visa House Learning Pvt. Ltd.",
    "office_address": "4th Floor, Prestige Meridian,\nMG Road, Bangalore 560001",
}

NEW_CONTACT = {
    "email": "enquiry.langugaecert@gmail.com",
    "phone": "+91 9779047164",
    "phone_note": "Mon-Fri · 9am to 5pm IST",
    "support_url": "support.visahouse.com (to be created)",
    "office_name": "Visa House Immigration",
    "office_address": "Gali lakeer Sahib wali, Amritsar bypass Road\nTarntaran, 143401",
}

VOUCHER_TYPES = [
    {
        "name": "LanguageCert Academic Exam",
        "code": "languagecert-academic",
        "description": "Official LanguageCert Academic exam voucher",
        "badge_color": "#0284c7",
    },
    {
        "name": "Duolingo English Test",
        "code": "duolingo-english-test",
        "description": "Official Duolingo English Test voucher",
        "badge_color": "#16a34a",
    },
]

VOUCHER_OFFERINGS = [
    {
        "type_code": "languagecert-academic",
        "title": "LanguageCert Academic Standard Exam Voucher",
        "description": "LanguageCert exam registration voucher with instant 16-digit redemption code.",
        "price": "15500.00",
        "discount_price": "14200.00",
        "validity_days": 180,
    },
    {
        "type_code": "duolingo-english-test",
        "title": "Duolingo English Test Voucher",
        "description": "Duolingo English Test voucher code with fast email delivery.",
        "price": "5500.00",
        "discount_price": "4999.00",
        "validity_days": 180,
    },
]


def _update_contact_defaults(bind, old_values: dict, new_values: dict) -> None:
    for column, old_value in old_values.items():
        bind.execute(
            sa.text(
                f"UPDATE contact_settings SET {column} = :new_value "
                f"WHERE {column} = :old_value"
            ),
            {"new_value": new_values[column], "old_value": old_value},
        )


def _voucher_type_id(bind, code: str):
    return bind.execute(
        sa.text("SELECT id FROM voucher_types WHERE code = :code"),
        {"code": code},
    ).scalar()


def _insert_voucher_defaults(bind) -> None:
    for voucher_type in VOUCHER_TYPES:
        if _voucher_type_id(bind, voucher_type["code"]) is not None:
            continue
        bind.execute(
            sa.text(
                "INSERT INTO voucher_types "
                "(name, code, description, badge_color, is_active) "
                "VALUES (:name, :code, :description, :badge_color, :is_active)"
            ),
            {**voucher_type, "is_active": True},
        )

    for offering in VOUCHER_OFFERINGS:
        exists = bind.execute(
            sa.text("SELECT id FROM voucher_offerings WHERE title = :title"),
            {"title": offering["title"]},
        ).scalar()
        if exists is not None:
            continue

        type_id = _voucher_type_id(bind, offering["type_code"])
        if type_id is None:
            continue

        bind.execute(
            sa.text(
                "INSERT INTO voucher_offerings "
                "(voucher_type_id, title, description, price, discount_price, validity_days, is_active) "
                "VALUES (:voucher_type_id, :title, :description, :price, :discount_price, :validity_days, :is_active)"
            ),
            {
                "voucher_type_id": type_id,
                "title": offering["title"],
                "description": offering["description"],
                "price": offering["price"],
                "discount_price": offering["discount_price"],
                "validity_days": offering["validity_days"],
                "is_active": True,
            },
        )


def upgrade() -> None:
    bind = op.get_bind()
    _update_contact_defaults(bind, OLD_CONTACT, NEW_CONTACT)
    _insert_voucher_defaults(bind)


def downgrade() -> None:
    bind = op.get_bind()
    _update_contact_defaults(bind, NEW_CONTACT, OLD_CONTACT)
    # Voucher master rows are left in place on downgrade because admins may add
    # real stock or purchases after upgrade.
