import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.models import Base
from app.models.institute import Institute
from app.models.role import INSTITUTE_ADMIN, INST_INSTRUCTOR, STUDENT, SUPER_ADMIN, Role
from app.models.support_ticket import (
    SUPPORT_QUEUE_INSTITUTE,
    SUPPORT_QUEUE_SUPER_ADMIN,
    SUPPORT_STATUS_CLOSED,
    SUPPORT_STATUS_OPEN,
    SUPPORT_STATUS_RESOLVED,
)
from app.models.user import User
from app.schemas.support import PortalSupportTicketCreate, SupportTicketCreate, SupportTicketUpdate
from app.services import support_service


class SupportServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()

        roles = {
            name: Role(name=name)
            for name in (SUPER_ADMIN, INSTITUTE_ADMIN, INST_INSTRUCTOR, STUDENT)
        }
        self.db.add_all(roles.values())
        self.db.flush()
        self.institute = Institute(name="Meridian Institute", slug="meridian")
        self.other_institute = Institute(name="Other Institute", slug="other")
        self.db.add_all([self.institute, self.other_institute])
        self.db.flush()
        self.admin = User(
            email="support-admin@example.com",
            password_hash=hash_password("AdminPassword!1"),
            role_id=roles[SUPER_ADMIN].id,
            first_name="Support",
            last_name="Admin",
            is_active=True,
        )
        self.institute_admin = User(
            email="institute-admin@example.com",
            password_hash=hash_password("AdminPassword!1"),
            role_id=roles[INSTITUTE_ADMIN].id,
            institute_id=self.institute.id,
            first_name="Institute",
            last_name="Admin",
            is_active=True,
        )
        self.student = User(
            email="student@example.com",
            password_hash=hash_password("StudentPassword!1"),
            role_id=roles[STUDENT].id,
            institute_id=self.institute.id,
            first_name="Portal",
            last_name="Student",
            is_active=True,
        )
        self.other_instructor = User(
            email="instructor@example.com",
            password_hash=hash_password("InstructorPassword!1"),
            role_id=roles[INST_INSTRUCTOR].id,
            institute_id=self.other_institute.id,
            first_name="Other",
            last_name="Instructor",
            is_active=True,
        )
        self.db.add_all([self.admin, self.institute_admin, self.student, self.other_instructor])
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

    def test_portal_user_can_create_and_list_own_tickets_with_support_response(self) -> None:
        created = support_service.create_portal_ticket(
            self.db,
            PortalSupportTicketCreate(
                subject="Unable to open my test",
                message="The assigned listening test does not open from my dashboard.",
                category="test_access",
            ),
            self.admin,
        )
        support_service.update_ticket(
            self.db,
            created.id,
            SupportTicketUpdate(status=SUPPORT_STATUS_RESOLVED, admin_note="Please refresh and try again."),
        )

        tickets = support_service.list_portal_tickets(self.db, self.admin)

        self.assertEqual(created.source, "portal_super_admin")
        self.assertEqual(len(tickets), 1)
        self.assertEqual(tickets[0]["subject"], "Unable to open my test")
        self.assertEqual(tickets[0]["status"], SUPPORT_STATUS_RESOLVED)
        self.assertEqual(tickets[0]["admin_note"], "Please refresh and try again.")

    def test_portal_history_does_not_include_public_enquiries(self) -> None:
        self._create_ticket(email=self.admin.email)

        self.assertEqual(support_service.list_portal_tickets(self.db, self.admin), [])

    def test_student_ticket_is_routed_to_its_institute(self) -> None:
        ticket = self._create_portal_ticket(self.student)

        self.assertEqual(ticket.queue, SUPPORT_QUEUE_INSTITUTE)
        self.assertEqual(ticket.requester_id, self.student.id)
        self.assertEqual(ticket.institute_id, self.institute.id)
        institute_result = support_service.list_tickets(
            self.db,
            queue=SUPPORT_QUEUE_INSTITUTE,
            institute_id=self.institute.id,
        )
        super_admin_result = support_service.list_tickets(self.db)

        self.assertEqual([item["id"] for item in institute_result["items"]], [ticket.id])
        self.assertEqual(super_admin_result["items"], [])

    def test_institute_queue_is_tenant_scoped(self) -> None:
        own_ticket = self._create_portal_ticket(self.student)
        other_ticket = self._create_portal_ticket(self.other_instructor)

        result = support_service.list_tickets(
            self.db,
            queue=SUPPORT_QUEUE_INSTITUTE,
            institute_id=self.institute.id,
        )

        self.assertEqual([item["id"] for item in result["items"]], [own_ticket.id])
        with self.assertRaises(HTTPException) as context:
            support_service.get_ticket(
                self.db,
                other_ticket.id,
                queue=SUPPORT_QUEUE_INSTITUTE,
                institute_id=self.institute.id,
            )
        self.assertEqual(context.exception.status_code, 404)

    def test_institute_admin_can_forward_ticket_to_super_admin(self) -> None:
        ticket = self._create_portal_ticket(self.student)

        forwarded = support_service.forward_ticket_to_super_admin(
            self.db,
            ticket.id,
            self.institute_admin,
        )

        self.assertEqual(forwarded.queue, SUPPORT_QUEUE_SUPER_ADMIN)
        self.assertEqual(forwarded.status, "open")
        self.assertEqual(forwarded.escalated_by_id, self.institute_admin.id)
        self.assertIsNotNone(forwarded.escalated_at)
        result = support_service.list_tickets(self.db)
        self.assertEqual([item["id"] for item in result["items"]], [ticket.id])

    def test_portal_requester_cannot_reopen_support_closed_ticket(self) -> None:
        ticket = self._create_portal_ticket(self.student)
        support_service.close_ticket(
            self.db,
            ticket.id,
            queue=SUPPORT_QUEUE_INSTITUTE,
            institute_id=self.institute.id,
        )

        with self.assertRaises(HTTPException) as context:
            support_service.reopen_portal_ticket(self.db, ticket.id, self.student)

        self.assertEqual(context.exception.status_code, 403)
        self.db.refresh(ticket)
        self.assertEqual(ticket.status, SUPPORT_STATUS_CLOSED)

    def test_portal_requester_reply_does_not_reopen_support_closed_ticket(self) -> None:
        ticket = self._create_portal_ticket(self.student)
        support_service.close_ticket(
            self.db,
            ticket.id,
            queue=SUPPORT_QUEUE_INSTITUTE,
            institute_id=self.institute.id,
        )

        with self.assertRaises(HTTPException) as context:
            support_service.add_ticket_message(
                self.db,
                ticket.id,
                "I still need help with this ticket.",
                sender=self.student,
                sender_role="customer",
            )

        self.assertEqual(context.exception.status_code, 403)
        self.db.refresh(ticket)
        self.assertEqual(ticket.status, SUPPORT_STATUS_CLOSED)

    def test_institute_admin_request_to_super_admin_cannot_be_reopened_by_requester(self) -> None:
        ticket = self._create_portal_ticket(self.institute_admin)
        support_service.close_ticket(self.db, ticket.id, queue=SUPPORT_QUEUE_SUPER_ADMIN)

        with self.assertRaises(HTTPException) as context:
            support_service.reopen_portal_ticket(self.db, ticket.id, self.institute_admin)

        self.assertEqual(context.exception.status_code, 403)
        self.db.refresh(ticket)
        self.assertEqual(ticket.status, SUPPORT_STATUS_CLOSED)

    def test_higher_official_can_reopen_ticket_from_owned_queue(self) -> None:
        ticket = self._create_portal_ticket(self.student)
        support_service.close_ticket(
            self.db,
            ticket.id,
            queue=SUPPORT_QUEUE_INSTITUTE,
            institute_id=self.institute.id,
        )

        reopened = support_service.reopen_ticket(
            self.db,
            ticket.id,
            queue=SUPPORT_QUEUE_INSTITUTE,
            institute_id=self.institute.id,
        )

        self.assertEqual(reopened.status, SUPPORT_STATUS_OPEN)
        self.assertIsNone(reopened.closed_by_role)

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
                message="We need a complete Language CERT demo for our institute batches.",
                category="demo",
            ),
            ip_address="127.0.0.1",
            user_agent="unittest",
        )

    def _create_portal_ticket(self, user: User):
        return support_service.create_portal_ticket(
            self.db,
            PortalSupportTicketCreate(
                subject="Portal support request",
                message="I need help with an institute portal workflow.",
                category="technical",
            ),
            user,
        )


if __name__ == "__main__":
    unittest.main()
