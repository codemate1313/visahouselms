import sys, os
sys.path.append(os.path.abspath("backend"))
from app.database import SessionLocal
from app.models.institute import Institute
from app.models.subscription import Subscription
from app.models.user import User
from app.services import subscription_service
db = SessionLocal()
actor = db.query(User).filter_by(email="superadmin@gmail.com").first()
institutes = db.query(Institute).filter(Institute.onboarding_plan_id.isnot(None)).all()
for inst in institutes:
    sub = db.query(Subscription).filter_by(institute_id=inst.id).first()
    if not sub:
        print(f"Fixing missing subscription for {inst.name} ({inst.id})")
        subscription_service.assign(db, actor, inst.id, inst.onboarding_plan_id, None, "127.0.0.1")
db.close()
