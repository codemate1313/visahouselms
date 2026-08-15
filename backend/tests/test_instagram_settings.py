import unittest
from unittest import mock

from fastapi import Request
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base
from app.models.instagram_settings import InstagramSettings
from app.models.role import Role, SUPER_ADMIN
from app.models.user import User
from app.routers import instagram_router
from app.schemas.instagram_settings import InstagramSettingsUpdate
from app.services import instagram_service


class InstagramSettingsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        role = Role(id=1, name=SUPER_ADMIN)
        self.db.add(role)
        self.admin_user = User(
            id=1,
            email="admin@visahouse.io",
            first_name="Admin",
            last_name="User",
            role_id=1,
            password_hash="hashed_pw",
        )
        self.db.add(self.admin_user)
        self.db.commit()

        self.dummy_request = mock.MagicMock(spec=Request)
        self.dummy_request.client.host = "127.0.0.1"
        self.dummy_request.headers = {"user-agent": "test-agent"}

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_get_public_feed_returns_sample_items(self) -> None:
        feed = instagram_router.get_public_instagram_feed(self.db)
        self.assertTrue(feed.is_enabled)
        self.assertEqual(feed.username, "visa_house_imm")
        self.assertGreaterEqual(len(feed.items), 1)

    def test_disable_feed_hides_public_items(self) -> None:
        instagram_router.update_admin_instagram_settings(
            InstagramSettingsUpdate(is_enabled=False),
            self.dummy_request,
            self.db,
            self.admin_user,
        )

        feed = instagram_router.get_public_instagram_feed(self.db)
        self.assertFalse(feed.is_enabled)
        self.assertEqual(len(feed.items), 0)

    def test_update_settings_and_mask_token(self) -> None:
        res = instagram_router.update_admin_instagram_settings(
            InstagramSettingsUpdate(
                access_token="IGQVJ_test_secret_token_1234567890",
                username="visahouselms",
                fetch_limit=6,
            ),
            self.dummy_request,
            self.db,
            self.admin_user,
        )

        self.assertTrue(res.has_access_token)
        self.assertTrue(res.access_token_masked.startswith("IGQVJ_..."))
        self.assertEqual(res.username, "visahouselms")
        self.assertEqual(res.fetch_limit, 6)

    def test_seed_sample_reels(self) -> None:
        res = instagram_router.seed_instagram_sample_reels(
            self.dummy_request,
            self.db,
            self.admin_user,
        )
        self.assertGreaterEqual(len(res.feed_items), 4)
        reel_items = [i for i in res.feed_items if i.media_type == "REEL"]
        self.assertTrue(len(reel_items) > 0)

    def test_delete_feed_item_and_clear_feed(self) -> None:
        seeded = instagram_router.seed_instagram_sample_reels(
            self.dummy_request,
            self.db,
            self.admin_user,
        )
        self.assertGreaterEqual(len(seeded.feed_items), 2)
        target_id = seeded.feed_items[0].id

        deleted_res = instagram_router.delete_single_instagram_feed_item(
            target_id,
            self.dummy_request,
            self.db,
            self.admin_user,
        )
        self.assertEqual(len(deleted_res.feed_items), len(seeded.feed_items) - 1)
        self.assertNotIn(target_id, [i.id for i in deleted_res.feed_items])

        cleared_res = instagram_router.clear_all_instagram_feed_items(
            self.dummy_request,
            self.db,
            self.admin_user,
        )
        self.assertEqual(len(cleared_res.feed_items), 0)

    def test_empty_token_connection_test(self) -> None:
        res = instagram_router.test_instagram_api_connection(
            self.dummy_request,
            InstagramSettingsUpdate(access_token=""),
            self.db,
            self.admin_user,
        )
        self.assertFalse(res.success)


if __name__ == "__main__":
    unittest.main()
