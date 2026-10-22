from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import BadRequest, NotFound
from app.models.booking import Payment, Reservation, SavedSearch
from app.models.catalog import Destination, Hotel, Room
from app.models.user import User
from app.repositories.catalog_repository import DestinationRepository
from app.schemas.booking import DashboardRead, SavedSearchCreate
from app.schemas.catalog import RoomSearchParams
from app.schemas.common import PageParams, build_page
from app.services.catalog_service import RoomService


class SavedSearchService:
    def __init__(self, db: Session):
        self.db = db

    def list_items(self, user: User, params: PageParams) -> dict:
        stmt = select(SavedSearch).where(SavedSearch.user_id == user.id)
        total = self.db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        rows = self.db.scalars(
            stmt.order_by(SavedSearch.created_at.desc(), SavedSearch.id.desc())
            .limit(params.page_size)
            .offset((params.page - 1) * params.page_size)
        ).all()
        return build_page(list(rows), total, params.page, params.page_size)

    def create(self, user: User, data: SavedSearchCreate) -> SavedSearch:
        if data.destination_id is not None:
            destination = DestinationRepository(self.db).get(data.destination_id)
            if destination is None or not destination.is_visible:
                raise NotFound("Destination not found")
        saved = SavedSearch(
            user_id=user.id,
            destination_id=data.destination_id,
            check_in=data.check_in,
            check_out=data.check_out,
            guests=data.guests,
            filters=data.filters.model_dump(mode="json"),
        )
        self.db.add(saved)
        self.db.commit()
        return saved

    def get(self, user: User, search_id: int) -> SavedSearch:
        saved = self.db.get(SavedSearch, search_id)
        if saved is None or saved.user_id != user.id:
            raise NotFound("Saved search not found")
        return saved

    def delete(self, user: User, search_id: int) -> None:
        self.db.delete(self.get(user, search_id))
        self.db.commit()

    def run(self, user: User, search_id: int, paging: PageParams) -> dict:
        """Re-run with current availability and prices (nothing is cached on the saved row)."""
        saved = self.get(user, search_id)
        try:
            params = RoomSearchParams(
                destination_id=saved.destination_id,
                check_in=saved.check_in,
                check_out=saved.check_out,
                guests=saved.guests,
                page=paging.page,
                page_size=paging.page_size,
                **(saved.filters or {}),
            )
        except ValidationError as exc:
            raise BadRequest(
                "Saved search is no longer valid (its dates may be in the past): "
                + "; ".join(error["msg"] for error in exc.errors())
            ) from exc
        return RoomService(self.db).search(params)


class DashboardService:
    def __init__(self, db: Session):
        self.db = db

    def _count(self, model, *conditions) -> int:
        stmt = select(func.count()).select_from(model)
        for condition in conditions:
            stmt = stmt.where(condition)
        return self.db.scalar(stmt) or 0

    def _sum_payments(self, status: str):
        stmt = select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.status == status)
        return self.db.scalar(stmt)

    def build(self) -> DashboardRead:
        by_status = dict(
            self.db.execute(
                select(Reservation.status, func.count()).group_by(Reservation.status)
            ).all()
        )
        return DashboardRead(
            reservations_by_status={
                s: by_status.get(s, 0) for s in ("pending", "confirmed", "cancelled", "expired")
            },
            revenue=self._sum_payments("succeeded"),
            refunded_total=self._sum_payments("refunded"),
            destinations_total=self._count(Destination),
            destinations_visible=self._count(Destination, Destination.is_visible.is_(True)),
            hotels_total=self._count(Hotel),
            rooms_total=self._count(Room),
            rooms_active=self._count(Room, Room.is_active.is_(True)),
        )
