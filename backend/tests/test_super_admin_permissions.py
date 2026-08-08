import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password, verify_password
from app.models import Base
from app.models.role import DEVELOPER, INSTITUTE_ADMIN, SA_INSTRUCTOR, SUPER_ADMIN, Role
from app.models.user_session import UserSession
from app.models.user import User
from app.routers import developer as developer_router
from app.schemas.user import DeveloperAccountCreate, SuperAdminAccountCreate
from app.services import developer_directory_service, super_admin_service


class SuperAdminMonetaryPermissionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        roles = [Role(name=name) for name in (SUPER_ADMIN, DEVELOPER, SA_INSTRUCTOR, INSTITUTE_ADMIN)]
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

    def _request(self):
        return SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"))

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

    def test_developer_route_can_create_super_admin_owner(self) -> None:
        response = developer_router.create_super_admin(
            payload=SuperAdminAccountCreate(
                email="owner-created@example.com",
                password="OwnerCreated!1",
                first_name="Created",
                last_name="Owner",
                can_view_monetary_analytics=True,
            ),
            request=self._request(),
            db=self.db,
            actor=self.developer,
        )

        self.assertEqual(response["email"], "owner-created@example.com")
        self.assertEqual(response["temporary_password"], "OwnerCreated!1")
        created = self.db.query(User).filter(User.email == "owner-created@example.com").one()
        self.assertTrue(created.is_owner)
        self.assertTrue(created.can_view_monetary_analytics)
        self.assertTrue(verify_password("OwnerCreated!1", created.password_hash))

    def test_developer_route_can_create_verified_developer(self) -> None:
        response = developer_router.create_developer(
            payload=DeveloperAccountCreate(
                email="created-dev@example.com",
                password="CreatedDev!1",
                first_name="Created",
                last_name="Developer",
                is_developer_verified=True,
            ),
            request=self._request(),
            db=self.db,
            actor=self.developer,
        )

        self.assertEqual(response["email"], "created-dev@example.com")
        self.assertEqual(response["temporary_password"], "CreatedDev!1")
        created = self.db.query(User).filter(User.email == "created-dev@example.com").one()
        self.assertTrue(created.is_developer_verified)
        self.assertTrue(verify_password("CreatedDev!1", created.password_hash))

    def test_developer_route_can_reset_managed_account_password(self) -> None:
        response = developer_router.reset_password(
            account_id=self.owner.id,
            request=self._request(),
            db=self.db,
            actor=self.developer,
        )

        self.assertIn("temporary_password", response)
        self.assertTrue(response["temporary_password"])
        self.db.refresh(self.owner)
        self.assertTrue(self.owner.force_password_reset)
        self.assertTrue(verify_password(response["temporary_password"], self.owner.password_hash))

    def test_developer_can_change_any_account_role_and_revoke_sessions(self) -> None:
        self.db.add(
            UserSession(
                user_id=self.admin.id,
                refresh_token_hash="hash",
                user_agent="test",
                ip_address="127.0.0.1",
                created_at=datetime.now(timezone.utc),
                expires_at=datetime.now(timezone.utc) + timedelta(days=1),
            )
        )
        self.db.commit()

        updated = developer_directory_service.change_role(
            self.db,
            self.developer,
            self.admin.id,
            SA_INSTRUCTOR,
            "127.0.0.1",
        )

        self.assertEqual(updated.role_name, SA_INSTRUCTOR)
        self.assertFalse(updated.is_owner)
        self.assertFalse(updated.is_developer_verified)
        session = self.db.query(UserSession).filter(UserSession.user_id == self.admin.id).one()
        self.assertIsNotNone(session.revoked_at)

    def test_developer_delete_soft_deletes_account_without_removing_row(self) -> None:
        result = developer_directory_service.delete_account(
            self.db,
            self.developer,
            self.admin.id,
            "127.0.0.1",
        )

        self.assertTrue(result["deleted"])
        archived = self.db.get(User, self.admin.id)
        self.assertIsNotNone(archived)
        self.assertIsNotNone(archived.deleted_at)
        self.assertFalse(archived.is_active)
        self.assertEqual(archived.email, f"deleted+{self.admin.id}@deleted.invalid")

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
