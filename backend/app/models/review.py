import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, SmallInteger, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, BigInt, TimestampTZ
from app.core.time import utcnow

PENDING = "pending"
PUBLISHED = "published"
REJECTED = "rejected"


class HotelReview(Base):
    __tablename__ = "hotel_reviews"

    id: Mapped[int] = mapped_column(BigInt, primary_key=True)
    hotel_id: Mapped[int] = mapped_column(BigInt, ForeignKey("hotels.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"))
    reservation_id: Mapped[int | None] = mapped_column(BigInt, ForeignKey("reservations.id", ondelete="SET NULL"))

    rating: Mapped[int] = mapped_column(SmallInteger)
    title: Mapped[str | None] = mapped_column(String(150))
    review_text: Mapped[str | None] = mapped_column(Text)

    cleanliness_rating: Mapped[int | None] = mapped_column(SmallInteger)
    service_rating: Mapped[int | None] = mapped_column(SmallInteger)
    location_rating: Mapped[int | None] = mapped_column(SmallInteger)
    value_rating: Mapped[int | None] = mapped_column(SmallInteger)

    status: Mapped[str] = mapped_column(String(20), default=PUBLISHED)

    created_at: Mapped[datetime] = mapped_column(TimestampTZ, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(TimestampTZ, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        UniqueConstraint("hotel_id", "user_id", name="uq_hotel_reviews_hotel_user"),
    )
