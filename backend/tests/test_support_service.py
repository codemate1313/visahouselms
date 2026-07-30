import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.models import Base
from app.models.role import SUPER_ADMIN, Role
from app.models.support_ticket import SUPPORT_STATUS_RESOLVED
from app.models.user import User
from app.schemas.support import PortalSupportTicketCreate, SupportTicketCreate, SupportTicketUpdate
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
            email="support-admin@example.com",
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

    def test_portal_user_can_create_and_list_own_tickets(self) -> None:
        created = support_service.create_portal_ticket(
            self.db,
            PortalSupportTicketCreate(
                subject="Unable to open my test",
                message="The assigned listening test does not open from my dashboard.",
                category="test_access",
            ),
            self.admin,
        )

        tickets = support_service.list_portal_tickets(self.db, self.admin)

        self.assertEqual(created.source, "portal_super_admin")
        self.assertEqual(len(tickets), 1)
        self.assertEqual(tickets[0]["subject"], "Unable to open my test")
        self.assertNotIn("admin_note", tickets[0])

    def test_portal_history_does_not_include_public_enquiries(self) -> None:
        self._create_ticket(email=self.admin.email)

        self.assertEqual(support_service.list_portal_tickets(self.db, self.admin), [])

    def test_list_tickets_filters_searches_and_returns_counts(self) -> None:
        self._create_ticket(subject="Need onboarding", name="Priya Nair")
        self._create_ticket(subject="Billing help", name="Arjun Mehta", email="arjun@example.com")

        result = support_service.list_tickets(self.db, search="Priya")

        self.assertEqual(result["total"], 1)
        self.assertEqual(result["items"][0]["subject"], "Need onboarding")
        self.assertEqual(result["counts"]["new"], 2)
        self.assertEqual(result["counts"]["all"], 2)

    def test_admin_can_segment_customer_and_portal_tickets(self) -> None:
        self._create_ticket(subject="Customer enquiry")
        support_service.create_portal_ticket(
            self.db,
            PortalSupportTicketCreate(
                subject="Portal query",
                message="I need help with a portal workflow that is currently blocked.",
                category="technical",
            ),
            self.admin,
        )

        customer = support_service.list_tickets(self.db, source_filter="customer")
        portal = support_service.list_tickets(self.db, source_filter="portal")

        self.assertEqual([item["subject"] for item in customer["items"]], ["Customer enquiry"])
        self.assertEqual([item["subject"] for item in portal["items"]], ["Portal query"])
        self.assertEqual(customer["counts"]["all"], 1)
        self.assertEqual(portal["counts"]["all"], 1)

    def test_admin_can_segment_active_and_resolved_tickets(self) -> None:
        active = self._create_ticket(subject="Active ticket")
        resolved = self._create_ticket(subject="Resolved ticket", email="resolved@example.com")
        support_service.update_ticket(
            self.db,
            resolved.id,
            SupportTicketUpdate(status=SUPPORT_STATUS_RESOLVED),
        )

        active_result = support_service.list_tickets(self.db, status_group="active")
        resolved_result = support_service.list_tickets(self.db, status_group="resolved")

        self.assertEqual([item["id"] for item in active_result["items"]], [active.id])
        self.assertEqual([item["id"] for item in resolved_result["items"]], [resolved.id])

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
