import re

from pydantic import BaseModel
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import Conflict, NotFound
from app.models.booking import Reservation, SavedSearch
from app.models.catalog import Destination, Hotel, Room, RoomImage
from app.repositories.catalog_repository import (
    DestinationRepository,
    HotelRepository,
    RoomRepository,
)
from app.schemas.catalog import (
    DestinationCreate,
    DestinationUpdate,
    HotelCreate,
    HotelUpdate,
    RoomCreate,
    RoomImageCreate,
    RoomSearchParams,
    RoomUpdate,
)
from app.schemas.common import build_page


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:170] or "destination"


def _apply(entity, data: BaseModel) -> None:
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(entity, key, value)


def _commit(db: Session, conflict_message: str) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise Conflict(conflict_message) from exc


class DestinationService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = DestinationRepository(db)

    def list_items(self, query, visible_only=True) -> dict:
        items, total = self.repo.list_page(query.page, query.page_size, query.q, visible_only)
        return build_page(items, total, query.page, query.page_size)

    def get(self, destination_id: int, visible_only=True) -> Destination:
        destination = self.repo.get(destination_id)
        if destination is None or (visible_only and not destination.is_visible):
            raise NotFound("Destination not found")
        return destination

    def create(self, data: DestinationCreate) -> Destination:
        values = data.model_dump()
        if values["slug"]:
            if self.repo.get_by_slug(values["slug"]):
                raise Conflict("Slug is already in use")
        else:
            base = slugify(data.name)
            slug, counter = base, 1
            while self.repo.get_by_slug(slug):
                counter += 1
                slug = f"{base}-{counter}"
            values["slug"] = slug
        destination = Destination(**values)
        self.db.add(destination)
        _commit(self.db, "Slug is already in use")
        return destination

    def update(self, destination_id: int, data: DestinationUpdate) -> Destination:
        destination = self.get(destination_id, visible_only=False)
        if data.slug and data.slug != destination.slug and self.repo.get_by_slug(data.slug):
            raise Conflict("Slug is already in use")
        _apply(destination, data)
        _commit(self.db, "Slug is already in use")
        return destination

    def delete(self, destination_id: int) -> None:
        destination = self.get(destination_id, visible_only=False)
        if HotelRepository(self.db).count_for_destination(destination_id):
            raise Conflict("Destination still has hotels; delete or move them, or hide it instead")
        # Saved searches may reference the destination (nullable FK); detach rather than block.
        self.db.execute(
            update(SavedSearch)
            .where(SavedSearch.destination_id == destination_id)
            .values(destination_id=None)
        )
        self.db.delete(destination)
        _commit(self.db, "Destination is still referenced by other records")


class HotelService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = HotelRepository(db)
        self.destinations = DestinationRepository(db)

    def list_items(self, query, public=True) -> dict:
        items, total = self.repo.list_page(
            query.page, query.page_size, query.destination_id, query.q, public
        )
        return build_page(items, total, query.page, query.page_size)

    def get_detail(self, hotel_id: int) -> tuple[Hotel, list[Room]]:
        hotel = self.repo.get_public(hotel_id)
        if hotel is None:
            raise NotFound("Hotel not found")
        return hotel, self.repo.visible_rooms(hotel_id)

    def _get(self, hotel_id: int) -> Hotel:
        hotel = self.repo.get(hotel_id)
        if hotel is None:
            raise NotFound("Hotel not found")
        return hotel

    def _require_destination(self, destination_id: int) -> None:
        if self.destinations.get(destination_id) is None:
            raise NotFound("Destination not found")

    def create(self, data: HotelCreate) -> Hotel:
        self._require_destination(data.destination_id)
        hotel = Hotel(**data.model_dump())
        self.db.add(hotel)
        _commit(self.db, "Could not create hotel")
        return hotel

    def update(self, hotel_id: int, data: HotelUpdate) -> Hotel:
        hotel = self._get(hotel_id)
        if data.destination_id is not None:
            self._require_destination(data.destination_id)
        _apply(hotel, data)
        _commit(self.db, "Could not update hotel")
        return hotel

    def delete(self, hotel_id: int) -> None:
        hotel = self._get(hotel_id)
        if RoomRepository(self.db).count_for_hotel(hotel_id):
            raise Conflict("Hotel still has rooms; delete them first, or hide the hotel instead")
        self.db.delete(hotel)
        _commit(self.db, "Hotel is still referenced by other records")


class RoomService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = RoomRepository(db)

    def search(self, params: RoomSearchParams) -> dict:
        rooms, total = self.repo.search(params)
        return build_page(rooms, total, params.page, params.page_size)

    def get_public(self, room_id: int) -> Room:
        room = self.repo.get_detail(room_id)
        if room is None:
            raise NotFound("Room not found")
        return room

    def list_admin(self, query) -> dict:
        rooms, total = self.repo.list_admin(query.page, query.page_size, query.hotel_id)
        return build_page(rooms, total, query.page, query.page_size)

    def _get(self, room_id: int) -> Room:
        room = self.repo.get(room_id)
        if room is None:
            raise NotFound("Room not found")
        return room

    def create(self, data: RoomCreate) -> Room:
        if HotelRepository(self.db).get(data.hotel_id) is None:
            raise NotFound("Hotel not found")
        room = Room(**data.model_dump())
        self.db.add(room)
        _commit(self.db, "Could not create room")
        return self.repo.get_detail(room.id, public=False)

    def update(self, room_id: int, data: RoomUpdate) -> Room:
        room = self._get(room_id)
        _apply(room, data)
        _commit(self.db, "Could not update room")
        return self.repo.get_detail(room_id, public=False)

    def delete(self, room_id: int) -> None:
        room = self._get(room_id)
        has_reservations = (
            self.db.query(Reservation.id).filter(Reservation.room_id == room_id).first()
        )
        if has_reservations:
            raise Conflict("Room has reservations and cannot be deleted; set is_active=false")
        self.db.query(RoomImage).filter(RoomImage.room_id == room_id).delete()
        self.db.delete(room)
        _commit(self.db, "Room is still referenced by other records")

    def add_image(self, room_id: int, data: RoomImageCreate) -> RoomImage:
        self._get(room_id)
        image = RoomImage(room_id=room_id, **data.model_dump())
        self.db.add(image)
        _commit(self.db, "Could not add image")
        return image

    def delete_image(self, image_id: int) -> None:
        image = self.db.get(RoomImage, image_id)
        if image is None:
            raise NotFound("Room image not found")
        self.db.delete(image)
        self.db.commit()
