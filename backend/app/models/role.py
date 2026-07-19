from typing import List

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

SUPER_ADMIN = "SUPER_ADMIN"
SA_INSTRUCTOR = "SA_INSTRUCTOR"
INSTITUTE_ADMIN = "INSTITUTE_ADMIN"
INST_INSTRUCTOR = "INST_INSTRUCTOR"
STUDENT = "STUDENT"

ALL_ROLES = [SUPER_ADMIN, SA_INSTRUCTOR, INSTITUTE_ADMIN, INST_INSTRUCTOR, STUDENT]


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    users: Mapped[List["User"]] = relationship(back_populates="role")  # noqa: F821
