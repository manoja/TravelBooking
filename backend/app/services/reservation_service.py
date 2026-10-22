from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import BadRequest, Conflict, NotFound
from app.core.time import as_utc, utcnow
from app.models.booking import (
    CANCELLED,
    CONFIRMED,
    EXPIRED,
    PENDING,
    Payment,
    Reservation,
)
from app.models.catalog import Room
from app.models.user import User
from app.repositories.catalog_repository import RoomRepository
from app.repositories.reservation_repository import ReservationRepository, hold_cutoff
from app.schemas.booking import ReservationCreate
from app.schemas.common import build_page
from app.utils.confirmation import new_confirmation_number

CENT = Decimal("0.01")


def calculate_total(room: Room, check_in: date, check_out: date) -> Decimal:
    """nights x current nightly rate, plus configured tax percentage and flat fee."""
    settings = get_settings()
    base = room.price_per_night * (check_out - check_in).days
    tax = base * settings.tax_rate_percent / Decimal(100)
    return (base + tax + settings.flat_fee).quantize(CENT, rounding=ROUND_HALF_UP)


class ReservationService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ReservationRepository(db)
        self.rooms = RoomRepository(db)

    def create(self, user: User, data: ReservationCreate) -> Reservation:
        # The row lock serialises concurrent bookings of the same room until commit.
        room = self.rooms.get_for_update(data.room_id)
        if (
            room is None
            or not room.is_active
            or not room.hotel.is_visible
            or not room.hotel.destination.is_visible
        ):
            raise NotFound("Room not found")
        if data.guests > room.capacity:
            raise BadRequest(f"Room capacity is {room.capacity} guests")

        self.repo.expire_stale(room.id)
        if self.repo.has_conflict(room.id, data.check_in, data.check_out):
            raise Conflict("Room is not available for the selected dates")

        number = new_confirmation_number()
        while self.repo.confirmation_exists(number):
            number = new_confirmation_number()
        reservation = Reservation(
            confirmation_number=number,
            user_id=user.id,
            room_id=room.id,
            check_in=data.check_in,
            check_out=data.check_out,
            guests=data.guests,
            total_amount=calculate_total(room, data.check_in, data.check_out),
            status=PENDING,
        )
        self.db.add(reservation)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise Conflict("Could not create reservation; please retry") from exc
        return self.repo.get(reservation.id)

    def list_mine(self, user: User, query) -> dict:
        return self._list(query, user_id=user.id)

    def list_admin(self, query) -> dict:
        return self._list(query, check_in_from=query.check_in_from, check_in_to=query.check_in_to)

    def _list(self, query, **filters) -> dict:
        self.repo.expire_stale()
        self.db.commit()
        rows, total = self.repo.list_page(
            query.page, query.page_size, status=query.status, **filters
        )
        return build_page(rows, total, query.page, query.page_size)

    def get_accessible(self, user: User, reservation_id: int, for_update=False) -> Reservation:
        """Owner or admin only; others get 404 so reservation ids cannot be probed."""
        reservation = self.repo.get(reservation_id, for_update=for_update)
        if reservation is None or (user.role != "admin" and reservation.user_id != user.id):
            raise NotFound("Reservation not found")
        if reservation.status == PENDING and as_utc(reservation.created_at) <= hold_cutoff():
            reservation.status = EXPIRED
            self.db.commit()
        return reservation

    def get(self, user: User, reservation_id: int) -> Reservation:
        return self.get_accessible(user, reservation_id)

    def cancel(self, user: User, reservation_id: int) -> Reservation:
        """Policy: pending/confirmed bookings can be cancelled. Owners must cancel at least
        CANCELLATION_CUTOFF_DAYS before check-in; admins are exempt. Paid bookings are refunded."""
        reservation = self.get_accessible(user, reservation_id, for_update=True)
        if reservation.status not in (PENDING, CONFIRMED):
            raise Conflict(f"Reservation is already {reservation.status}")
        cutoff_days = get_settings().cancellation_cutoff_days
        if (
            user.role != "admin"
            and reservation.status == CONFIRMED
            and reservation.check_in - date.today() < timedelta(days=cutoff_days)
        ):
            raise Conflict(
                f"Confirmed reservations must be cancelled at least {cutoff_days} day(s) "
                "before check-in"
            )
        if reservation.status == CONFIRMED:
            self.db.execute(
                update(Payment)
                .where(Payment.reservation_id == reservation.id, Payment.status == "succeeded")
                .values(status="refunded", updated_at=utcnow())
            )
        reservation.status = CANCELLED
        self.db.commit()
        return self.repo.get(reservation_id)
