import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models.exam_module import ExamModulePart

def main():
    db = SessionLocal()
    try:
        parts = db.query(ExamModulePart).filter(ExamModulePart.part_code == "reading_4").all()
        updated_count = 0
        for part in parts:
            constraints = part.answer_constraints or {}
            if "minimum_inference_questions" in constraints:
                new_constraints = dict(constraints)
                del new_constraints["minimum_inference_questions"]
                part.answer_constraints = new_constraints
                updated_count += 1
        db.commit()
        print(f"Successfully updated constraints for {updated_count} existing reading_4 parts.")
    finally:
        db.close()

if __name__ == "__main__":
    main()
