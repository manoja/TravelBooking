import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, SmallInteger, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import get_settings
from app.core.time import as_utc, utcnow
from app.db.base import Base, BigInt, JsonB, TimestampTZ
from app.models.catalog import Room

PENDING = "pending"
CONFIRMED = "confirmed"
CANCELLED = "cancelled"
EXPIRED = "expired"


class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[int] = mapped_column(BigInt, primary_key=True)
    confirmation_number: Mapped[str] = mapped_column(String(30), unique=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"))
    room_id: Mapped[int] = mapped_column(BigInt, ForeignKey("rooms.id"))
    check_in: Mapped[date]
    check_out: Mapped[date]
    guests: Mapped[int] = mapped_column(SmallInteger)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    status: Mapped[str] = mapped_column(String(20), default=PENDING)
    created_at: Mapped[datetime] = mapped_column(TimestampTZ, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TimestampTZ, default=utcnow, onupdate=utcnow)

    room: Mapped[Room] = relationship()

    @property
    def nights(self) -> int:
        return (self.check_out - self.check_in).days

    @property
    def expires_at(self) -> datetime | None:
        if self.status != PENDING:
            return None
        return as_utc(self.created_at) + timedelta(minutes=get_settings().pending_hold_minutes)


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(BigInt, primary_key=True)
    reservation_id: Mapped[int] = mapped_column(BigInt, ForeignKey("reservations.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    status: Mapped[str] = mapped_column(String(20))
    transaction_reference: Mapped[str] = mapped_column(String(100), unique=True)
    created_at: Mapped[datetime] = mapped_column(TimestampTZ, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TimestampTZ, default=utcnow, onupdate=utcnow)


class SavedSearch(Base):
    __tablename__ = "saved_searches"

    id: Mapped[int] = mapped_column(BigInt, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"))
    destination_id: Mapped[int | None] = mapped_column(BigInt, ForeignKey("destinations.id"))
    check_in: Mapped[date | None]
    check_out: Mapped[date | None]
    guests: Mapped[int] = mapped_column(SmallInteger, default=1)
    filters: Mapped[dict] = mapped_column(JsonB, default=dict)
    created_at: Mapped[datetime] = mapped_column(TimestampTZ, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TimestampTZ, default=utcnow, onupdate=utcnow)
