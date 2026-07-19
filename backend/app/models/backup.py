from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Backup(Base):
    __tablename__ = "backups"

    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger)
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")  # manual | scheduled
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="done")  # done | failed
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
