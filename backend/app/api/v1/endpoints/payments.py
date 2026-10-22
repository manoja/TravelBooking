from typing import Annotated

from fastapi import APIRouter, Header, Response, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.booking import DummyPaymentCreate, PaymentRead
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/payments", tags=["payments (development-only dummy)"])

IdempotencyKey = Annotated[
    str | None,
    Header(
        alias="Idempotency-Key",
        pattern=r"^[A-Za-z0-9_-]{8,64}$",
        description="Repeating a request with the same key returns the original payment.",
    ),
]


@router.post("/dummy", response_model=PaymentRead, status_code=status.HTTP_201_CREATED)
def dummy_payment(
    data: DummyPaymentCreate,
    user: CurrentUser,
    db: DbSession,
    response: Response,
    idempotency_key: IdempotencyKey = None,
):
    """DEVELOPMENT ONLY: simulates a payment outcome. Not a real payment gateway."""
    payment, reservation, replayed = PaymentService(db).pay(user, data, idempotency_key)
    if replayed:
        response.status_code = status.HTTP_200_OK
    return PaymentRead.model_validate(payment).model_copy(
        update={"reservation_status": reservation.status}
    )


@router.get("/reservation/{reservation_id}", response_model=list[PaymentRead])
def reservation_payments(reservation_id: int, user: CurrentUser, db: DbSession):
    return PaymentService(db).list_for_reservation(user, reservation_id)
