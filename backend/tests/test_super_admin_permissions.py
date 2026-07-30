import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.models import Base
from app.models.role import SUPER_ADMIN, Role
from app.models.user import User
from app.services import super_admin_service


class SuperAdminMonetaryPermissionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        role = Role(name=SUPER_ADMIN)
        self.db.add(role)
        self.db.flush()
        self.owner = User(
            email="owner@permissions.test",
            password_hash=hash_password("OwnerPassword!1"),
            role_id=role.id,
            first_name="Owner",
            last_name="Admin",
            is_active=True,
            is_owner=True,
        )
        self.admin = User(
            email="admin@permissions.test",
            password_hash=hash_password("AdminPassword!1"),
            role_id=role.id,
            first_name="Plain",
            last_name="Admin",
            is_active=True,
            can_view_monetary_analytics=False,
        )
        self.db.add_all([self.owner, self.admin])
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_owner_can_create_super_admin_without_monetary_analytics(self) -> None:
        created = super_admin_service.create_super_admin(
            self.db,
            self.owner,
            "restricted-new@permissions.test",
            "RestrictedPassword!1",
            "Restricted",
            "Admin",
            None,
            can_view_monetary_analytics=False,
        )

        self.assertFalse(created.can_view_monetary_analytics)

    def test_non_owner_cannot_grant_monetary_analytics(self) -> None:
        with self.assertRaises(HTTPException) as context:
            super_admin_service.create_super_admin(
                self.db,
                self.admin,
                "granted@permissions.test",
                "GrantedPassword!1",
                "Granted",
                "Admin",
                None,
                can_view_monetary_analytics=True,
            )
        self.assertEqual(context.exception.status_code, 403)

    def test_owner_can_update_monetary_analytics_permission(self) -> None:
        updated = super_admin_service.update_super_admin(
            self.db,
            self.owner,
            self.admin.id,
            None,
            None,
            None,
            None,
            can_view_monetary_analytics=True,
        )

        self.assertTrue(updated.can_view_monetary_analytics)


if __name__ == "__main__":
    unittest.main()
