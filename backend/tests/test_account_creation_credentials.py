import unittest
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.models import Base
from app.models.institute import Institute
from app.models.role import (
    DEVELOPER,
    INSTITUTE_ADMIN,
    INST_INSTRUCTOR,
    SA_INSTRUCTOR,
    STUDENT,
    SUPER_ADMIN,
    Role,
)
from app.models.user import User
from app.services import (
    account_service,
    auth_service,
    institute_admin_service,
    institute_service,
    instructor_service,
    super_admin_service,
    institute_signup_service,
)


class AccountCreationCredentialTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        self.roles = {}
        for name in (DEVELOPER, SUPER_ADMIN, SA_INSTRUCTOR, INSTITUTE_ADMIN, INST_INSTRUCTOR, STUDENT):
            role = Role(name=name)
            self.db.add(role)
            self.roles[name] = role

        self.institute = Institute(name="Credential Academy", slug="credential-academy", is_active=True)
        self.db.add(self.institute)
        self.db.flush()

        self.owner = self._user("owner@creds.test", SUPER_ADMIN, is_owner=True)
        self.sa_instructor = self._user("sa-instructor@creds.test", SA_INSTRUCTOR)
        self.institute_admin = self._user(
            "principal@creds.test",
            INSTITUTE_ADMIN,
            institute_id=self.institute.id,
        )
        self.institute_instructor = self._user(
            "marker@creds.test",
            INST_INSTRUCTOR,
            institute_id=self.institute.id,
        )
        self.student = self._user("student@creds.test", STUDENT, institute_id=self.institute.id)
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _user(
        self,
        email: str,
        role_name: str,
        *,
        institute_id: Optional[int] = None,
        is_owner: bool = False,
    ) -> User:
        user = User(
            email=email,
            password_hash=hash_password("Password!1"),
            role_id=self.roles[role_name].id,
            institute_id=institute_id,
            first_name=email.split("@")[0],
            last_name="User",
            is_active=True,
            is_owner=is_owner,
        )
        self.db.add(user)
        return user

    def _assert_credentials_belong_to_user(self, callback) -> None:
        with self.assertRaises(HTTPException) as context:
            callback()
        self.assertEqual(context.exception.status_code, 409)
        self.assertEqual(
            context.exception.detail,
            account_service.USER_CREDENTIALS_CONFLICT_DETAIL,
        )

    def test_super_admin_creation_rejects_existing_student_credentials(self) -> None:
        self._assert_credentials_belong_to_user(
            lambda: super_admin_service.create_super_admin(
                self.db,
                self.owner,
                "STUDENT@CREDS.TEST",
                "Password!1",
                "Duplicate",
                "Admin",
                "127.0.0.1",
            )
        )

    def test_sa_instructor_creation_rejects_existing_super_admin_credentials(self) -> None:
        self._assert_credentials_belong_to_user(
            lambda: instructor_service.create_instructor(
                self.db,
                self.owner,
                email="owner@creds.test",
                first_name="Duplicate",
                last_name="Instructor",
                title="Instructor",
                bio=None,
                ip="127.0.0.1",
            )
        )

    def test_institute_creation_rejects_existing_sa_instructor_credentials(self) -> None:
        self._assert_credentials_belong_to_user(
            lambda: institute_service.create_institute(
                self.db,
                self.owner,
                "Duplicate Institute",
                None,
                "sa-instructor@creds.test",
                "Duplicate",
                "Principal",
                24,
                "127.0.0.1",
            )
        )

    def test_institute_member_creation_rejects_existing_institute_admin_credentials(self) -> None:
        self._assert_credentials_belong_to_user(
            lambda: institute_admin_service.create_member(
                self.db,
                self.institute_admin,
                email="principal@creds.test",
                first_name="Duplicate",
                last_name="Student",
                role_name=STUDENT,
                phone_number=None,
                address=None,
                ip="127.0.0.1",
            )
        )

    def test_student_registration_rejects_existing_institute_instructor_credentials(self) -> None:
        self._assert_credentials_belong_to_user(
            lambda: auth_service.register(
                self.db,
                "marker@creds.test",
                "Password!1",
                "Duplicate",
                "Student",
                "127.0.0.1",
            )
        )

    def test_google_student_registration_rejects_existing_user_credentials(self) -> None:
        self._assert_credentials_belong_to_user(
            lambda: auth_service.get_or_create_google_student(
                self.db,
                "principal@creds.test",
                "Duplicate",
                "Google",
                "127.0.0.1",
            )
        )

    def test_public_institute_signup_rejects_existing_user_credentials(self) -> None:
        self._assert_credentials_belong_to_user(
            lambda: institute_signup_service.submit(
                self.db,
                {
                    "institute_name": "Duplicate Signup",
                    "contact_email": "hello@duplicate-signup.test",
                    "admin_email": "student@creds.test",
                    "admin_first_name": "Duplicate",
                    "admin_last_name": "Admin",
                    "phone": None,
                    "message": None,
                    "preferred_plan_id": None,
                },
                "127.0.0.1",
            )
        )


if __name__ == "__main__":
    unittest.main()
