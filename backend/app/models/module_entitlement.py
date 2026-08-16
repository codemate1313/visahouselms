from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

# How an entitlement came to exist. Kept so a support question - "why can this
# student open Writing until September?" - has an answer in the row itself.
SOURCE_PLAN = "plan"          # bought a plan that contains the module
SOURCE_BACKFILL = "backfill"  # rebuilt from purchase history by migration 0084
SOURCE_MANUAL = "manual"      # granted by an admin


class ModuleEntitlement(Base):
    """How long ONE module stays open for ONE direct student.

    Access used to be derived live from "the student's current subscription",
    which meant a single plan row decided everything. Buying a second plan while
    the first was still running therefore did one of two wrong things:

      * the new plan expired later, so it became "current" and every module that
        only existed in the old plan was silently revoked - paid for, unexpired,
        gone; or
      * the new plan expired sooner, so the old one stayed "current" and the new
        plan's modules never appeared at all - the student paid and got nothing.

    Both are money problems, not display problems, so entitlement moved out of
    the subscription and into its own row per module. A subscription is now a
    record of a purchase; this table is the answer to "may they open it".

    Stacking lives here too. Buying a plan adds its duration to every module it
    contains, from that module's own current expiry rather than from today - so
    a module held under two plans gains the days of both instead of wasting the
    overlap. A module the student did not already have simply starts today.
    """

    __tablename__ = "module_entitlements"
    __table_args__ = (
        # One row per student per module: the stack is folded into `expires_at`
        # as it is granted, rather than left as rows to be summed at read time.
        # Reading entitlement happens on every attempt start; granting happens
        # on payment.
        UniqueConstraint("user_id", "module_id", name="uq_module_entitlement_user_module"),
        Index("ix_module_entitlement_user_expiry", "user_id", "expires_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Direct (B2C) students only. Institute students inherit their institute's
    # assigned modules for as long as the institute's own subscription runs, so
    # they have no per-student ledger and need none.
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    module_id: Mapped[int] = mapped_column(
        ForeignKey("exam_modules.id", ondelete="CASCADE"), nullable=False, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default=SOURCE_PLAN)
    # The purchase that most recently extended this module. Not a lifecycle
    # link - deleting the subscription must not delete paid-for access - so it
    # is nullable and carries no cascade.
    last_subscription_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True
    )
    # Running total of days ever granted, for support and for the backfill
    # report. Cheaper to keep than to reconstruct from audit logs later.
    granted_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # How many times this student may SIT this test. One per purchase that
    # included it, so buying a plan again buys another go - a student who paid
    # full price a second time and could only re-read a paper they had already
    # sat was getting days, not value. Approved Retake Requests are separate and
    # stack on top; final tests remain one-and-done regardless.
    sittings_granted: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=func.now())

    user: Mapped["User"] = relationship()  # noqa: F821
    module: Mapped["ExamModule"] = relationship()  # noqa: F821
