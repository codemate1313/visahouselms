import unittest
from unittest import mock

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base
from app.models.blogs import BlogPost
from app.models.contact_settings import ContactSettings
from app.models.seo_settings import SEOSetting
from app.models.setting import Setting
from app.models.testimonials import Testimonial
from app.routers import contact_settings_router, seo_router
from app.services import settings_service, smtp_service
from scripts import seed_cms_and_seo


class SettingsPersistenceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_public_seo_read_does_not_create_default_row(self) -> None:
        response = seo_router.get_public_seo_settings(self.db)

        self.assertEqual(response["site_name"], "Language CERT Pro")
        self.assertEqual(self.db.query(SEOSetting).count(), 0)

    def test_public_contact_read_does_not_create_default_row(self) -> None:
        response = contact_settings_router.get_public_contact_settings(self.db)

        self.assertEqual(response["contact"]["email"], "enquiry.langugaecert@gmail.com")
        self.assertEqual(response["social_links"], [])
        self.assertEqual(self.db.query(ContactSettings).count(), 0)

    def test_seed_cms_does_not_overwrite_existing_content(self) -> None:
        testimonial = Testimonial(
            student_name="Ananya Sharma",
            student_role="Configured role",
            target_score="Configured target",
            rating=4,
            quote="Configured testimonial must persist.",
            is_active=False,
            display_order=99,
        )
        blog = BlogPost(
            title="Configured title",
            slug="language-cert-speaking-band-8-strategies",
            summary="Configured summary",
            category="Configured category",
            tags="configured",
            author_name="Configured author",
            read_time_minutes=42,
            featured_image_url="https://example.com/custom.jpg",
            content_markdown="Configured blog content must persist.",
            is_published=False,
            meta_title="Configured meta title",
            meta_description="Configured meta description",
        )
        self.db.add_all([testimonial, blog])
        self.db.commit()

        with (
            mock.patch.object(seed_cms_and_seo, "engine", self.engine),
            mock.patch.object(seed_cms_and_seo, "SessionLocal", self.Session),
        ):
            seed_cms_and_seo.seed_cms_and_seo()

        self.db.refresh(testimonial)
        self.db.refresh(blog)

        self.assertEqual(testimonial.quote, "Configured testimonial must persist.")
        self.assertEqual(testimonial.display_order, 99)
        self.assertFalse(testimonial.is_active)
        self.assertEqual(blog.title, "Configured title")
        self.assertEqual(blog.content_markdown, "Configured blog content must persist.")
        self.assertFalse(blog.is_published)

    def test_broken_encrypted_secret_is_not_reported_as_configured(self) -> None:
        self.db.add(
            Setting(
                key="smtp.password",
                value="encrypted-with-a-different-key",
                is_encrypted=True,
                institute_id=None,
            )
        )
        self.db.commit()

        result = settings_service.get_settings_group(self.db, "smtp")

        self.assertIsNone(result["password"])

    def test_smtp_test_returns_clear_error_for_broken_password_secret(self) -> None:
        self.db.add_all(
            [
                Setting(key="smtp.host", value="smtp.gmail.com", institute_id=None, is_encrypted=False),
                Setting(key="smtp.port", value="587", institute_id=None, is_encrypted=False),
                Setting(key="smtp.username", value="sender@example.com", institute_id=None, is_encrypted=False),
                Setting(
                    key="smtp.password",
                    value="encrypted-with-a-different-key",
                    institute_id=None,
                    is_encrypted=True,
                ),
                Setting(key="smtp.encryption", value="tls", institute_id=None, is_encrypted=False),
                Setting(key="smtp.from_address", value="sender@example.com", institute_id=None, is_encrypted=False),
            ]
        )
        self.db.commit()

        with self.assertRaises(Exception) as context:
            smtp_service.send_test_email(self.db, "receiver@example.com")

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("Re-enter and save the SMTP password", context.exception.detail)


if __name__ == "__main__":
    unittest.main()
