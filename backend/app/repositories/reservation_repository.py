from datetime import date, datetime, timedelta

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.core.time import utcnow
from app.models.booking import CONFIRMED, EXPIRED, PENDING, Payment, Reservation
from app.models.catalog import Room


def hold_cutoff() -> datetime:
    return utcnow() - timedelta(minutes=get_settings().pending_hold_minutes)


def blocking_condition(check_in: date, check_out: date):
    """Confirmed bookings, and pending ones still inside the hold window, block the dates."""
    return and_(
        Reservation.check_in < check_out,
        Reservation.check_out > check_in,
        or_(
            Reservation.status == CONFIRMED,
            and_(Reservation.status == PENDING, Reservation.created_at > hold_cutoff()),
        ),
    )


class ReservationRepository:
    def __init__(self, db: Session):
        self.db = db

    def expire_stale(self, room_id: int | None = None) -> int:
        stmt = (
            update(Reservation)
            .where(Reservation.status == PENDING, Reservation.created_at <= hold_cutoff())
            .values(status=EXPIRED, updated_at=utcnow())
        )
        if room_id is not None:
            stmt = stmt.where(Reservation.room_id == room_id)
        return self.db.execute(stmt).rowcount or 0

    def has_conflict(self, room_id: int, check_in: date, check_out: date) -> bool:
        stmt = (
            select(Reservation.id)
            .where(Reservation.room_id == room_id, blocking_condition(check_in, check_out))
            .limit(1)
        )
        return self.db.scalar(stmt) is not None

    def get(self, reservation_id: int, for_update: bool = False) -> Reservation | None:
        stmt = (
            select(Reservation)
            .options(joinedload(Reservation.room).joinedload(Room.hotel))
            .where(Reservation.id == reservation_id)
        )
        if for_update:
            stmt = stmt.with_for_update(of=Reservation)
        return self.db.scalars(stmt).unique().first()

    def confirmation_exists(self, number: str) -> bool:
        stmt = select(Reservation.id).where(Reservation.confirmation_number == number)
        return self.db.scalar(stmt) is not None

    def list_page(
        self,
        page: int,
        page_size: int,
        user_id=None,
        status=None,
        check_in_from=None,
        check_in_to=None,
    ):
        stmt = select(Reservation)
        if user_id is not None:
            stmt = stmt.where(Reservation.user_id == user_id)
        if status:
            stmt = stmt.where(Reservation.status == status)
        if check_in_from:
            stmt = stmt.where(Reservation.check_in >= check_in_from)
        if check_in_to:
            stmt = stmt.where(Reservation.check_in <= check_in_to)
        total = self.db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        rows = (
            self.db.scalars(
                stmt.options(joinedload(Reservation.room).joinedload(Room.hotel))
                .order_by(Reservation.created_at.desc(), Reservation.id.desc())
                .limit(page_size)
                .offset((page - 1) * page_size)
            )
            .unique()
            .all()
        )
        return list(rows), total

    def payments_for(self, reservation_id: int) -> list[Payment]:
        stmt = (
            select(Payment)
            .where(Payment.reservation_id == reservation_id)
            .order_by(Payment.created_at.desc(), Payment.id.desc())
        )
        return list(self.db.scalars(stmt))
