import sys
import os
sys.path.append(os.path.abspath("backend"))
from app.db.session import SessionLocal
from app.services import institute_service
from app.models.user import User

db = SessionLocal()
try:
    actor = db.query(User).filter_by(email="superadmin@gmail.com").first()
    payload = {
        "name": "Test Institute",
        "contact_email": None,
        "admin_email": "x2@y.com",
        "admin_first_name": "x",
        "admin_last_name": "y",
        "session_duration_hours": 24,
        "agreement_reference": "ref",
        "agreed_amount": 1,
        "amount_received": 1,
        "currency": "INR",
        "payment_method_id": 1
    }
    res = institute_service.create_institute(
        db, actor,
        payload["name"], payload["contact_email"], payload["admin_email"],
        payload["admin_first_name"], payload["admin_last_name"],
        payload["session_duration_hours"], "127.0.0.1"
    )
    institute_service.update_institute(db, actor, res["id"], payload, "127.0.0.1")
    print("Success")
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.rollback()
