"""Standalone Seeder Script for Blogs.

Usage:
    python scripts/seed_blogs.py
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import select
from app.database import SessionLocal, engine
from app.models.base import Base
from app.models.blogs import BlogPost

BLOGS_DATA = [
    {
        "title": "Mastering the IELTS Speaking Section with AI Feedback",
        "slug": "mastering-ielts-speaking-ai-feedback",
        "summary": "Discover how real-time AI evaluation can help you identify pronunciation and fluency gaps to jump from a Band 6.5 to an 8.0.",
        "content_markdown": "## The Power of AI in IELTS Preparation\n\nTraditional IELTS preparation relies heavily on scheduling 1-on-1 mock interviews, which can be expensive and time-consuming. With VisahouseLMS, our **AI Speaking Evaluator** analyzes your fluency, rhythm, and phoneme accuracy instantly.\n\n### Key Benefits:\n- **Instant Feedback:** No more waiting days for an instructor to review your recording.\n- **Objective Scoring:** Avoid human bias with standardized CEFR acoustic modeling.\n- **Actionable Insights:** Pinpoint exact hesitations and mispronunciations.\n\nStart using the AI Evaluator today in your student portal and track your progress batch over batch!",
        "featured_image_url": "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=1000",
        "category": "Platform Features",
        "tags": "IELTS, Speaking, AI, Preparation",
        "author_name": "IELTS LMS Editorial Team",
        "read_time_minutes": 4,
        "is_published": True,
    },
    {
        "title": "Top 5 Strategies for the Computer-Delivered Reading Exam",
        "slug": "top-5-strategies-computer-delivered-reading",
        "summary": "Transitioning from paper-based to computer-delivered IELTS? These 5 strategies will help you navigate split-screen passages and digital highlighters.",
        "content_markdown": "## Embracing the Digital Format\n\nThe computer-delivered IELTS Reading test offers several advantages over the paper-based version, primarily the split-screen view. Here is how to maximize your score:\n\n1. **Use the Highlighter Tool:** Don't just read; actively mark keywords in the passage. This mimics underlining on paper but is cleaner.\n2. **Master Copy-Paste:** For completion tasks, copying text directly from the passage eliminates spelling errors. Yes, `Ctrl+C` and `Ctrl+V` work!\n3. **Practice Dual-Pane Navigation:** Get used to scrolling the passage on the left while answering on the right. Our mock exams replicate this interface exactly.\n4. **Keep an Eye on the Timer:** The digital timer at the top flashes red when you have 10 and 5 minutes left.\n5. **Review Screen:** Use the bottom navigation bar to quickly jump back to skipped questions.\n\nTry our realistic simulations to get comfortable with the interface before test day.",
        "featured_image_url": "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&q=80&w=1000",
        "category": "Exam Strategies",
        "tags": "IELTS, Reading, CD-IELTS, Tips",
        "author_name": "Dr. Sarah Jenkins",
        "read_time_minutes": 6,
        "is_published": True,
    },
    {
        "title": "Understanding the IELTS Writing Task 2 Rubric",
        "slug": "understanding-ielts-writing-task-2-rubric",
        "summary": "Task Response, Coherence & Cohesion, Lexical Resource, and Grammatical Range & Accuracy. What do they actually mean?",
        "content_markdown": "## Breaking Down the Scoring Criteria\n\nTo achieve a high band score in Writing Task 2, you must understand exactly what the examiner is looking for. The rubric is divided into four equal parts:\n\n### 1. Task Response (TR)\nDid you answer the specific question asked? Did you present a clear position and support it with relevant ideas? Avoid going off-topic.\n\n### 2. Coherence and Cohesion (CC)\nHow well is your essay organized? Use paragraphs logically. A standard 4-paragraph structure (Intro, Body 1, Body 2, Conclusion) works best. Use linking words appropriately.\n\n### 3. Lexical Resource (LR)\nThis is your vocabulary score. Use a wide range of vocabulary accurately. Don't just use big words if you aren't sure of their collocation.\n\n### 4. Grammatical Range and Accuracy (GRA)\nUse a mix of simple, compound, and complex sentences. Minimize errors.\n\nOur platform's **Writing Assessor** gives you a breakdown of these exact four criteria using AI. Submit an essay today to see where you stand!",
        "featured_image_url": "https://images.unsplash.com/photo-1455390582262-044cdead2708?auto=format&fit=crop&q=80&w=1000",
        "category": "Exam Strategies",
        "tags": "IELTS, Writing, Task 2, Rubric",
        "author_name": "Michael Chang",
        "read_time_minutes": 5,
        "is_published": True,
    },
    {
        "title": "Institute Analytics: Tracking Cohort Performance",
        "slug": "institute-analytics-tracking-cohort-performance",
        "summary": "For IELTS training centers, tracking the progress of hundreds of students can be daunting. Learn how our new Analytics Dashboard simplifies this.",
        "content_markdown": "## Managing Student Success at Scale\n\nIf you run an IELTS coaching institute, you know the struggle of keeping track of every student's mock test scores. \n\nOur new **Institute Analytics Dashboard** provides a bird's-eye view of your entire cohort.\n\n### Features:\n- **Weak Area Detection:** The system automatically flags students consistently scoring below Band 6.0 in specific modules.\n- **Progress Curves:** Visualize batch improvements over a 12-week intensive course.\n- **Exportable Reports:** Generate 1-click PDF report cards to share with students and parents.\n\nUpgrade your institute's infrastructure with VisahouseLMS today.",
        "featured_image_url": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=1000",
        "category": "Platform Updates",
        "tags": "Analytics, Institutes, Updates",
        "author_name": "Product Team",
        "read_time_minutes": 3,
        "is_published": True,
    },
    {
        "title": "Draft: Upcoming Features in Q4",
        "slug": "draft-upcoming-features-q4",
        "summary": "A sneak peek at what we are building next.",
        "content_markdown": "## Q4 Roadmap\n\nWe are working on adding PTE and TOEFL support! Stay tuned.",
        "featured_image_url": None,
        "category": "Platform Updates",
        "tags": "Roadmap, Draft",
        "author_name": "Product Team",
        "read_time_minutes": 2,
        "is_published": False,
    }
]

def seed_blogs():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        print("Seeding project-related blogs...")
        
        # Check if we already have blogs
        existing_count = db.execute(select(BlogPost)).scalars().all()
        if len(existing_count) > 0:
            print(f"Found {len(existing_count)} existing blogs. Clearing them for a fresh seed...")
            for b in existing_count:
                db.delete(b)
            db.commit()

        for data in BLOGS_DATA:
            blog = BlogPost(**data)
            db.add(blog)
            
        db.commit()
        print(f"Successfully seeded {len(BLOGS_DATA)} blogs!")
        
    except Exception as e:
        print(f"Error seeding blogs: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_blogs()
