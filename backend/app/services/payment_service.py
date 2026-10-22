import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import Conflict, NotFound
from app.core.time import as_utc
from app.models.booking import CONFIRMED, EXPIRED, PENDING, Payment, Reservation
from app.models.user import User
from app.repositories.reservation_repository import ReservationRepository, hold_cutoff
from app.schemas.booking import DummyPaymentCreate
from app.services.reservation_service import ReservationService


class PaymentService:
    """DEVELOPMENT-ONLY dummy payments. No card data is collected and no real gateway is used."""

    def __init__(self, db: Session):
        self.db = db
        self.reservations = ReservationRepository(db)

    def _ensure_enabled(self) -> None:
        if not get_settings().dummy_payments_enabled:
            raise NotFound("Not found")

    def pay(
        self, user: User, data: DummyPaymentCreate, idempotency_key: str | None
    ) -> tuple[Payment, Reservation, bool]:
        """Returns (payment, reservation, replayed)."""
        self._ensure_enabled()
        # Lock the reservation so concurrent payment attempts are processed one at a time.
        reservation = self.reservations.get(data.reservation_id, for_update=True)
        if reservation is None or reservation.user_id != user.id:
            raise NotFound("Reservation not found")

        reference = f"dummy_{reservation.id}_{idempotency_key or uuid.uuid4().hex}"
        if idempotency_key:
            existing = self.db.scalar(
                select(Payment).where(Payment.transaction_reference == reference)
            )
            if existing is not None:
                return existing, reservation, True

        if reservation.status == PENDING and as_utc(reservation.created_at) <= hold_cutoff():
            reservation.status = EXPIRED
            self.db.commit()
        if reservation.status == CONFIRMED:
            raise Conflict("Reservation is already paid")
        if reservation.status != PENDING:
            raise Conflict(f"Reservation is {reservation.status}; payment is not allowed")

        succeeded = data.outcome == "success"
        payment = Payment(
            reservation_id=reservation.id,
            amount=reservation.total_amount,
            status="succeeded" if succeeded else "failed",
            transaction_reference=reference,
        )
        self.db.add(payment)
        if succeeded:
            reservation.status = CONFIRMED
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise Conflict("Duplicate payment request") from exc
        return payment, reservation, False

    def list_for_reservation(self, user: User, reservation_id: int) -> list[Payment]:
        ReservationService(self.db).get_accessible(user, reservation_id)
        return self.reservations.payments_for(reservation_id)
