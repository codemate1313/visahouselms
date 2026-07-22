import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.models import Base
from app.models.institute import Institute
from app.models.notification import ANNOUNCEMENT_PUBLISHED, StudentNotification
from app.models.role import INSTITUTE_ADMIN, INST_INSTRUCTOR, SA_INSTRUCTOR, STUDENT, SUPER_ADMIN, Role
from app.models.user import User
from app.schemas.announcement import AnnouncementCreate
from app.services import announcement_service


class AnnouncementServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        roles = [
            Role(name=name)
            for name in (INSTITUTE_ADMIN, INST_INSTRUCTOR, SA_INSTRUCTOR, STUDENT, SUPER_ADMIN)
        ]
        self.db.add_all(roles)
        self.db.flush()
        by_name = {role.name: role for role in roles}
        self.institute = Institute(name="North Academy", slug="north", contact_email="hello@north.test")
        self.other_institute = Institute(name="South Academy", slug="south", contact_email="hello@south.test")
        self.db.add_all([self.institute, self.other_institute])
        self.db.flush()
        self.admin = User(
            email="admin@north.test",
            password_hash=hash_password("AdminPassword!1"),
            role_id=by_name[INSTITUTE_ADMIN].id,
            institute_id=self.institute.id,
            first_name="Nora",
            last_name="Admin",
            is_active=True,
        )
        self.student = User(
            email="student@north.test",
            password_hash=hash_password("StudentPassword!1"),
            role_id=by_name[STUDENT].id,
            institute_id=self.institute.id,
            first_name="Sam",
            last_name="Student",
            is_active=True,
        )
        self.other_student = User(
            email="student@south.test",
            password_hash=hash_password("StudentPassword!1"),
            role_id=by_name[STUDENT].id,
            institute_id=self.other_institute.id,
            first_name="Other",
            last_name="Student",
            is_active=True,
        )
        self.super_admin = User(
            email="super@example.com",
            password_hash=hash_password("SuperPassword!1"),
            role_id=by_name[SUPER_ADMIN].id,
            first_name="Super",
            last_name="Admin",
            is_active=True,
        )
        self.sa_instructor = User(
            email="author@example.com",
            password_hash=hash_password("AuthorPassword!1"),
            role_id=by_name[SA_INSTRUCTOR].id,
            first_name="Author",
            last_name="One",
            is_active=True,
        )
        self.inst_instructor = User(
            email="teacher@north.test",
            password_hash=hash_password("TeacherPassword!1"),
            role_id=by_name[INST_INSTRUCTOR].id,
            institute_id=self.institute.id,
            first_name="Teacher",
            last_name="North",
            is_active=True,
        )
        self.db.add_all([
            self.admin,
            self.student,
            self.other_student,
            self.super_admin,
            self.sa_instructor,
            self.inst_instructor,
        ])
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_institute_announcement_notifies_only_own_students(self) -> None:
        created = announcement_service.create_announcement(
            self.db,
            self.admin,
            AnnouncementCreate(title="Mock test published", message="New mock test is available."),
            institute_id=self.institute.id,
        )

        self.assertEqual(created["status"], "published")
        notifications = self.db.query(StudentNotification).all()
        self.assertEqual(len(notifications), 1)
        self.assertEqual(notifications[0].user_id, self.student.id)
        self.assertEqual(notifications[0].kind, ANNOUNCEMENT_PUBLISHED)
        self.assertEqual(notifications[0].link_url, "/student/announcements")

    def test_platform_announcement_notifies_all_students(self) -> None:
        announcement_service.create_announcement(
            self.db,
            self.super_admin,
            AnnouncementCreate(title="Platform update", message="System-wide update."),
            institute_id=None,
        )

        notified_user_ids = {row.user_id for row in self.db.query(StudentNotification).all()}
        self.assertEqual(notified_user_ids, {self.student.id, self.other_student.id})

    def test_staff_audience_notifies_staff_roles(self) -> None:
        announcement_service.create_announcement(
            self.db,
            self.super_admin,
            AnnouncementCreate(title="Staff update", message="Internal update.", audience="staff"),
            institute_id=None,
        )

        notified_user_ids = {row.user_id for row in self.db.query(StudentNotification).all()}
        self.assertEqual(
            notified_user_ids,
            {self.super_admin.id, self.sa_instructor.id, self.admin.id, self.inst_instructor.id},
        )

    def test_institute_staff_audience_stays_in_institute(self) -> None:
        announcement_service.create_announcement(
            self.db,
            self.admin,
            AnnouncementCreate(title="Institute staff update", message="Internal update.", audience="staff"),
            institute_id=self.institute.id,
        )

        notifications = self.db.query(StudentNotification).all()
        notified_user_ids = {row.user_id for row in notifications}
        self.assertEqual(notified_user_ids, {self.admin.id, self.inst_instructor.id})
        self.assertEqual({row.link_url for row in notifications}, {"/institute-portal/announcements", "/institute-instructor/grading"})

    def test_scheduled_announcement_publishing(self) -> None:
        from datetime import datetime, timedelta, timezone

        future = datetime.now(timezone.utc) + timedelta(hours=2)
        created = announcement_service.create_announcement(
            self.db,
            self.super_admin,
            AnnouncementCreate(
                title="Future launch",
                message="Launching in 2 hours",
                status="scheduled",
                scheduled_at=future,
            ),
            institute_id=None,
        )

        self.assertEqual(created["status"], "scheduled")
        self.assertEqual(len(self.db.query(StudentNotification).all()), 0)

        # Maturing the schedule by setting scheduled_at to past
        from app.models.notification import Announcement
        ann = self.db.query(Announcement).get(created["id"])
        ann.scheduled_at = datetime.now(timezone.utc) - timedelta(minutes=5)
        self.db.commit()

        count = announcement_service.process_scheduled_announcements(self.db)
        self.assertEqual(count, 1)

        refreshed = self.db.query(Announcement).get(created["id"])
        self.assertEqual(refreshed.status, "published")
        self.assertTrue(len(self.db.query(StudentNotification).all()) > 0)

    def test_specific_student_targeting(self) -> None:
        announcement_service.create_announcement(
            self.db,
            self.super_admin,
            AnnouncementCreate(
                title="Personal Notice",
                message="Direct message to Sam",
                audience="specific_students",
                target_user_ids=[self.student.id],
            ),
            institute_id=None,
        )

        notifications = self.db.query(StudentNotification).all()
        self.assertEqual(len(notifications), 1)
        self.assertEqual(notifications[0].user_id, self.student.id)

    def test_specific_institute_targeting(self) -> None:
        announcement_service.create_announcement(
            self.db,
            self.super_admin,
            AnnouncementCreate(
                title="North Campus Notice",
                message="Exclusively for North Academy",
                audience="institutes",
                target_institute_ids=[self.institute.id],
            ),
            institute_id=None,
        )

        notified_user_ids = {row.user_id for row in self.db.query(StudentNotification).all()}
        self.assertIn(self.student.id, notified_user_ids)
        self.assertNotIn(self.other_student.id, notified_user_ids)

    def test_target_options(self) -> None:
        self.other_institute.is_active = False
        self.db.commit()

        sa_opts = announcement_service.get_super_admin_target_options(self.db)
        self.assertTrue(len(sa_opts["institutes"]) >= 2)
        self.assertTrue(len(sa_opts["students"]) >= 2)
        self.assertIn(self.other_institute.id, {item["id"] for item in sa_opts["institutes"]})

        inst_opts = announcement_service.get_institute_target_options(self.db, self.institute.id)
        self.assertEqual(len(inst_opts["students"]), 1)
        self.assertEqual(inst_opts["students"][0]["id"], self.student.id)
