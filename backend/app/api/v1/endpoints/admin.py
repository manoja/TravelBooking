from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import DbSession, require_admin
from app.schemas.booking import (
    AdminReservationRead,
    AdminReservationsQuery,
    DashboardRead,
)
from app.schemas.catalog import (
    AdminRoomQuery,
    DestinationCreate,
    DestinationQuery,
    DestinationRead,
    DestinationUpdate,
    HotelCreate,
    HotelQuery,
    HotelRead,
    HotelUpdate,
    RoomCreate,
    RoomDetail,
    RoomImageCreate,
    RoomImageRead,
    RoomUpdate,
)
from app.schemas.common import Page
from app.services.catalog_service import DestinationService, HotelService, RoomService
from app.services.reservation_service import ReservationService
from app.services.saved_search_service import DashboardService

# Every route below requires the admin role, enforced server-side.
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


# ---- destinations ----
@router.get("/destinations", response_model=Page[DestinationRead])
def list_destinations(query: Annotated[DestinationQuery, Query()], db: DbSession):
    return DestinationService(db).list_items(query, visible_only=False)


@router.post("/destinations", response_model=DestinationRead, status_code=status.HTTP_201_CREATED)
def create_destination(data: DestinationCreate, db: DbSession):
    return DestinationService(db).create(data)


@router.patch("/destinations/{destination_id}", response_model=DestinationRead)
def update_destination(destination_id: int, data: DestinationUpdate, db: DbSession):
    return DestinationService(db).update(destination_id, data)


@router.delete("/destinations/{destination_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_destination(destination_id: int, db: DbSession):
    DestinationService(db).delete(destination_id)


# ---- hotels ----
@router.get("/hotels", response_model=Page[HotelRead])
def list_hotels(query: Annotated[HotelQuery, Query()], db: DbSession):
    return HotelService(db).list_items(query, public=False)


@router.post("/hotels", response_model=HotelRead, status_code=status.HTTP_201_CREATED)
def create_hotel(data: HotelCreate, db: DbSession):
    return HotelService(db).create(data)


@router.patch("/hotels/{hotel_id}", response_model=HotelRead)
def update_hotel(hotel_id: int, data: HotelUpdate, db: DbSession):
    return HotelService(db).update(hotel_id, data)


@router.delete("/hotels/{hotel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hotel(hotel_id: int, db: DbSession):
    HotelService(db).delete(hotel_id)


# ---- rooms ----
@router.get("/rooms", response_model=Page[RoomDetail])
def list_rooms(query: Annotated[AdminRoomQuery, Query()], db: DbSession):
    return RoomService(db).list_admin(query)


@router.post("/rooms", response_model=RoomDetail, status_code=status.HTTP_201_CREATED)
def create_room(data: RoomCreate, db: DbSession):
    return RoomService(db).create(data)


@router.patch("/rooms/{room_id}", response_model=RoomDetail)
def update_room(room_id: int, data: RoomUpdate, db: DbSession):
    return RoomService(db).update(room_id, data)


@router.delete("/rooms/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(room_id: int, db: DbSession):
    RoomService(db).delete(room_id)


@router.post(
    "/rooms/{room_id}/images", response_model=RoomImageRead, status_code=status.HTTP_201_CREATED
)
def add_room_image(room_id: int, data: RoomImageCreate, db: DbSession):
    return RoomService(db).add_image(room_id, data)


@router.delete("/room-images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room_image(image_id: int, db: DbSession):
    RoomService(db).delete_image(image_id)


# ---- reservations and dashboard ----
@router.get("/reservations", response_model=Page[AdminReservationRead])
def list_reservations(query: Annotated[AdminReservationsQuery, Query()], db: DbSession):
    return ReservationService(db).list_admin(query)


@router.get("/dashboard", response_model=DashboardRead)
def dashboard(db: DbSession):
    return DashboardService(db).build()
