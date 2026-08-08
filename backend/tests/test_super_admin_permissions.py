import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.models import Base
from app.models.role import DEVELOPER, SUPER_ADMIN, Role
from app.models.user import User
from app.routers import developer as developer_router
from app.services import super_admin_service


class SuperAdminMonetaryPermissionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        roles = [Role(name=name) for name in (SUPER_ADMIN, DEVELOPER)]
        self.db.add_all(roles)
        self.db.flush()
        by_name = {role.name: role for role in roles}
        self.owner = User(
            email="owner@permissions.test",
            password_hash=hash_password("OwnerPassword!1"),
            role_id=by_name[SUPER_ADMIN].id,
            first_name="Owner",
            last_name="Admin",
            is_active=True,
            is_owner=True,
        )
        self.admin = User(
            email="admin@permissions.test",
            password_hash=hash_password("AdminPassword!1"),
            role_id=by_name[SUPER_ADMIN].id,
            first_name="Plain",
            last_name="Admin",
            is_active=True,
            can_view_monetary_analytics=False,
        )
        self.developer = User(
            email="developer@permissions.test",
            password_hash=hash_password("DeveloperPassword!1"),
            role_id=by_name[DEVELOPER].id,
            first_name="Platform",
            last_name="Developer",
            is_active=True,
            is_developer_verified=True,
        )
        self.db.add_all([self.owner, self.admin, self.developer])
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

    def test_developer_route_refuses_super_admin_creation(self) -> None:
        user_count = self.db.query(User).count()

        with self.assertRaises(HTTPException) as context:
            developer_router.create_super_admin(actor=self.developer)

        self.assertEqual(context.exception.status_code, 403)
        self.assertEqual(self.db.query(User).count(), user_count)

    def test_developer_route_refuses_developer_creation(self) -> None:
        user_count = self.db.query(User).count()

        with self.assertRaises(HTTPException) as context:
            developer_router.create_developer(actor=self.developer)

        self.assertEqual(context.exception.status_code, 403)
        self.assertEqual(self.db.query(User).count(), user_count)

    def test_non_owner_cannot_create_developer_account(self) -> None:
        with self.assertRaises(HTTPException) as context:
            super_admin_service.create_developer(
                self.db,
                self.developer,
                "blocked-dev@permissions.test",
                "BlockedPassword!1",
                "Blocked",
                "Developer",
                None,
                verified=True,
            )

        self.assertEqual(context.exception.status_code, 403)
        self.assertIsNone(
            self.db.query(User).filter(User.email == "blocked-dev@permissions.test").first()
        )


if __name__ == "__main__":
    unittest.main()
