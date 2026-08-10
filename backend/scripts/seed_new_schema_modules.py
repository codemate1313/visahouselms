import sys
from datetime import datetime
from decimal import Decimal
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models.exam_module import ExamModule, ExamModulePart, ExamModuleQuestion
from app.models.role import SA_INSTRUCTOR, Role
from app.models.user import User

def main():
    print("Initializing database session...")
    db = SessionLocal()
    try:
        # 1. Fetch the instructor user
        instructor = db.query(User).join(Role).filter(Role.name == SA_INSTRUCTOR).first()
        if not instructor:
            print("No SA_INSTRUCTOR found. Running seed_dummy_modules.py first to create one...")
            import subprocess
            subprocess.run([sys.executable, "scripts/seed_dummy_modules.py"], check=True)
            instructor = db.query(User).join(Role).filter(Role.name == SA_INSTRUCTOR).first()
            if not instructor:
                print("Failed to find or create SA_INSTRUCTOR.")
                return

        print(f"Using Instructor: {instructor.email} (ID: {instructor.id})")

        # 2. Check and clean up existing schema test module
        title = "Sample New Schema Module - Academic Set 1"
        existing = db.query(ExamModule).filter(ExamModule.title == title).first()
        if existing:
            print(f"Cleaning up existing schema test module: {title}")
            db.delete(existing)
            db.commit()

        # 3. Create the new schema test module
        print("Creating new module with onboarding instructions...")
        module = ExamModule(
            module_type="reading",
            title=title,
            description="Seeded module to test new schemas, including onboarding instructions and questions with images.",
            instructions="Please read all onboarding steps and answer the questions.",
            status="published",
            is_visible=True,
            is_demo=False,
            duration_minutes=60,
            blueprint_version="LanguageCert Academic 2025",
            show_onboarding_instructions=True,
            onboarding_instructions=[
                {
                    "title": "Step 1: Check your equipment",
                    "text": "Ensure your browser and audio device are working correctly before starting."
                },
                {
                    "title": "Step 2: Read Guidelines",
                    "text": "Answer all questions to the best of your ability. Once the test starts, the timer cannot be paused."
                }
            ],
            created_by_id=instructor.id,
            published_at=datetime.utcnow()
        )
        db.add(module)
        db.flush()

        # 4. Create module part
        print("Creating module part...")
        part = ExamModulePart(
            module_id=module.id,
            section_type="reading",
            part_code="reading_schema_test",
            title="Part 1: Schema Test Part",
            skill_focus="Reading comprehension and image-based validation.",
            instructions="Look at the cell diagram and answer the question.",
            minimum_questions=1,
            auto_marked=True,
            sort_order=1
        )
        db.add(part)
        db.flush()

        # 5. Create question with image_path
        print("Creating question with image path...")
        question = ExamModuleQuestion(
            part_id=part.id,
            question_type="mcq_single",
            prompt="Which organelle is prominently highlighted at the center of the diagram?",
            passage="Generalized animal cells contain various membrane-bound organelles that perform specialized tasks. The largest organelle is the nucleus, which acts as the control center of the cell.",
            image_path="exam-modules/sample_question.webp",
            options=[
                {"key": "A", "text": "Mitochondria"},
                {"key": "B", "text": "Nucleus"},
                {"key": "C", "text": "Ribosome"},
                {"key": "D", "text": "Golgi Apparatus"}
            ],
            correct_answers=["B"],
            explanation="The organelle at the center is the nucleus.",
            points=Decimal("1"),
            created_by_id=instructor.id,
            sort_order=1
        )
        db.add(question)
        
        db.commit()
        print("\n" + "="*50)
        print("SEEDING SUCCESSFUL - NEW SCHEMA MODULE")
        print("="*50)
        print(f"Module ID:   {module.id}")
        print(f"Module Title: {module.title}")
        print(f"Part Title:   {part.title}")
        print(f"Question:     {question.prompt}")
        print(f"Image Path:   {question.image_path}")
        print("="*50)

    except Exception as e:
        print(f"Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
