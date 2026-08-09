import sys
import os

# Set backend path dynamically
if os.path.exists("backend"):
    sys.path.append(os.path.abspath("backend"))
else:
    sys.path.append(os.path.abspath("."))

from app.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User
from app.models.role import Role, ALL_ROLES
from app.models.institute import Institute

def main():
    print("Initializing Database Session...")
    db = SessionLocal()
    try:
        # 1. Ensure test institute exists
        inst = db.query(Institute).first()
        if not inst:
            print("No institute found. Creating 'Test Seed Institute'...")
            inst = Institute(
                name="Test Seed Institute",
                slug="test-seed-institute",
                is_active=True,
                onboarding_status="published"
            )
            db.add(inst)
            db.commit()
            db.refresh(inst)
        
        print(f"Using Institute: {inst.name} (ID: {inst.id})")

        # 2. Ensure all roles exist in the DB
        roles = {r.name: r for r in db.query(Role).all()}
        for r_name in ALL_ROLES:
            if r_name not in roles:
                print(f"Role '{r_name}' not found. Creating in DB...")
                new_role = Role(name=r_name)
                db.add(new_role)
                db.commit()
                roles[r_name] = new_role

        # 3. Create or update 1 account for each role
        password_plain = "Password123!"
        hashed = hash_password(password_plain)
        
        credentials = []

        for r_name in ALL_ROLES:
            email = f"test_{r_name.lower()}@example.com"
            user = db.query(User).filter_by(email=email).first()
            
            # Setup fields
            first_name = r_name.replace("_", " ").title().split()[0]
            last_name = "Test"
            
            inst_id = inst.id if r_name in ["INSTITUTE_ADMIN", "INST_INSTRUCTOR", "STUDENT"] else None
            is_developer_verified = True if r_name == "DEVELOPER" else False
            
            if user:
                print(f"Updating existing user: {email}")
                user.password_hash = hashed
                user.role_id = roles[r_name].id
                user.institute_id = inst_id
                user.first_name = first_name
                user.last_name = last_name
                user.is_active = True
                user.is_developer_verified = is_developer_verified
            else:
                print(f"Creating new user: {email}")
                user = User(
                    email=email,
                    password_hash=hashed,
                    role_id=roles[r_name].id,
                    institute_id=inst_id,
                    first_name=first_name,
                    last_name=last_name,
                    is_active=True,
                    is_developer_verified=is_developer_verified
                )
                db.add(user)
            
            db.commit()
            credentials.append({
                "role": r_name,
                "email": email,
                "password": password_plain
            })
            
        print("\n" + "="*50)
        print("SEEDING SUCCESSFUL - TEST CREDENTIALS")
        print("="*50)
        for cred in credentials:
            print(f"Role:     {cred['role']}")
            print(f"Email:    {cred['email']}")
            print(f"Password: {cred['password']}")
            print(f"OTP Code: 123456")
            print("-"*50)
            
    except Exception as e:
        print(f"Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
