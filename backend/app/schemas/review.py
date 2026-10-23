import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

ReviewStatus = Literal["pending", "published", "rejected"]


class HotelReviewCreate(BaseModel):
    """Create a hotel review after a reservation."""

    model_config = ConfigDict(extra="forbid")

    rating: Annotated[int, Field(ge=1, le=5)]
    title: Annotated[str | None, Field(max_length=150)] = None
    review_text: Annotated[str | None, Field(max_length=5000)] = None

    cleanliness_rating: Annotated[int | None, Field(ge=1, le=5)] = None
    service_rating: Annotated[int | None, Field(ge=1, le=5)] = None
    location_rating: Annotated[int | None, Field(ge=1, le=5)] = None
    value_rating: Annotated[int | None, Field(ge=1, le=5)] = None

    @model_validator(mode="after")
    def _validate_content(self):
        """At least one piece of content must be provided."""
        if not self.title and not self.review_text:
            raise ValueError("Either title or review_text must be provided")
        return self


class HotelReviewUpdate(BaseModel):
    """Update a hotel review (admin only for moderation)."""

    model_config = ConfigDict(extra="forbid")

    status: ReviewStatus | None = None


class HotelReviewRead(BaseModel):
    """Read a published hotel review."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: uuid.UUID
    rating: int
    title: str | None
    review_text: str | None

    cleanliness_rating: int | None
    service_rating: int | None
    location_rating: int | None
    value_rating: int | None

    created_at: datetime
    updated_at: datetime


class HotelReviewSummary(BaseModel):
    """Summary statistics for a hotel's reviews."""

    model_config = ConfigDict()

    total_reviews: int
    average_rating: float
    average_cleanliness: float | None
    average_service: float | None
    average_location: float | None
    average_value: float | None

    rating_distribution: dict[int, int]  # {1: count, 2: count, ...}


class HotelReviewWithSummary(BaseModel):
    """Hotel reviews with summary statistics."""

    model_config = ConfigDict()

    summary: HotelReviewSummary
    reviews: list[HotelReviewRead]


class MyHotelReviewRead(HotelReviewRead):
    """User's own review with status and reservation info."""

    reservation_id: int | None
    status: ReviewStatus
