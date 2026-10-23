import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.repositories.review import HotelReviewRepository
from app.schemas.review import (
    HotelReviewCreate,
    HotelReviewRead,
    HotelReviewWithSummary,
    HotelReviewUpdate,
    MyHotelReviewRead,
)
from app.models.user import User

router = APIRouter(prefix="/hotels", tags=["reviews"])


@router.post("/{hotel_id}/reviews", response_model=MyHotelReviewRead, status_code=201)
def create_review(
    hotel_id: int,
    review_data: HotelReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create or update a hotel review for the current user.
    Only one review per user per hotel is allowed.
    """
    repo = HotelReviewRepository(db)
    review = repo.create_review(
        hotel_id=hotel_id,
        user_id=current_user.id,
        reservation_id=None,
        create_data=review_data,
    )
    return review


@router.get("/{hotel_id}/reviews", response_model=HotelReviewWithSummary)
def get_hotel_reviews(
    hotel_id: int,
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """
    Get published reviews and summary for a hotel.
    """
    repo = HotelReviewRepository(db)

    reviews = repo.get_published_reviews(hotel_id, limit=limit, offset=offset)
    summary = repo.get_hotel_review_summary(hotel_id)

    review_models = [HotelReviewRead.model_validate(r) for r in reviews]

    return HotelReviewWithSummary(
        summary=summary,
        reviews=review_models,
    )


@router.get("/{hotel_id}/reviews/summary")
def get_hotel_reviews_summary(
    hotel_id: int,
    db: Session = Depends(get_db),
):
    """
    Get only the summary statistics for a hotel's reviews.
    """
    repo = HotelReviewRepository(db)
    summary = repo.get_hotel_review_summary(hotel_id)
    return summary


@router.get("/{hotel_id}/my-review", response_model=MyHotelReviewRead | None)
def get_my_review(
    hotel_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get the current user's review for a hotel (if any).
    """
    repo = HotelReviewRepository(db)
    review = repo.get_user_review(hotel_id, current_user.id)
    return review


@router.put("/reviews/{review_id}", response_model=MyHotelReviewRead)
def update_my_review(
    review_id: int,
    update_data: HotelReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update the current user's own review.
    """
    repo = HotelReviewRepository(db)
    review = repo.get_review_by_id(review_id)

    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if review.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own reviews")

    # Update the review
    review.rating = update_data.rating
    review.title = update_data.title
    review.review_text = update_data.review_text
    review.cleanliness_rating = update_data.cleanliness_rating
    review.service_rating = update_data.service_rating
    review.location_rating = update_data.location_rating
    review.value_rating = update_data.value_rating

    db.commit()
    db.refresh(review)

    return review


@router.delete("/reviews/{review_id}", status_code=204)
def delete_my_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete the current user's own review.
    """
    repo = HotelReviewRepository(db)
    review = repo.get_review_by_id(review_id)

    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if review.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own reviews")

    repo.delete_review(review_id)
