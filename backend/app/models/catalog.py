from datetime import datetime
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.time import utcnow
from app.db.base import Base, BigInt, JsonB, TimestampTZ


class Destination(Base):
    __tablename__ = "destinations"

    id: Mapped[int] = mapped_column(BigInt, primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    slug: Mapped[str] = mapped_column(String(180), unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(Text)
    is_visible: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(TimestampTZ, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TimestampTZ, default=utcnow, onupdate=utcnow)


class Hotel(Base):
    __tablename__ = "hotels"

    id: Mapped[int] = mapped_column(BigInt, primary_key=True)
    destination_id: Mapped[int] = mapped_column(BigInt, ForeignKey("destinations.id"))
    name: Mapped[str] = mapped_column(String(200))
    address: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    is_visible: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(TimestampTZ, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TimestampTZ, default=utcnow, onupdate=utcnow)

    destination: Mapped[Destination] = relationship()


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(BigInt, primary_key=True)
    hotel_id: Mapped[int] = mapped_column(BigInt, ForeignKey("hotels.id"))
    name: Mapped[str] = mapped_column(String(150))
    capacity: Mapped[int] = mapped_column(SmallInteger)
    price_per_night: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    amenities: Mapped[list] = mapped_column(JsonB, default=list)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(TimestampTZ, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TimestampTZ, default=utcnow, onupdate=utcnow)

    hotel: Mapped[Hotel] = relationship()
    images: Mapped[list["RoomImage"]] = relationship(
        order_by="(RoomImage.sort_order, RoomImage.id)", viewonly=True
    )

    @property
    def destination(self) -> Destination:
        return self.hotel.destination

    @property
    def hotel_name(self) -> str:
        return self.hotel.name

    @property
    def destination_name(self) -> str:
        return self.hotel.destination.name


class RoomImage(Base):
    __tablename__ = "room_images"

    id: Mapped[int] = mapped_column(BigInt, primary_key=True)
    room_id: Mapped[int] = mapped_column(BigInt, ForeignKey("rooms.id"))
    image_url: Mapped[str] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(TimestampTZ, default=utcnow)
