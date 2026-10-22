"""Insert sample destinations, hotels, rooms and images (development only, idempotent by slug).

    python -m app.scripts.seed

Only inserts; never updates, deletes or truncates existing rows.
"""

from decimal import Decimal

from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models import Destination, Hotel, Room, RoomImage

SAMPLE = [
    {
        "name": "Paris",
        "slug": "paris",
        "description": "The city of light.",
        "hotels": [
            {
                "name": "Hotel Lumiere",
                "address": "12 Rue de Rivoli, Paris",
                "rooms": [
                    ("Classic Double", 2, "150.00", ["wifi", "breakfast"]),
                    ("Family Suite", 4, "280.00", ["wifi", "kitchenette", "balcony"]),
                ],
            }
        ],
    },
    {
        "name": "Tokyo",
        "slug": "tokyo",
        "description": "Neon and temples.",
        "hotels": [
            {
                "name": "Shinjuku Stay",
                "address": "1-1 Nishishinjuku, Tokyo",
                "rooms": [("Compact Single", 1, "90.00", ["wifi"])],
            }
        ],
    },
]


def seed() -> int:
    created = 0
    with SessionLocal() as db:
        for item in SAMPLE:
            if db.scalar(select(Destination.id).where(Destination.slug == item["slug"])):
                continue
            destination = Destination(
                name=item["name"], slug=item["slug"], description=item["description"]
            )
            db.add(destination)
            db.flush()
            for hotel_data in item["hotels"]:
                hotel = Hotel(
                    destination_id=destination.id,
                    name=hotel_data["name"],
                    address=hotel_data["address"],
                )
                db.add(hotel)
                db.flush()
                for name, capacity, price, amenities in hotel_data["rooms"]:
                    room = Room(
                        hotel_id=hotel.id,
                        name=name,
                        capacity=capacity,
                        price_per_night=Decimal(price),
                        amenities=amenities,
                    )
                    db.add(room)
                    db.flush()
                    db.add(
                        RoomImage(
                            room_id=room.id,
                            image_url=f"https://picsum.photos/seed/{room.id}/800/600",
                            sort_order=0,
                        )
                    )
            created += 1
        db.commit()
    return created


if __name__ == "__main__":
    settings = get_settings()
    if settings.app_env == "production":
        raise SystemExit("Refusing to seed sample data in production")
    settings.validate_for_runtime()
    print(f"Seeded {seed()} destination(s)")
