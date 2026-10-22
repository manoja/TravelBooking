from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import DbSession
from app.schemas.catalog import RoomDetail, RoomSearchParams
from app.schemas.common import Page
from app.services.catalog_service import RoomService

router = APIRouter(prefix="/rooms", tags=["rooms"])


# Declared before "/{room_id}" so "search" is not parsed as an id.
@router.get("/search", response_model=Page[RoomDetail])
def search_rooms(params: Annotated[RoomSearchParams, Query()], db: DbSession):
    return RoomService(db).search(params)


@router.get("/{room_id}", response_model=RoomDetail)
def get_room(room_id: int, db: DbSession):
    return RoomService(db).get_public(room_id)
