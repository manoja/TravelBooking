from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.config import get_settings
from app.schemas.common import HttpUrlText, PageParams, PatchModel

Description = Annotated[str, Field(max_length=10_000)]
Price = Annotated[Decimal, Field(gt=0, lt=10_000_000, max_digits=12, decimal_places=2)]
Capacity = Annotated[int, Field(ge=1, le=20)]
AmenityList = Annotated[
    list[Annotated[str, Field(min_length=1, max_length=50)]], Field(max_length=30)
]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---- destinations ----
class DestinationRead(ORM):
    id: int
    name: str
    slug: str
    description: str | None
    image_url: str | None
    is_visible: bool
    created_at: datetime
    updated_at: datetime


class DestinationBrief(ORM):
    id: int
    name: str
    slug: str


class DestinationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1, max_length=150)]
    slug: Annotated[str | None, Field(max_length=180, pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")] = None
    description: Description | None = None
    image_url: HttpUrlText | None = None
    is_visible: bool = True


class DestinationUpdate(PatchModel):
    model_config = ConfigDict(extra="forbid")
    not_null = frozenset({"name", "slug", "is_visible"})

    name: Annotated[str, Field(min_length=1, max_length=150)] | None = None
    slug: Annotated[str, Field(max_length=180, pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")] | None = None
    description: Description | None = None
    image_url: HttpUrlText | None = None
    is_visible: bool | None = None


class DestinationQuery(PageParams):
    q: Annotated[str | None, Field(max_length=100)] = None


# ---- hotels ----
class HotelRead(ORM):
    id: int
    destination_id: int
    name: str
    address: str | None
    description: str | None
    is_visible: bool
    created_at: datetime
    updated_at: datetime


class HotelBrief(ORM):
    id: int
    name: str
    address: str | None


class HotelCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    destination_id: int
    name: Annotated[str, Field(min_length=1, max_length=200)]
    address: Annotated[str, Field(min_length=1, max_length=10_000)]
    description: Description | None = None
    is_visible: bool = True


class HotelUpdate(PatchModel):
    model_config = ConfigDict(extra="forbid")
    not_null = frozenset({"destination_id", "name", "address", "is_visible"})

    destination_id: int | None = None
    name: Annotated[str, Field(min_length=1, max_length=200)] | None = None
    address: Annotated[str, Field(min_length=1, max_length=10_000)] | None = None
    description: Description | None = None
    is_visible: bool | None = None


class HotelQuery(PageParams):
    destination_id: int | None = None
    q: Annotated[str | None, Field(max_length=100)] = None


# ---- rooms ----
class RoomImageRead(ORM):
    id: int
    image_url: str
    sort_order: int


class RoomImageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    image_url: HttpUrlText
    sort_order: Annotated[int, Field(ge=0, le=10_000)] = 0


class RoomSummary(ORM):
    id: int
    name: str
    capacity: int
    price_per_night: Decimal
    amenities: list[str]
    images: list[RoomImageRead]


class HotelDetail(HotelRead):
    destination: DestinationBrief
    rooms: list[RoomSummary]


class RoomDetail(ORM):
    id: int
    hotel_id: int
    name: str
    capacity: int
    price_per_night: Decimal
    amenities: list[str]
    is_active: bool
    images: list[RoomImageRead]
    hotel: HotelBrief
    destination: DestinationBrief
    created_at: datetime
    updated_at: datetime


class RoomCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    hotel_id: int
    name: Annotated[str, Field(min_length=1, max_length=150)]
    capacity: Capacity
    price_per_night: Price
    amenities: AmenityList = []
    is_active: bool = True


class RoomUpdate(PatchModel):
    model_config = ConfigDict(extra="forbid")
    not_null = frozenset({"name", "capacity", "price_per_night", "amenities", "is_active"})

    name: Annotated[str, Field(min_length=1, max_length=150)] | None = None
    capacity: Capacity | None = None
    price_per_night: Price | None = None
    amenities: AmenityList | None = None
    is_active: bool | None = None


class AdminRoomQuery(PageParams):
    hotel_id: int | None = None


# ---- room search ----
class SortBy(str, Enum):
    price_asc = "price_asc"
    price_desc = "price_desc"
    capacity_desc = "capacity_desc"
    name = "name"


def validate_stay(check_in: date | None, check_out: date | None) -> None:
    if (check_in is None) != (check_out is None):
        raise ValueError("check_in and check_out must be provided together")
    if check_in is None or check_out is None:
        return
    if check_in < date.today():
        raise ValueError("check_in must not be in the past")
    nights = (check_out - check_in).days
    if nights < 1:
        raise ValueError("check_out must be after check_in")
    max_nights = get_settings().max_stay_nights
    if nights > max_nights:
        raise ValueError(f"stay cannot exceed {max_nights} nights")


class RoomSearchParams(PageParams):
    destination_id: int | None = None
    check_in: date | None = None
    check_out: date | None = None
    guests: Annotated[int, Field(ge=1, le=20)] = 1
    min_price: Annotated[Decimal | None, Field(ge=0, lt=10_000_000)] = None
    max_price: Annotated[Decimal | None, Field(ge=0, lt=10_000_000)] = None
    amenities: Annotated[
        list[Annotated[str, Field(min_length=1, max_length=50)]], Field(max_length=10)
    ] = []
    sort_by: SortBy = SortBy.price_asc

    @field_validator("amenities", mode="before")
    @classmethod
    def _split_amenities(cls, value):
        if isinstance(value, str):
            value = [value]
        if isinstance(value, list):
            parts = [p.strip() for item in value if isinstance(item, str) for p in item.split(",")]
            return [p for p in parts if p]
        return value

    @model_validator(mode="after")
    def _validate(self):
        validate_stay(self.check_in, self.check_out)
        if self.min_price is not None and self.max_price is not None:
            if self.min_price > self.max_price:
                raise ValueError("min_price must not exceed max_price")
        return self
