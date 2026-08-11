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

        # 1. Language CERT Academic
        langcert_type = db.query(VoucherType).filter(VoucherType.code == "language-cert-academic").first()
        if not langcert_type:
            langcert_type = VoucherType(
                name="Language CERT Academic",
                code="language-cert-academic",
                description="Official Language CERT Academic exam voucher code with 180-day validity.",
                badge_color="#0284c7",
                default_price=Decimal("16250.00"),
                default_validity_days=180,
                is_active=True,
            )
            db.add(langcert_type)
            db.flush()

        # 2. PTE Academic
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

        # 3. TOEFL iBT
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

        # 4. Duolingo English Test
        duolingo_type = db.query(VoucherType).filter(VoucherType.code == "duolingo-english-test").first()
        if not duolingo_type:
            duolingo_type = VoucherType(
                name="Duolingo English Test",
                code="duolingo-english-test",
                description="Official Duolingo English Test online exam voucher code.",
                badge_color="#58cc02",
                default_price=Decimal("5500.00"),
                default_validity_days=180,
                is_active=True,
            )
            db.add(duolingo_type)
            db.flush()

        db.commit()

        # Seed Offerings
        o1 = db.query(VoucherOffering).filter(VoucherOffering.title == "Language CERT Academic Standard Voucher").first()
        if not o1:
            db.add(VoucherOffering(
                voucher_type_id=langcert_type.id,
                title="Language CERT Academic Standard Voucher",
                description="Instant delivery of 16-digit alphanumeric code valid at all official centers.",
                price=Decimal("16250.00"),
                discount_price=Decimal("14999.00"),
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

        o4 = db.query(VoucherOffering).filter(VoucherOffering.title == "Duolingo English Test Official Voucher").first()
        if not o4:
            db.add(VoucherOffering(
                voucher_type_id=duolingo_type.id,
                title="Duolingo English Test Official Voucher",
                description="Official Duolingo English Test seat booking voucher code with instant delivery.",
                price=Decimal("5500.00"),
                discount_price=Decimal("4799.00"),
                validity_days=180,
                is_active=True,
            ))

        db.commit()

        # Seed initial sample 16-digit stock codes for Language CERT, PTE, and Duolingo
        sample_langcert_codes = [
            "LANGCERT2026ACAD1",
            "LANGCERT2026ACAD2",
            "LANGCERT2026ACAD3",
            "LANGCERT2026ACAD4",
            "LANGCERT2026ACAD5",
        ]
        sample_pte_codes = [
            "PTEACAD2026EXAM1",
            "PTEACAD2026EXAM2",
            "PTEACAD2026EXAM3",
            "PTEACAD2026EXAM4",
            "PTEACAD2026EXAM5",
        ]
        sample_duolingo_codes = [
            "DUOLINGO2026TEST1",
            "DUOLINGO2026TEST2",
            "DUOLINGO2026TEST3",
            "DUOLINGO2026TEST4",
            "DUOLINGO2026TEST5",
        ]

        add_bulk_voucher_codes(db, langcert_type.id, sample_langcert_codes, filename="seed_sample_langcert.txt")
        add_bulk_voucher_codes(db, pte_type.id, sample_pte_codes, filename="seed_sample_pte.txt")
        add_bulk_voucher_codes(db, duolingo_type.id, sample_duolingo_codes, filename="seed_sample_duolingo.txt")

        print("Voucher seed completed successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    seed_voucher_data()
