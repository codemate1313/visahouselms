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
            print("--> SEO settings verified.")

        # 2. Upsert Testimonials
        testimonials_data = [
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

        seeded_t, updated_t = 0, 0
        for item in testimonials_data:
            existing = db.scalar(
                select(Testimonial).where(Testimonial.student_name == item["student_name"])
            )
            if existing:
                for k, v in item.items():
                    setattr(existing, k, v)
                updated_t += 1
            else:
                db.add(Testimonial(**item))
                seeded_t += 1
        print(f"--> Testimonials processed: {seeded_t} created, {updated_t} updated.")

        # 3. Upsert Educational Blog Posts
        blogs_data = [
            {
                "title": "10 Proven Strategies to Score Band 8.0+ in IELTS Speaking Part 2 & 3",
                "slug": "ielts-speaking-band-8-strategies",
                "summary": "Master the 1-minute cue card preparation time, structure extended responses with idiomatic expressions, and maintain natural fluency under pressure.",
                "category": "Speaking Tips",
                "tags": "IELTS Speaking, Band 8, Fluency, Cue Card, Pronunciation",
                "author_name": "Dr. Elena Rostova (IELTS Senior Examiner)",
                "read_time_minutes": 6,
                "featured_image_url": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop&q=80",
                "content_markdown": """# 10 Proven Strategies to Score Band 8.0+ in IELTS Speaking Part 2 & 3

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
                "is_published": True,
                "meta_title": "IELTS Speaking Band 8.0+ Preparation Guide | IELTS LMS",
                "meta_description": "Discover expert strategies to ace IELTS Speaking Part 2 Cue Cards and Part 3 abstract discussions with Band 8 fluency.",
            },
            {
                "title": "Demystifying Computer-Delivered IELTS Reading: Speed-Reading & Keyword Matching",
                "slug": "computer-delivered-ielts-reading-mastery",
                "summary": "Learn how to leverage split-screen passage views, sticky question navigation, and live text highlighting to finish all 40 questions in under 55 minutes.",
                "category": "Reading Passages",
                "tags": "IELTS Reading, Computer Delivered, Time Management, True False Not Given",
                "author_name": "James Miller (Chief Academic Officer)",
                "read_time_minutes": 7,
                "featured_image_url": "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&auto=format&fit=crop&q=80",
                "content_markdown": """# Demystifying Computer-Delivered IELTS Reading

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
                "is_published": True,
                "meta_title": "Computer Delivered IELTS Reading Guide & Tips | IELTS LMS",
                "meta_description": "Master split-screen reading, keyword highlighting, and T/F/NG question techniques for computer-delivered IELTS.",
            },
            {
                "title": "How to Structure Band 8.0 Task 2 Essays: TR, CC, LR, and GRA Unpacked",
                "slug": "ielts-writing-task-2-band-8-structure",
                "summary": "A complete breakdown of the official 4 evaluation criteria. Includes paragraph templates for Agree/Disagree, Discussion, and Problem-Solution prompts.",
                "category": "Writing Assessor",
                "tags": "IELTS Writing, Task 2, Essay Structure, Band 8, Grammar",
                "author_name": "Dr. Elena Rostova",
                "read_time_minutes": 8,
                "featured_image_url": "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&auto=format&fit=crop&q=80",
                "content_markdown": """# How to Structure Band 8.0 Task 2 Essays

To achieve a 7.5+ in IELTS Writing Task 2, your essay must demonstrate balance across all four official criteria: Task Response (TR), Coherence and Cohesion (CC), Lexical Resource (LR), and Grammatical Range and Accuracy (GRA).

## 4-Paragraph Essay Template
1. **Introduction (30-40 words)**: Paraphrase the prompt + clear thesis statement outlining your main position.
2. **Body Paragraph 1 (80-90 words)**: Topic sentence + explanation + concrete example.
3. **Body Paragraph 2 (80-90 words)**: Counter-argument or secondary main point + explanation + supporting evidence.
4. **Conclusion (30-40 words)**: Restate thesis in new words + summarizing takeaway.

Use the AI Writing Assessor on IELTS LMS for real-time criterion-by-criterion scoring!
""",
                "is_published": True,
                "meta_title": "IELTS Writing Task 2 Band 8 Structure & Examples | IELTS LMS",
                "meta_description": "Learn how to structure Task 2 IELTS essays with high Task Response, advanced vocabulary, and zero grammatical errors.",
            },
            {
                "title": "Ace the IELTS Listening Test: Section 1-4 Note-Taking & Multi-Accent Audio Strategies",
                "slug": "ielts-listening-audio-strategies",
                "summary": "Recognize common audio distractors, master British, Australian, and North American accent variations, and lock in 40/40 in Listening.",
                "category": "Listening Practice",
                "tags": "IELTS Listening, Accents, Note Taking, Distractors, Band 9",
                "author_name": "Sarah Jenkins (Master IELTS Trainer)",
                "read_time_minutes": 6,
                "featured_image_url": "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80",
                "content_markdown": """# Ace the IELTS Listening Test: Section 1-4 Note-Taking & Multi-Accent Audio Strategies

The IELTS Listening test evaluates your ability to understand main ideas, specific factual information, opinions, and attitudes across various English accents.

## Key Accent Challenges
1. **Received Pronunciation (British)**: Subtle vowel shifts and non-rhotic 'r' sounds.
2. **Australian English**: Flapped consonants and distinctive diphthong pronunciations.
3. **North American English**: Strong rhoticity and fast connected speech.

## Spotting Audio Distractors
In Section 1 and Section 2, speakers often state information and then correct themselves immediately:
- *Speaker A*: "We'll be arriving at 4:30 pm... Oh wait, my calendar says 5:15 pm."
- **Correct Answer**: 5:15 pm.

Always wait until the full clause is spoken before committing your answer!
""",
                "is_published": True,
                "meta_title": "IELTS Listening Test Preparation & Accent Tips | IELTS LMS",
                "meta_description": "Master IELTS Listening Section 1-4 note-taking skills, avoid distractors, and understand multi-accent recordings.",
            },
            {
                "title": "Computer-Delivered vs Paper-Based IELTS: Which Test Format Fits You Best?",
                "slug": "computer-delivered-vs-paper-based-ielts",
                "summary": "Compare typing speed vs handwriting, result turnaround times, noise-canceling headphones, and split-screen advantages before booking your exam.",
                "category": "General Guidance",
                "tags": "IELTS Comparison, Computer Delivered, Test Center, Format Guide",
                "author_name": "James Miller (Chief Academic Officer)",
                "read_time_minutes": 5,
                "featured_image_url": "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=80",
                "content_markdown": """# Computer-Delivered vs Paper-Based IELTS: Which Test Format Fits You Best?

Choosing between Computer-Delivered (CD) and Paper-Based IELTS is a pivotal decision in your exam preparation journey.

## Comparison Matrix

| Feature | Computer-Delivered | Paper-Based |
| :--- | :--- | :--- |
| **Results Delivery** | 3 to 5 calendar days | 13 calendar days |
| **Listening Headphones** | Individual noise-canceling headset | Central speaker system |
| **Reading Format** | Side-by-side split screen | Flipping paper pages |
| **Writing Editor** | Real-time live word count | Manual line estimation |

If you type at 30+ Words Per Minute (WPM) and prefer clear digital audio, the Computer-Delivered format offers a seamless test experience.
""",
                "is_published": True,
                "meta_title": "Computer Delivered vs Paper-Based IELTS Comparison | IELTS LMS",
                "meta_description": "Detailed comparison between computer-delivered and paper-based IELTS tests to help you choose the right format.",
            },
            {
                "title": "Mastering IELTS Writing Task 1: Describing Bar Charts, Line Graphs & Process Diagrams",
                "slug": "ielts-writing-task-1-data-description",
                "summary": "Learn how to craft an impactful overview sentence, select key trend highlights, and avoid spending over 20 minutes on Task 1.",
                "category": "Writing Assessor",
                "tags": "Writing Task 1, Data Visuals, Overview Paragraph, Comparison Vocabulary",
                "author_name": "Dr. Elena Rostova",
                "read_time_minutes": 7,
                "featured_image_url": "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80",
                "content_markdown": """# Mastering IELTS Writing Task 1: Describing Bar Charts, Line Graphs & Process Diagrams

Writing Task 1 tests your ability to select and report main features, make comparisons where relevant, and summarize visual information in 150+ words within 20 minutes.

## The Ideal 3-Paragraph Formula
1. **Introduction Paragraph**: Rephrase the task prompt using synonyms.
2. **Overview Paragraph**: Highlight the major overall trends, highest/lowest points, or main stages without giving specific numbers yet.
3. **Detail Paragraphs**: Group data logically and provide specific numeric evidence.

### High-Band Data Descriptors
- Instead of *'went up'*: *experienced a dramatic surge*, *climbed steadily*, *peaked at*.
- Instead of *'went down'*: *suffered a sharp decline*, *plummeted*, *bottomed out*.
""",
                "is_published": True,
                "meta_title": "IELTS Writing Task 1 Guide & Visual Vocabulary | IELTS LMS",
                "meta_description": "Master IELTS Writing Task 1 line graphs, bar charts, pie charts, and process diagrams with Band 8 vocabulary.",
            },
        ]

        seeded_b, updated_b = 0, 0
        for b_item in blogs_data:
            existing = db.scalar(
                select(BlogPost).where(BlogPost.slug == b_item["slug"])
            )
            if existing:
                for k, v in b_item.items():
                    setattr(existing, k, v)
                updated_b += 1
            else:
                db.add(BlogPost(**b_item))
                seeded_b += 1
        print(f"--> Blog posts processed: {seeded_b} created, {updated_b} updated.")

        db.commit()
        print("--> CMS and SEO Seeding completed successfully.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_cms_and_seo()
