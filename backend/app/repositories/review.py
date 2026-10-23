import uuid
from typing import Sequence

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.models.review import HotelReview, PUBLISHED
from app.schemas.review import HotelReviewCreate, HotelReviewUpdate, HotelReviewSummary


class HotelReviewRepository:
    """Repository for hotel review operations."""

    def __init__(self, session: Session):
        self.session = session

    def create_review(
        self,
        hotel_id: int,
        user_id: uuid.UUID,
        reservation_id: int | None,
        create_data: HotelReviewCreate,
    ) -> HotelReview:
        """Create a new hotel review or update existing one (upsert)."""
        review = self.session.query(HotelReview).filter_by(
            hotel_id=hotel_id, user_id=user_id
        ).first()

        if review:
            # Update existing review
            review.rating = create_data.rating
            review.title = create_data.title
            review.review_text = create_data.review_text
            review.cleanliness_rating = create_data.cleanliness_rating
            review.service_rating = create_data.service_rating
            review.location_rating = create_data.location_rating
            review.value_rating = create_data.value_rating
            review.reservation_id = reservation_id
        else:
            # Create new review
            review = HotelReview(
                hotel_id=hotel_id,
                user_id=user_id,
                reservation_id=reservation_id,
                rating=create_data.rating,
                title=create_data.title,
                review_text=create_data.review_text,
                cleanliness_rating=create_data.cleanliness_rating,
                service_rating=create_data.service_rating,
                location_rating=create_data.location_rating,
                value_rating=create_data.value_rating,
            )
            self.session.add(review)

        self.session.commit()
        self.session.refresh(review)
        return review

    def get_review_by_id(self, review_id: int) -> HotelReview | None:
        """Get a review by ID."""
        return self.session.query(HotelReview).filter_by(id=review_id).first()

    def get_user_review(
        self, hotel_id: int, user_id: uuid.UUID
    ) -> HotelReview | None:
        """Get a user's review for a hotel."""
        return self.session.query(HotelReview).filter_by(
            hotel_id=hotel_id, user_id=user_id
        ).first()

    def get_published_reviews(
        self, hotel_id: int, limit: int = 10, offset: int = 0
    ) -> Sequence[HotelReview]:
        """Get published reviews for a hotel."""
        return self.session.query(HotelReview).filter_by(
            hotel_id=hotel_id, status=PUBLISHED
        ).order_by(HotelReview.created_at.desc()).offset(offset).limit(limit).all()

    def get_published_reviews_count(self, hotel_id: int) -> int:
        """Get count of published reviews for a hotel."""
        return self.session.query(func.count(HotelReview.id)).filter_by(
            hotel_id=hotel_id, status=PUBLISHED
        ).scalar() or 0

    def get_hotel_review_summary(self, hotel_id: int) -> HotelReviewSummary:
        """Get summary statistics for a hotel's reviews."""
        query = self.session.query(HotelReview).filter_by(
            hotel_id=hotel_id, status=PUBLISHED
        )
        reviews = query.all()

        if not reviews:
            return HotelReviewSummary(
                total_reviews=0,
                average_rating=0.0,
                average_cleanliness=None,
                average_service=None,
                average_location=None,
                average_value=None,
                rating_distribution={1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
            )

        total = len(reviews)
        avg_rating = sum(r.rating for r in reviews) / total
        avg_cleanliness = None
        avg_service = None
        avg_location = None
        avg_value = None

        cleanliness_ratings = [r.cleanliness_rating for r in reviews if r.cleanliness_rating]
        if cleanliness_ratings:
            avg_cleanliness = sum(cleanliness_ratings) / len(cleanliness_ratings)

        service_ratings = [r.service_rating for r in reviews if r.service_rating]
        if service_ratings:
            avg_service = sum(service_ratings) / len(service_ratings)

        location_ratings = [r.location_rating for r in reviews if r.location_rating]
        if location_ratings:
            avg_location = sum(location_ratings) / len(location_ratings)

        value_ratings = [r.value_rating for r in reviews if r.value_rating]
        if value_ratings:
            avg_value = sum(value_ratings) / len(value_ratings)

        # Rating distribution
        rating_distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        for review in reviews:
            rating_distribution[review.rating] += 1

        return HotelReviewSummary(
            total_reviews=total,
            average_rating=round(avg_rating, 2),
            average_cleanliness=round(avg_cleanliness, 2) if avg_cleanliness else None,
            average_service=round(avg_service, 2) if avg_service else None,
            average_location=round(avg_location, 2) if avg_location else None,
            average_value=round(avg_value, 2) if avg_value else None,
            rating_distribution=rating_distribution,
        )

    def update_review_status(
        self, review_id: int, update_data: HotelReviewUpdate
    ) -> HotelReview | None:
        """Update review status (admin only)."""
        review = self.get_review_by_id(review_id)
        if not review:
            return None

        if update_data.status:
            review.status = update_data.status

        self.session.commit()
        self.session.refresh(review)
        return review

    def delete_review(self, review_id: int) -> bool:
        """Delete a review."""
        review = self.get_review_by_id(review_id)
        if not review:
            return False

        self.session.delete(review)
        self.session.commit()
        return True

    def get_user_reviews(self, user_id: uuid.UUID) -> Sequence[HotelReview]:
        """Get all reviews by a user."""
        return self.session.query(HotelReview).filter_by(
            user_id=user_id
        ).order_by(HotelReview.created_at.desc()).all()
