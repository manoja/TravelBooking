import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.catalog import SortBy, validate_stay
from app.schemas.common import PageParams


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserRead(ORM):
    id: uuid.UUID
    email: str
    name: str | None
    role: str


# ---- reservations ----
class ReservationCreate(BaseModel):
    """Only the room, dates and guests are accepted; user and price are derived server-side."""

    model_config = ConfigDict(extra="forbid")

    room_id: int
    check_in: date
    check_out: date
    guests: Annotated[int, Field(ge=1, le=20)]

    @model_validator(mode="after")
    def _validate_dates(self):
        validate_stay(self.check_in, self.check_out)
        return self


class ReservationRoom(ORM):
    id: int
    name: str
    hotel_id: int
    hotel_name: str
    destination_name: str


class ReservationRead(ORM):
    id: int
    confirmation_number: str
    room_id: int
    room: ReservationRoom
    check_in: date
    check_out: date
    nights: int
    guests: int
    total_amount: Decimal
    status: str
    expires_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AdminReservationRead(ReservationRead):
    user_id: uuid.UUID


ReservationStatus = Literal["pending", "confirmed", "cancelled", "expired"]


class MyReservationsQuery(PageParams):
    status: ReservationStatus | None = None


class AdminReservationsQuery(MyReservationsQuery):
    check_in_from: date | None = None
    check_in_to: date | None = None

    @model_validator(mode="after")
    def _range(self):
        if self.check_in_from and self.check_in_to and self.check_in_from > self.check_in_to:
            raise ValueError("check_in_from must not be after check_in_to")
        return self


# ---- payments (development-only dummy gateway) ----
class DummyPaymentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reservation_id: int
    outcome: Literal["success", "failure"]


class PaymentRead(ORM):
    id: int
    reservation_id: int
    amount: Decimal
    status: str
    transaction_reference: str
    created_at: datetime
    reservation_status: str | None = None
    notice: str = "Development-only dummy payment; no real charge was made."


# ---- saved searches ----
class SavedSearchFilters(BaseModel):
    model_config = ConfigDict(extra="forbid")

    min_price: Annotated[Decimal | None, Field(ge=0, lt=10_000_000)] = None
    max_price: Annotated[Decimal | None, Field(ge=0, lt=10_000_000)] = None
    amenities: Annotated[
        list[Annotated[str, Field(min_length=1, max_length=50)]], Field(max_length=10)
    ] = []
    sort_by: SortBy = SortBy.price_asc

    @model_validator(mode="after")
    def _prices(self):
        if self.min_price is not None and self.max_price is not None:
            if self.min_price > self.max_price:
                raise ValueError("min_price must not exceed max_price")
        return self


class SavedSearchCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    destination_id: int | None = None
    check_in: date | None = None
    check_out: date | None = None
    guests: Annotated[int, Field(ge=1, le=20)] = 1
    filters: SavedSearchFilters = SavedSearchFilters()

    @model_validator(mode="after")
    def _dates(self):
        validate_stay(self.check_in, self.check_out)
        return self


class SavedSearchRead(ORM):
    id: int
    destination_id: int | None
    check_in: date | None
    check_out: date | None
    guests: int
    filters: dict
    created_at: datetime
    updated_at: datetime


# ---- admin dashboard ----
class DashboardRead(BaseModel):
    reservations_by_status: dict[str, int]
    revenue: Decimal
    refunded_total: Decimal
    destinations_total: int
    destinations_visible: int
    hotels_total: int
    rooms_total: int
    rooms_active: int
    revenue_definition: str = (
        "Sum of payments with status 'succeeded'. Failed and pending payments are excluded; "
        "refunded payments are reported separately and are not counted as revenue."
    )
