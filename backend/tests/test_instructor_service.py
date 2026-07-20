import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password, verify_password
from app.models import Base
from app.models.role import SA_INSTRUCTOR, SUPER_ADMIN, Role
from app.models.user import User
from app.services import instructor_service


class InstructorServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        super_role = Role(name=SUPER_ADMIN)
        instructor_role = Role(name=SA_INSTRUCTOR)
        self.db.add_all([super_role, instructor_role])
        self.db.flush()
        self.actor = User(
            email="owner@example.com",
            password_hash=hash_password("OwnerPassword!1"),
            role_id=super_role.id,
            institute_id=None,
            first_name="System",
            last_name="Owner",
            is_active=True,
        )
        self.db.add(self.actor)
        self.db.commit()
        self.db.refresh(self.actor)

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _create(self) -> dict:
        return instructor_service.create_instructor(
            self.db,
            self.actor,
            email="teacher@example.com",
            first_name="Test",
            last_name="Teacher",
            title="Senior Instructor",
            bio="IELTS writing specialist",
            ip="127.0.0.1",
        )

    def test_create_returns_temporary_password_and_profile(self) -> None:
        created = self._create()
        user = instructor_service.get_instructor_or_404(self.db, created["id"])

        self.assertTrue(user.force_password_reset)
        self.assertIsNone(user.institute_id)
        self.assertIn("temporary_password", created)
        self.assertTrue(verify_password(created["temporary_password"], user.password_hash))
        self.assertEqual(user.role.name, SA_INSTRUCTOR)
        self.assertEqual(user.instructor_profile.title, "Senior Instructor")

    def test_update_reset_deactivate_reactivate_and_delete_lifecycle(self) -> None:
        created = self._create()
        instructor_id = created["id"]

        updated = instructor_service.update_instructor(
            self.db,
            self.actor,
            instructor_id,
            email=None,
            first_name=None,
            last_name=None,
            title="Lead Instructor",
            bio=None,
            fields_set={"title", "bio"},
            ip="127.0.0.1",
        )
        self.assertEqual(updated["title"], "Lead Instructor")
        self.assertIsNone(updated["bio"])

        new_password = instructor_service.reset_password(
            self.db, self.actor, instructor_id, "127.0.0.1"
        )
        user = instructor_service.get_instructor_or_404(self.db, instructor_id)
        self.assertTrue(user.force_password_reset)
        self.assertTrue(verify_password(new_password, user.password_hash))

        inactive = instructor_service.set_active(
            self.db, self.actor, instructor_id, False, "127.0.0.1"
        )
        self.assertFalse(inactive["is_active"])
        active = instructor_service.set_active(
            self.db, self.actor, instructor_id, True, "127.0.0.1"
        )
        self.assertTrue(active["is_active"])

        instructor_service.delete_instructor(
            self.db, self.actor, instructor_id, "127.0.0.1"
        )
        role = self.db.query(Role).filter(Role.name == SA_INSTRUCTOR).one()
        self.assertEqual(self.db.query(User).filter(User.role_id == role.id).count(), 0)

    def test_dashboard_exposes_stable_phase_3_contract(self) -> None:
        created = self._create()
        user = instructor_service.get_instructor_or_404(self.db, created["id"])
        summary = instructor_service.dashboard_summary(self.db, user)

        self.assertEqual(
            summary["content"],
            {
                "modules": 0,
                "drafts": 0,
                "published": 0,
                "questions": 0,
                "audio": 0,
                "reading": 0,
                "speaking": 0,
                "writing": 0,
                "listening": 0,
                "full_mock": 0,
                "final_test": 0,
            },
        )
        self.assertEqual(summary["grading"], {"pending": 0, "in_progress": 0, "completed_today": 0})
        self.assertGreaterEqual(summary["profile_completion"], 80)


if __name__ == "__main__":
    unittest.main()
