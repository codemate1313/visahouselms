import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import select
from app.database import SessionLocal, engine
from app.models.base import Base
from app.models.testimonials import Testimonial
from app.models.blogs import BlogPost
from app.models.seo_settings import SEOSetting


def seed_cms_and_seo():
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # 1. Seed SEO Settings
        seo = db.scalar(select(SEOSetting).limit(1))
        if not seo:
            seo = SEOSetting(
                site_name="IELTS LMS Pro",
                default_title="IELTS LMS Pro | Computer-Delivered Exam Platform & AI Feedback",
                title_template="%s | IELTS LMS Pro",
                default_meta_description="Master computer-delivered IELTS with real-time exam simulations, instant AI Speaking audio analysis, auto-graded Writing feedback, and institute tracking.",
                default_meta_keywords="IELTS LMS, IELTS Practice, AI IELTS Evaluation, Computer Delivered IELTS, IELTS Mock Test, Band 8 Preparation",
                default_og_image="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80",
                twitter_handle="@ieltslmspro",
                robots_txt="User-agent: *\nAllow: /",
            )
            db.add(seo)
            print("--> Seeded default SEO settings.")
        else:
            print("--> SEO settings already exist, skipping.")

        # 2. Seed Testimonials
        if db.scalar(select(Testimonial).limit(1)) is None:
            testimonials = [
                Testimonial(
                    student_name="Ananya Sharma",
                    student_role="Computer-Delivered Academic Candidate",
                    target_score="Achieved Band 8.5",
                    avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
                    rating=5,
                    quote="The realistic exam timer and instant AI Speaking feedback were game-changers for me! I improved my Speaking score from 6.5 to 8.0 in just 3 weeks.",
                    is_active=True,
                    display_order=1,
                ),
                Testimonial(
                    student_name="Rahul Verma",
                    student_role="General Training Test Taker",
                    target_score="Achieved Band 8.0",
                    avatar_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
                    rating=5,
                    quote="Practicing on the exact split-screen Reading environment helped eliminate my exam anxiety. The AI Writing Assessor gave sentence-level grammar fixes that truly helped.",
                    is_active=True,
                    display_order=2,
                ),
                Testimonial(
                    student_name="Sophia Chen",
                    student_role="University Applicant (UK)",
                    target_score="Achieved Band 7.5",
                    avatar_url="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80",
                    rating=5,
                    quote="IELTS LMS delivers full coverage. The multi-accent Listening audio tracks matched the actual exam audio perfectly!",
                    is_active=True,
                    display_order=3,
                ),
                Testimonial(
                    student_name="Marcus Vance",
                    student_role="Healthcare Registration Candidate",
                    target_score="Achieved Band 8.0",
                    avatar_url="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
                    rating=5,
                    quote="The detailed band score breakdown across TR, CC, LR, and GRA criteria showed me exactly where I was losing marks in Task 2 essays.",
                    is_active=True,
                    display_order=4,
                ),
            ]
            db.add_all(testimonials)
            print("--> Seeded 4 student testimonials.")
        else:
            print("--> Testimonials already exist, skipping.")

        # 3. Seed Educational Blog Posts
        if db.scalar(select(BlogPost).limit(1)) is None:
            blogs = [
                BlogPost(
                    title="10 Proven Strategies to Score Band 8.0+ in IELTS Speaking Part 2 & 3",
                    slug="ielts-speaking-band-8-strategies",
                    summary="Master the 1-minute cue card preparation time, structure extended responses with idiomatic expressions, and maintain natural fluency under pressure.",
                    category="Speaking Tips",
                    tags="IELTS Speaking, Band 8, Fluency, Cue Card, Pronunciation",
                    author_name="Dr. Elena Rostova (IELTS Senior Examiner)",
                    read_time_minutes=6,
                    featured_image_url="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop&q=80",
                    content_markdown="""# 10 Proven Strategies to Score Band 8.0+ in IELTS Speaking Part 2 & 3

Scoring Band 8.0 or higher in IELTS Speaking requires more than just speaking fluent English; it demands strategic delivery, rich lexical resource, and grammatical accuracy under strict timing constraints.

## 1. Maximize Your 1-Minute Preparation Time
When handed the paper cue card in Part 2, do not write full sentences. Use a quick 4-point bullet outline:
- **Key point 1**: Hook & Setting (Who/Where/When)
- **Key point 2**: Core details & background
- **Key point 3**: Action & turning point
- **Key point 4**: Personal reflection & feeling

## 2. Master Cohesive Markers and Signposting
Instead of repeating basic connectors like *'also'* or *'because'*, incorporate high-band discourse markers:
- *'Having said that...'*
- *'To put it into perspective...'*
- *'Undoubtedly, a key factor contributing to this is...'*

## 3. Practice Pronunciation Rhythm and Intonation
The AI evaluation engine checks phoneme clarity, pause cadence, and stress. Avoid monotone speech by emphasizing key content words (nouns and verbs) and keeping functional words unstressed.

---

### Pro Tip for Test Day
Record your practice sessions on the IELTS LMS audio engine to track your Words Per Minute (WPM) and pause distribution!
""",
                    is_published=True,
                    meta_title="IELTS Speaking Band 8.0+ Preparation Guide | IELTS LMS",
                    meta_description="Discover expert strategies to ace IELTS Speaking Part 2 Cue Cards and Part 3 abstract discussions with Band 8 fluency.",
                ),
                BlogPost(
                    title="Demystifying Computer-Delivered IELTS Reading: Speed-Reading & Keyword Matching",
                    slug="computer-delivered-ielts-reading-mastery",
                    summary="Learn how to leverage split-screen passage views, sticky question navigation, and live text highlighting to finish all 40 questions in under 55 minutes.",
                    category="Reading Passages",
                    tags="IELTS Reading, Computer Delivered, Time Management, True False Not Given",
                    author_name="James Miller (Chief Academic Officer)",
                    read_time_minutes=7,
                    featured_image_url="https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&auto=format&fit=crop&q=80",
                    content_markdown="""# Demystifying Computer-Delivered IELTS Reading

The computer-delivered IELTS Reading test offers distinct advantages over paper-based tests, provided you know how to use the digital interface effectively.

## Split-Screen Efficiency
With split-screen viewing, the passage remains pinned on the left side while questions stay accessible on the right. 

### Essential Keyboard & Mouse Shortcuts
- **Right Click + Highlight**: Color code key dates, proper nouns, and central arguments.
- **Scroll & Sticky Navigator**: Keep track of unanswered questions in real time.

## Navigating 'True / False / Not Given' Questions
1. **True**: The statement matches the exact meaning of the passage (synonymously).
2. **False**: The statement directly contradicts the passage.
3. **Not Given**: The information is completely absent or cannot be confirmed without assumptions.

Practice on authentic split-screen passage views to build rapid scanning muscle memory!
""",
                    is_published=True,
                    meta_title="Computer Delivered IELTS Reading Guide & Tips | IELTS LMS",
                    meta_description="Master split-screen reading, keyword highlighting, and T/F/NG question techniques for computer-delivered IELTS.",
                ),
                BlogPost(
                    title="How to Structure Band 8.0 Task 2 Essays: TR, CC, LR, and GRA Unpacked",
                    slug="ielts-writing-task-2-band-8-structure",
                    summary="A complete breakdown of the official 4 evaluation criteria. Includes paragraph templates for Agree/Disagree, Discussion, and Problem-Solution prompts.",
                    category="Writing Assessor",
                    tags="IELTS Writing, Task 2, Essay Structure, Band 8, Grammar",
                    author_name="Dr. Elena Rostova",
                    read_time_minutes=8,
                    featured_image_url="https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&auto=format&fit=crop&q=80",
                    content_markdown="""# How to Structure Band 8.0 Task 2 Essays

To achieve a 7.5+ in IELTS Writing Task 2, your essay must demonstrate balance across all four official criteria: Task Response (TR), Coherence and Cohesion (CC), Lexical Resource (LR), and Grammatical Range and Accuracy (GRA).

## 4-Paragraph Essay Template
1. **Introduction (30-40 words)**: Paraphrase the prompt + clear thesis statement outlining your main position.
2. **Body Paragraph 1 (80-90 words)**: Topic sentence + explanation + concrete example.
3. **Body Paragraph 2 (80-90 words)**: Counter-argument or secondary main point + explanation + supporting evidence.
4. **Conclusion (30-40 words)**: Restate thesis in new words + summarizing takeaway.

Use the AI Writing Assessor on IELTS LMS for real-time criterion-by-criterion scoring!
""",
                    is_published=True,
                    meta_title="IELTS Writing Task 2 Band 8 Structure & Examples | IELTS LMS",
                    meta_description="Learn how to structure Task 2 IELTS essays with high Task Response, advanced vocabulary, and zero grammatical errors.",
                ),
            ]
            db.add_all(blogs)
            print("--> Seeded 3 educational IELTS blog posts.")
        else:
            print("--> Blog posts already exist, skipping.")

        db.commit()
        print("--> CMS and SEO Seeding completed successfully.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_cms_and_seo()
