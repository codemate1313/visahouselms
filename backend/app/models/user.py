from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, and_, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

# Seat states. `is_active` answers "may this account log in"; these answer "does
# it still occupy one of the institute's paid seats", which is a different
# question and was the reason expiry and deletion kept colliding.
ACCESS_ACTIVE = "active"        # logs in, holds a seat
ACCESS_SUSPENDED = "suspended"  # admin turned them off, still holds a seat
ACCESS_EXPIRED = "expired"      # window closed, still holds a seat
ACCESS_RELEASED = "released"    # seat handed back; record, email and results kept

# The only states that occupy a seat. Every seat count in the codebase must be
# built from this one tuple - four hand-written copies of the rule is how the
# roster ends up reporting 84/100 while creation refuses at 100/100.
SEAT_HOLDING_STATES = (ACCESS_ACTIVE, ACCESS_SUSPENDED, ACCESS_EXPIRED)

ACCESS_STATES = SEAT_HOLDING_STATES + (ACCESS_RELEASED,)


def seat_holder_filter():
    """THE definition of an occupied seat. Every seat count must be built from
    this, and none may re-implement it.

    The rule used to be written out five times - in limits.py, in
    subscription_service.usage, and three times inside institute_admin_service -
    and they only agreed by luck. The moment one of them learned about access
    windows and the others did not, the roster would report 84/100 while
    creating a student refused at 100/100, and neither screen would be wrong
    from where it was standing.

    Expired and suspended students still hold their seats. Only an explicit
    release by the institute admin gives one back; a date passing never does,
    because if it did, editing an end date backwards and then forwards again
    would mint seats out of nothing.
    """
    return and_(
        User.deleted_at.is_(None),
        User.access_state.in_(SEAT_HOLDING_STATES),
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), nullable=False)
    institute_id: Mapped[Optional[int]] = mapped_column(ForeignKey("institutes.id"), nullable=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    force_password_reset: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # NULL until the password is changed for the first time, i.e. the account is
    # still on the password it was created with. audit_logs keeps the full trail.
    password_changed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    is_owner: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_developer_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    can_view_monetary_analytics: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    avatar_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    dob: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    phone_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    gender: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)

    # The student's own access window inside the institute's subscription, and
    # the seat state that `is_active` alone could not express. See migration
    # 0082: only ACCESS_RELEASED gives a seat back, and only a deliberate admin
    # action produces it - a date passing never does.
    access_starts_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    access_ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    access_state: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active", server_default="active", index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=func.now())

    role: Mapped["Role"] = relationship(back_populates="users")  # noqa: F821
    institute: Mapped[Optional["Institute"]] = relationship()  # noqa: F821
    instructor_profile: Mapped[Optional["InstructorProfile"]] = relationship(  # noqa: F821
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )

    @property
    def role_name(self) -> Optional[str]:
        return self.role.name if self.role else None
