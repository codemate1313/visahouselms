import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.models import Base
from app.models.role import SUPER_ADMIN, Role
from app.models.support_ticket import SUPPORT_STATUS_RESOLVED
from app.models.user import User
from app.schemas.support import SupportTicketCreate, SupportTicketUpdate
from app.services import support_service


class SupportServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        role = Role(name=SUPER_ADMIN)
        self.db.add(role)
        self.db.flush()
        self.admin = User(
            email="support-admin@test.local",
            password_hash=hash_password("AdminPassword!1"),
            role_id=role.id,
            first_name="Support",
            last_name="Admin",
            is_active=True,
        )
        self.db.add(self.admin)
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_public_contact_enquiry_creates_ticket(self) -> None:
        ticket = self._create_ticket()

        self.assertEqual(ticket.status, "new")
        self.assertEqual(ticket.priority, "normal")
        self.assertEqual(ticket.email, "partner@example.com")
        self.assertEqual(ticket.institute_name, "Meridian Institute")

    def test_list_tickets_filters_searches_and_returns_counts(self) -> None:
        self._create_ticket(subject="Need onboarding", name="Priya Nair")
        self._create_ticket(subject="Billing help", name="Arjun Mehta", email="arjun@example.com")

        result = support_service.list_tickets(self.db, search="Priya")

        self.assertEqual(result["total"], 1)
        self.assertEqual(result["items"][0]["subject"], "Need onboarding")
        self.assertEqual(result["counts"]["new"], 2)
        self.assertEqual(result["counts"]["all"], 2)

    def test_update_ticket_tracks_resolution_and_assignment(self) -> None:
        ticket = self._create_ticket()

        updated = support_service.update_ticket(
            self.db,
            ticket.id,
            SupportTicketUpdate(
                status=SUPPORT_STATUS_RESOLVED,
                priority="high",
                admin_note="Demo booked for Friday.",
                assigned_to_id=self.admin.id,
            ),
        )

        self.assertEqual(updated.status, SUPPORT_STATUS_RESOLVED)
        self.assertEqual(updated.priority, "high")
        self.assertEqual(updated.admin_note, "Demo booked for Friday.")
        self.assertEqual(updated.assigned_to_id, self.admin.id)
        self.assertIsNotNone(updated.resolved_at)

    def test_invalid_status_is_rejected(self) -> None:
        ticket = self._create_ticket()

        with self.assertRaises(HTTPException) as context:
            support_service.update_ticket(self.db, ticket.id, SupportTicketUpdate(status="waiting"))

        self.assertEqual(context.exception.status_code, 400)

    def _create_ticket(
        self,
        *,
        subject: str = "Partner demo request",
        name: str = "Priya Nair",
        email: str = "partner@example.com",
    ):
        return support_service.create_ticket(
            self.db,
            SupportTicketCreate(
                name=name,
                email=email,
                phone_number="+91 99999 00000",
                institute_name="Meridian Institute",
                subject=subject,
                message="We need a complete IELTS LMS demo for our institute batches.",
                category="demo",
            ),
            ip_address="127.0.0.1",
            user_agent="unittest",
        )


if __name__ == "__main__":
    unittest.main()
