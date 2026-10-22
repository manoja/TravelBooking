from sqlalchemy import String, cast, func, not_, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session, contains_eager, joinedload, selectinload

from app.models.booking import Reservation
from app.models.catalog import Destination, Hotel, Room
from app.repositories.reservation_repository import blocking_condition
from app.schemas.catalog import RoomSearchParams, SortBy


def like_pattern(term: str) -> str:
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _paginate(db: Session, stmt, page: int, page_size: int, *options):
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = (
        db.scalars(stmt.options(*options).limit(page_size).offset((page - 1) * page_size))
        .unique()
        .all()
    )
    return list(rows), total


class DestinationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, destination_id: int) -> Destination | None:
        return self.db.get(Destination, destination_id)

    def get_by_slug(self, slug: str) -> Destination | None:
        return self.db.scalar(select(Destination).where(Destination.slug == slug))

    def list_page(self, page, page_size, q=None, visible_only=True):
        stmt = select(Destination)
        if visible_only:
            stmt = stmt.where(Destination.is_visible.is_(True))
        if q:
            stmt = stmt.where(Destination.name.ilike(like_pattern(q), escape="\\"))
        stmt = stmt.order_by(Destination.name, Destination.id)
        return _paginate(self.db, stmt, page, page_size)


class HotelRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, hotel_id: int) -> Hotel | None:
        return self.db.get(Hotel, hotel_id)

    def get_public(self, hotel_id: int) -> Hotel | None:
        stmt = (
            select(Hotel)
            .join(Destination)
            .options(contains_eager(Hotel.destination))
            .where(
                Hotel.id == hotel_id,
                Hotel.is_visible.is_(True),
                Destination.is_visible.is_(True),
            )
        )
        return self.db.scalar(stmt)

    def visible_rooms(self, hotel_id: int) -> list[Room]:
        stmt = (
            select(Room)
            .options(selectinload(Room.images))
            .where(Room.hotel_id == hotel_id, Room.is_active.is_(True))
            .order_by(Room.price_per_night, Room.id)
        )
        return list(self.db.scalars(stmt))

    def list_page(self, page, page_size, destination_id=None, q=None, public=True):
        stmt = select(Hotel)
        if public:
            stmt = stmt.join(Destination).where(
                Hotel.is_visible.is_(True), Destination.is_visible.is_(True)
            )
        if destination_id is not None:
            stmt = stmt.where(Hotel.destination_id == destination_id)
        if q:
            pattern = like_pattern(q)
            stmt = stmt.where(
                Hotel.name.ilike(pattern, escape="\\") | Hotel.address.ilike(pattern, escape="\\")
            )
        stmt = stmt.order_by(Hotel.name, Hotel.id)
        return _paginate(self.db, stmt, page, page_size)

    def count_for_destination(self, destination_id: int) -> int:
        stmt = select(func.count()).select_from(Hotel).where(Hotel.destination_id == destination_id)
        return self.db.scalar(stmt) or 0


class RoomRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, room_id: int) -> Room | None:
        return self.db.get(Room, room_id)

    def get_for_update(self, room_id: int) -> Room | None:
        return self.db.scalar(select(Room).where(Room.id == room_id).with_for_update())

    def get_detail(self, room_id: int, public: bool = True) -> Room | None:
        stmt = (
            select(Room)
            .join(Hotel, Hotel.id == Room.hotel_id)
            .join(Destination, Destination.id == Hotel.destination_id)
            .options(
                contains_eager(Room.hotel).contains_eager(Hotel.destination),
                selectinload(Room.images),
            )
            .where(Room.id == room_id)
        )
        if public:
            stmt = stmt.where(
                Room.is_active.is_(True),
                Hotel.is_visible.is_(True),
                Destination.is_visible.is_(True),
            )
        return self.db.scalars(stmt).unique().first()

    def list_admin(self, page, page_size, hotel_id=None):
        stmt = select(Room)
        if hotel_id is not None:
            stmt = stmt.where(Room.hotel_id == hotel_id)
        stmt = stmt.order_by(Room.hotel_id, Room.name, Room.id)
        return _paginate(
            self.db,
            stmt,
            page,
            page_size,
            joinedload(Room.hotel).joinedload(Hotel.destination),
            selectinload(Room.images),
        )

    def search(self, params: RoomSearchParams):
        stmt = (
            select(Room)
            .join(Hotel, Hotel.id == Room.hotel_id)
            .join(Destination, Destination.id == Hotel.destination_id)
            .where(
                Room.is_active.is_(True),
                Hotel.is_visible.is_(True),
                Destination.is_visible.is_(True),
                Room.capacity >= params.guests,
            )
        )
        if params.destination_id is not None:
            stmt = stmt.where(Hotel.destination_id == params.destination_id)
        if params.min_price is not None:
            stmt = stmt.where(Room.price_per_night >= params.min_price)
        if params.max_price is not None:
            stmt = stmt.where(Room.price_per_night <= params.max_price)
        if params.check_in and params.check_out:
            conflict = (
                select(Reservation.id)
                .where(
                    Reservation.room_id == Room.id,
                    blocking_condition(params.check_in, params.check_out),
                )
                .exists()
            )
            stmt = stmt.where(not_(conflict))
        for amenity in params.amenities:
            stmt = stmt.where(self._has_amenity(amenity))

        order = {
            SortBy.price_asc: [Room.price_per_night.asc()],
            SortBy.price_desc: [Room.price_per_night.desc()],
            SortBy.capacity_desc: [Room.capacity.desc(), Room.price_per_night.asc()],
            SortBy.name: [Room.name.asc()],
        }[params.sort_by]
        stmt = stmt.order_by(*order, Room.id)
        return _paginate(
            self.db,
            stmt,
            params.page,
            params.page_size,
            contains_eager(Room.hotel).contains_eager(Hotel.destination),
            selectinload(Room.images),
        )

    def _has_amenity(self, amenity: str):
        if self.db.get_bind().dialect.name == "postgresql":
            return cast(Room.amenities, JSONB).contains([amenity])
        encoded = '"' + amenity.replace("\\", "\\\\").replace('"', '\\"') + '"'
        return cast(Room.amenities, String).like(like_pattern(encoded), escape="\\")

    def count_for_hotel(self, hotel_id: int) -> int:
        stmt = select(func.count()).select_from(Room).where(Room.hotel_id == hotel_id)
        return self.db.scalar(stmt) or 0
