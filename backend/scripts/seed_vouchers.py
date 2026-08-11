import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from decimal import Decimal
from app.database import SessionLocal
from app.models.voucher import VoucherType, VoucherOffering, VoucherCode
from app.services.voucher_service import add_bulk_voucher_codes

def seed_voucher_data():
    db = SessionLocal()
    try:
        print("Seeding voucher types and offerings...")

        # 1. LanguageCert Academic
        languagecert_type = db.query(VoucherType).filter(VoucherType.code == "languagecert-academic").first()
        if not languagecert_type:
            languagecert_type = VoucherType(
                name="LanguageCert Academic",
                code="languagecert-academic",
                description="Official LanguageCert Academic exam voucher code with 180-day validity.",
                badge_color="#0284c7",
                default_price=Decimal("16250.00"),
                default_validity_days=180,
                is_active=True,
            )
            db.add(languagecert_type)
            db.flush()

        # 2. Duolingo English Test
        duolingo_type = db.query(VoucherType).filter(VoucherType.code == "duolingo-english-test").first()
        if not duolingo_type:
            duolingo_type = VoucherType(
                name="Duolingo English Test",
                code="duolingo-english-test",
                description="Official Duolingo English Test voucher code with 180-day validity.",
                badge_color="#16a34a",
                default_price=Decimal("5500.00"),
                default_validity_days=180,
                is_active=True,
            )
            db.add(duolingo_type)
            db.flush()

        # 3. PTE Academic
        pte_type = db.query(VoucherType).filter(VoucherType.code == "pte-academic").first()
        if not pte_type:
            pte_type = VoucherType(
                name="PTE Academic",
                code="pte-academic",
                description="Official Pearson PTE Academic computer-based exam voucher.",
                badge_color="#7c3aed",
                default_price=Decimal("17000.00"),
                default_validity_days=180,
                is_active=True,
            )
            db.add(pte_type)
            db.flush()

        # 4. TOEFL iBT
        toefl_type = db.query(VoucherType).filter(VoucherType.code == "toefl-ibt").first()
        if not toefl_type:
            toefl_type = VoucherType(
                name="TOEFL iBT",
                code="toefl-ibt",
                description="Official ETS TOEFL iBT Internet-based test voucher code.",
                badge_color="#059669",
                default_price=Decimal("16900.00"),
                default_validity_days=180,
                is_active=True,
            )
            db.add(toefl_type)
            db.flush()

        db.commit()

        # Seed Offerings
        o1 = db.query(VoucherOffering).filter(VoucherOffering.title == "LanguageCert Academic Standard Voucher").first()
        if not o1:
            db.add(VoucherOffering(
                voucher_type_id=languagecert_type.id,
                title="LanguageCert Academic Standard Voucher",
                description="Instant delivery of 16-digit alphanumeric code for LanguageCert exam registration.",
                price=Decimal("16250.00"),
                discount_price=Decimal("14999.00"),
                validity_days=180,
                is_active=True,
            ))

        o0 = db.query(VoucherOffering).filter(VoucherOffering.title == "Duolingo English Test Voucher").first()
        if not o0:
            db.add(VoucherOffering(
                voucher_type_id=duolingo_type.id,
                title="Duolingo English Test Voucher",
                description="Fast email delivery of an official Duolingo English Test voucher code.",
                price=Decimal("5500.00"),
                discount_price=Decimal("4999.00"),
                validity_days=180,
                is_active=True,
            ))

        o2 = db.query(VoucherOffering).filter(VoucherOffering.title == "PTE Academic Exam Voucher").first()
        if not o2:
            db.add(VoucherOffering(
                voucher_type_id=pte_type.id,
                title="PTE Academic Exam Voucher",
                description="Pearson PTE Academic 16-digit exam seat reservation voucher.",
                price=Decimal("17000.00"),
                discount_price=Decimal("15499.00"),
                validity_days=180,
                is_active=True,
            ))

        o3 = db.query(VoucherOffering).filter(VoucherOffering.title == "TOEFL iBT Official Test Voucher").first()
        if not o3:
            db.add(VoucherOffering(
                voucher_type_id=toefl_type.id,
                title="TOEFL iBT Official Test Voucher",
                description="ETS TOEFL iBT seat booking voucher code with fast email delivery.",
                price=Decimal("16900.00"),
                discount_price=Decimal("15299.00"),
                validity_days=180,
                is_active=True,
            ))

        db.commit()

        # Seed initial sample 16-digit stock codes for LanguageCert, Duolingo and PTE
        sample_languagecert_codes = [
            "LANGCERT20260001",
            "LANGCERT20260002",
            "LANGCERT20260003",
            "LANGCERT20260004",
            "LANGCERT20260005",
        ]
        sample_duolingo_codes = [
            "DUOLINGO20260001",
            "DUOLINGO20260002",
            "DUOLINGO20260003",
            "DUOLINGO20260004",
            "DUOLINGO20260005",
        ]
        sample_pte_codes = [
            "PTEACAD2026EXAM1",
            "PTEACAD2026EXAM2",
            "PTEACAD2026EXAM3",
            "PTEACAD2026EXAM4",
            "PTEACAD2026EXAM5",
        ]

        add_bulk_voucher_codes(db, languagecert_type.id, sample_languagecert_codes, filename="seed_sample_languagecert.txt")
        add_bulk_voucher_codes(db, duolingo_type.id, sample_duolingo_codes, filename="seed_sample_duolingo.txt")
        add_bulk_voucher_codes(db, pte_type.id, sample_pte_codes, filename="seed_sample_pte.txt")

        print("Voucher seed completed successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    seed_voucher_data()
