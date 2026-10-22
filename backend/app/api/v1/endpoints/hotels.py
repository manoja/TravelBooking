from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import DbSession
from app.schemas.catalog import (
    DestinationBrief,
    HotelDetail,
    HotelQuery,
    HotelRead,
    RoomSummary,
)
from app.schemas.common import Page
from app.services.catalog_service import HotelService

router = APIRouter(prefix="/hotels", tags=["hotels"])


@router.get("", response_model=Page[HotelRead])
def list_hotels(query: Annotated[HotelQuery, Query()], db: DbSession):
    return HotelService(db).list_items(query)


@router.get("/{hotel_id}", response_model=HotelDetail)
def get_hotel(hotel_id: int, db: DbSession):
    hotel, rooms = HotelService(db).get_detail(hotel_id)
    return HotelDetail(
        **HotelRead.model_validate(hotel).model_dump(),
        destination=DestinationBrief.model_validate(hotel.destination),
        rooms=[RoomSummary.model_validate(room) for room in rooms],
    )
