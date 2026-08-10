import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models.exam_module import ExamModule, InstituteModule
from app.models.user import User

def main():
    db = SessionLocal()
    try:
        print("=== Institute Modules in DB ===")
        ims = db.query(InstituteModule).all()
        for im in ims:
            print(f"Institute ID: {im.institute_id}, Module ID: {im.module_id}, Active: {im.is_active}")
            
        print("\n=== Check Navish / Ravish (Institute 4) ===")
        # Get module 14
        m14 = db.query(ExamModule).filter(ExamModule.id == 14).first()
        if m14:
            print(f"Module 14 Status: {m14.status}, Visible: {m14.is_visible}")
            assoc_insts = db.query(InstituteModule).filter(InstituteModule.module_id == 14).all()
            for assoc in assoc_insts:
                print(f"  Assigned to Institute ID: {assoc.institute_id}, Active: {assoc.is_active}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
