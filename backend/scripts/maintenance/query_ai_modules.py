from app.database import SessionLocal
from app.models.exam_module import ExamModule, ExamModulePart

db = SessionLocal()
modules = db.query(ExamModule).join(ExamModulePart).filter(ExamModulePart.ai_evaluation_enabled == True).all()

if not modules:
    print("No modules have AI evaluation enabled.")
else:
    print("Modules with AI evaluation enabled:")
    for m in set(modules):
        print(f"- ID: {m.id}, Title: '{m.title}'")
