from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.booking import MyReservationsQuery, ReservationCreate, ReservationRead
from app.schemas.common import Page
from app.services.reservation_service import ReservationService

router = APIRouter(prefix="/reservations", tags=["reservations"])


@router.post("", response_model=ReservationRead, status_code=status.HTTP_201_CREATED)
def create_reservation(data: ReservationCreate, user: CurrentUser, db: DbSession):
    return ReservationService(db).create(user, data)


@router.get("/me", response_model=Page[ReservationRead])
def my_reservations(
    query: Annotated[MyReservationsQuery, Query()], user: CurrentUser, db: DbSession
):
    return ReservationService(db).list_mine(user, query)


@router.get("/{reservation_id}", response_model=ReservationRead)
def get_reservation(reservation_id: int, user: CurrentUser, db: DbSession):
    return ReservationService(db).get(user, reservation_id)


@router.post("/{reservation_id}/cancel", response_model=ReservationRead)
def cancel_reservation(reservation_id: int, user: CurrentUser, db: DbSession):
    return ReservationService(db).cancel(user, reservation_id)
