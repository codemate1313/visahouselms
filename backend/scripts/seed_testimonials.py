"""Standalone Seeder Script for Testimonials.

Usage:
    python scripts/seed_testimonials.py
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import select
from app.database import SessionLocal, engine
from app.models.base import Base
from app.models.testimonials import Testimonial


TESTIMONIALS_DATA = [
    {
        "student_name": "Ananya Sharma",
        "student_role": "Computer-Delivered Academic Candidate",
        "target_score": "Achieved Band 8.5",
        "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
        "rating": 5,
        "quote": "The realistic exam timer and instant AI Speaking feedback were game-changers for me! I improved my Speaking score from 6.5 to 8.0 in just 3 weeks.",
        "is_active": True,
        "display_order": 1,
    },
    {
        "student_name": "Rahul Verma",
        "student_role": "General Training Test Taker",
        "target_score": "Achieved Band 8.0",
        "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
        "rating": 5,
        "quote": "Practicing on the exact split-screen Reading environment helped eliminate my exam anxiety. The AI Writing Assessor gave sentence-level grammar fixes that truly helped.",
        "is_active": True,
        "display_order": 2,
    },
    {
        "student_name": "Sophia Chen",
        "student_role": "University Applicant (UK)",
        "target_score": "Achieved Band 7.5",
        "avatar_url": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80",
        "rating": 5,
        "quote": "IELTS LMS delivers full coverage. The multi-accent Listening audio tracks matched the actual exam audio perfectly!",
        "is_active": True,
        "display_order": 3,
    },
    {
        "student_name": "Marcus Vance",
        "student_role": "Healthcare Registration Candidate",
        "target_score": "Achieved Band 8.0",
        "avatar_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
        "rating": 5,
        "quote": "The detailed band score breakdown across TR, CC, LR, and GRA criteria showed me exactly where I was losing marks in Task 2 essays.",
        "is_active": True,
        "display_order": 4,
    },
    {
        "student_name": "Priya Patel",
        "student_role": "Canada Express Entry Applicant",
        "target_score": "Achieved Band 8.5 (CLB 10)",
        "avatar_url": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80",
        "rating": 5,
        "quote": "I needed CLB 9+ for my PR points. IELTS LMS's automated Reading and Listening scoring gave me immediate breakdown on weak question types.",
        "is_active": True,
        "display_order": 5,
    },
    {
        "student_name": "David Kowalski",
        "student_role": "Master's Degree Candidate (Australia)",
        "target_score": "Achieved Band 8.0",
        "avatar_url": "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&auto=format&fit=crop&q=80",
        "rating": 5,
        "quote": "The mock exam user interface is identical to the official computer-delivered IELTS test center environment. No surprises on exam day!",
        "is_active": True,
        "display_order": 6,
    },
    {
        "student_name": "Amina Al-Mansoor",
        "student_role": "Medical Residency Applicant",
        "target_score": "Achieved Band 7.5",
        "avatar_url": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80",
        "rating": 5,
        "quote": "The AI Speaking Evaluator provided phoneme-level pronunciation analysis. It helped me fix my pacing and fillers effortlessly.",
        "is_active": True,
        "display_order": 7,
    },
]


def seed_testimonials():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seeded_count = 0
        updated_count = 0

        for item in TESTIMONIALS_DATA:
            existing = db.scalar(
                select(Testimonial).where(Testimonial.student_name == item["student_name"])
            )
            if existing:
                for k, v in item.items():
                    setattr(existing, k, v)
                updated_count += 1
            else:
                db.add(Testimonial(**item))
                seeded_count += 1

        db.commit()
        print(f"==> Testimonial Seeding Complete: {seeded_count} created, {updated_count} updated.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_testimonials()
