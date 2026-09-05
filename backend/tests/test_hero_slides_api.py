"""Router-level tests for the Super-Admin-managed hero carousels.

Both heroes shown to logged-out visitors - the public home page and the
login/register panel - read from `/hero-slides`, so these cover the seeding of
the shipped defaults, the role guard on the admin routes, and that an edit made
through the admin routes is what the public route then returns.
"""

import unittest
from unittest import mock

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.rate_limit import reset_rate_limits
from app.core.security import hash_password
from app.database import get_db
from app.main import app
from app.middleware import request_logging
from app.models import Base
from app.models.hero_slide import HeroSlide
from app.models.role import STUDENT, SUPER_ADMIN, Role
from app.models.user import User
from app.services import auth_service

PASSWORD = "CorrectHorse!1"


class HeroSlidesApiTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        self.roles = {}
        for name in (STUDENT, SUPER_ADMIN):
            role = Role(name=name)
            self.db.add(role)
            self.roles[name] = role
        self.db.commit()

        app.dependency_overrides[get_db] = self._override_get_db
        self._logging_patch = mock.patch.object(request_logging, "SessionLocal", self.Session)
        self._logging_patch.start()
        self.client = TestClient(app)
        reset_rate_limits()

    def tearDown(self) -> None:
        self._logging_patch.stop()
        app.dependency_overrides.clear()
        reset_rate_limits()
        self.db.close()
        self.engine.dispose()

    def _override_get_db(self):
        db = self.Session()
        try:
            yield db
        finally:
            db.close()

    def _make_user(self, email: str, role_name: str) -> User:
        user = User(
            email=email,
            password_hash=hash_password(PASSWORD),
            role_id=self.roles[role_name].id,
            institute_id=None,
            first_name="Test",
            last_name="User",
            is_active=True,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def _auth_header(self, user: User) -> dict:
        access_token, _refresh = auth_service.issue_login_session(
            self.db,
            user,
            "pytest",
            "127.0.0.1",
            device_identifier=f"test-device-{user.id:016d}",
            device_name="Test Device",
        )
        self.db.commit()
        return {"Authorization": f"Bearer {access_token}"}

    def _admin_header(self) -> dict:
        return self._auth_header(self._make_user("sa@example.com", SUPER_ADMIN))

    # --- public reads ----------------------------------------------------

    def test_public_read_seeds_defaults_for_each_location(self):
        home = self.client.get("/hero-slides", params={"location": "home"})
        login = self.client.get("/hero-slides", params={"location": "login"})
        self.assertEqual(home.status_code, 200)
        self.assertEqual(login.status_code, 200)
        self.assertEqual(len(home.json()), 3)
        self.assertEqual(len(login.json()), 3)
        # Home slides carry the CTA/stat fields the home hero renders.
        self.assertTrue(all(slide["cta_link"] for slide in home.json()))
        self.assertTrue(all(len(slide["stats"]) == 3 for slide in home.json()))

    def test_seeding_a_fresh_database_does_not_collide_on_id(self):
        """Regression test: DEFAULT_SLIDES once hardcoded `"id": 2` on one
        entry. On a brand new database this collided with the id SQLite
        autoincrements for the second slide in the list, and the very first
        request to hit an empty table raised `UNIQUE constraint failed:
        hero_slides.id` instead of seeding. Hitting the unfiltered endpoint
        first is what reproduces it: it seeds every location in one commit,
        which is exactly the moment the collision fired."""
        response = self.client.get("/hero-slides")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.db.query(HeroSlide).count(), 6)

    def test_public_read_seeds_only_once(self):
        self.client.get("/hero-slides", params={"location": "home"})
        self.client.get("/hero-slides", params={"location": "home"})
        self.assertEqual(self.db.query(HeroSlide).count(), 6)

    def test_public_read_rejects_unknown_location(self):
        response = self.client.get("/hero-slides", params={"location": "sidebar"})
        self.assertEqual(response.status_code, 400)

    def test_public_read_returns_slides_in_display_order(self):
        headers = self._admin_header()
        slides = self.client.get("/super-admin/hero-slides", params={"location": "home"}, headers=headers).json()
        reversed_ids = [slide["id"] for slide in reversed(slides)]
        self.client.put(
            "/super-admin/hero-slides/reorder",
            json=[{"id": sid, "display_order": i} for i, sid in enumerate(reversed_ids)],
            headers=headers,
        )
        public = self.client.get("/hero-slides", params={"location": "home"}).json()
        self.assertEqual([slide["id"] for slide in public], reversed_ids)

    def test_public_read_hides_inactive_slides(self):
        headers = self._admin_header()
        slides = self.client.get("/super-admin/hero-slides", params={"location": "login"}, headers=headers).json()
        response = self.client.put(
            f"/super-admin/hero-slides/{slides[0]['id']}",
            json={"is_active": False},
            headers=headers,
        )
        self.assertEqual(response.status_code, 200)
        public = self.client.get("/hero-slides", params={"location": "login"}).json()
        self.assertEqual(len(public), 2)
        self.assertNotIn(slides[0]["id"], [slide["id"] for slide in public])

    def test_public_read_falls_back_to_defaults_when_all_hidden(self):
        headers = self._admin_header()
        slides = self.client.get("/super-admin/hero-slides", params={"location": "login"}, headers=headers).json()
        for slide in slides:
            self.client.put(
                f"/super-admin/hero-slides/{slide['id']}", json={"is_active": False}, headers=headers
            )
        public = self.client.get("/hero-slides", params={"location": "login"}).json()
        self.assertEqual(len(public), 3)

    # --- admin guards ----------------------------------------------------

    def test_admin_routes_reject_anonymous_request(self):
        self.assertEqual(self.client.get("/super-admin/hero-slides").status_code, 403)

    def test_admin_routes_reject_student_role(self):
        headers = self._auth_header(self._make_user("student@example.com", STUDENT))
        self.assertEqual(self.client.get("/super-admin/hero-slides", headers=headers).status_code, 403)

    # --- admin writes ----------------------------------------------------

    def test_admin_edit_reaches_the_public_route(self):
        headers = self._admin_header()
        slides = self.client.get("/super-admin/hero-slides", params={"location": "home"}, headers=headers).json()
        response = self.client.put(
            f"/super-admin/hero-slides/{slides[0]['id']}",
            json={"title": "Brand New Heading", "badge": "Fresh Badge"},
            headers=headers,
        )
        self.assertEqual(response.status_code, 200)
        public = self.client.get("/hero-slides", params={"location": "home"}).json()
        self.assertEqual(public[0]["title"], "Brand New Heading")
        self.assertEqual(public[0]["badge"], "Fresh Badge")

    def test_admin_can_create_and_delete_a_slide(self):
        headers = self._admin_header()
        created = self.client.post(
            "/super-admin/hero-slides",
            json={
                "location": "login",
                "badge": "NEW",
                "title": "Added Slide",
                "subtitle": "Sub",
                "image_url": "/images/added.png",
                "display_order": 9,
            },
            headers=headers,
        )
        self.assertEqual(created.status_code, 201)
        slide_id = created.json()["id"]
        public = self.client.get("/hero-slides", params={"location": "login"}).json()
        self.assertIn("Added Slide", [slide["title"] for slide in public])

        deleted = self.client.delete(f"/super-admin/hero-slides/{slide_id}", headers=headers)
        self.assertEqual(deleted.status_code, 204)
        public = self.client.get("/hero-slides", params={"location": "login"}).json()
        self.assertNotIn("Added Slide", [slide["title"] for slide in public])

    def test_admin_create_rejects_unknown_location(self):
        headers = self._admin_header()
        response = self.client.post(
            "/super-admin/hero-slides",
            json={"location": "footer", "title": "x", "image_url": "/x.png"},
            headers=headers,
        )
        self.assertEqual(response.status_code, 422)

    def test_reset_restores_the_shipped_defaults_for_one_location_only(self):
        headers = self._admin_header()
        home = self.client.get("/super-admin/hero-slides", params={"location": "home"}, headers=headers).json()
        login = self.client.get("/super-admin/hero-slides", params={"location": "login"}, headers=headers).json()
        self.client.put(f"/super-admin/hero-slides/{home[0]['id']}", json={"title": "Edited"}, headers=headers)
        self.client.put(f"/super-admin/hero-slides/{login[0]['id']}", json={"title": "Also Edited"}, headers=headers)

        response = self.client.post("/super-admin/hero-slides/reset", params={"location": "home"}, headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 3)
        self.assertNotIn("Edited", [slide["title"] for slide in response.json()])

        login_after = self.client.get(
            "/super-admin/hero-slides", params={"location": "login"}, headers=headers
        ).json()
        self.assertEqual(login_after[0]["title"], "Also Edited")

    def test_update_rejects_unknown_slide(self):
        headers = self._admin_header()
        response = self.client.put("/super-admin/hero-slides/9999", json={"title": "x"}, headers=headers)
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
