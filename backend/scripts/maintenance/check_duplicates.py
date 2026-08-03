from app.database import SessionLocal
from app.models.test_attempt import TestAttempt
from sqlalchemy import func

db = SessionLocal()
duplicates = db.query(TestAttempt.user_id, TestAttempt.module_id, func.count(TestAttempt.id)).group_by(TestAttempt.user_id, TestAttempt.module_id).having(func.count(TestAttempt.id) > 1).all()
print("Duplicates:")
for d in duplicates:
    print(d)

    attempts = db.query(TestAttempt).filter_by(user_id=d.user_id, module_id=d.module_id).order_by(TestAttempt.id).all()
    for a in attempts:
        print(f"  Attempt ID: {a.id}, is_retake: {getattr(a, 'is_retake', 'MISSING')}")
