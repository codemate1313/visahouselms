import sys, os
sys.path.append(os.path.abspath("backend"))
from app.database import SessionLocal
from app.services import institute_service
from app.models.user import User

def main():
    db = SessionLocal()
    try:
        actor = db.query(User).filter_by(email="superadmin@gmail.com").first()
        if not actor:
            print("Superadmin not found!")
            return
            
        payload = {
            "name": "Test Institute 2",
            "contact_email": None,
            "admin_email": "x4@y.com",
            "admin_first_name": "x",
            "admin_last_name": "y",
            "session_duration_hours": 24,
            "agreement_reference": "ref",
            "agreed_amount": 1,
            "amount_received": 1,
            "currency": "INR",
            "payment_method_id": 9,
            "student_limit": 50,
            "staff_limit": 0,
            "access_duration_days": 365,
            "grace_days": 0,
            "module_ids": [],
        }
        print("Calling create_institute...")
        res = institute_service.create_institute(
            db, actor,
            payload["name"], payload["contact_email"], payload["admin_email"],
            payload["admin_first_name"], payload["admin_last_name"],
            payload["session_duration_hours"], "127.0.0.1"
        )
        print(f"Created institute ID {res['id']}")
        
        print("Calling update_institute...")
        institute_service.update_institute(db, actor, res["id"], payload, "127.0.0.1")
        print("Success")
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        db.rollback()

if __name__ == "__main__":
    main()
