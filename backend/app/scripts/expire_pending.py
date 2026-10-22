"""Mark stale pending reservations as expired. Safe to run repeatedly (e.g. every minute via cron).

    python -m app.scripts.expire_pending

Availability never depends on this job: stale holds stop blocking inventory by timestamp alone.
"""

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.repositories.reservation_repository import ReservationRepository


def run() -> int:
    with SessionLocal() as db:
        count = ReservationRepository(db).expire_stale()
        db.commit()
        return count


if __name__ == "__main__":
    get_settings().validate_for_runtime()
    print(f"Expired {run()} pending reservation(s)")
