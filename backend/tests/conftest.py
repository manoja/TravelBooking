import os
import time
from datetime import date, timedelta
from decimal import Decimal

os.environ.update(
    APP_ENV="test",
    AUTH0_DOMAIN="test-tenant.example.auth0.com",
    AUTH0_AUDIENCE="https://api.travel.test",
    CORS_ORIGINS="http://localhost:4200",
    DATABASE_URL="",
)

import jwt  # noqa: E402
import pytest  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import rsa  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Destination, Hotel, Room, RoomImage, User  # noqa: E402

API = "/api/v1"
SETTINGS = get_settings()
ISSUER = SETTINGS.issuer
AUDIENCE = SETTINGS.auth0_audience

_PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)

# Optional real-PostgreSQL run (needed for the concurrency test). Must be a dedicated *_test DB.
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
if TEST_DATABASE_URL and not (make_url(TEST_DATABASE_URL).database or "").endswith("_test"):
    raise RuntimeError("TEST_DATABASE_URL must point to a database whose name ends with '_test'")
USING_POSTGRES = bool(TEST_DATABASE_URL)


def make_token(sub="auth0|user1", key=_PRIVATE_KEY, algorithm="RS256", **overrides) -> str:
    claims = {
        "sub": sub,
        "email": f"{(sub or 'anon').split('|')[-1]}@example.com",
        "name": "Test Person",
        "iss": ISSUER,
        "aud": AUDIENCE,
        "iat": int(time.time()),
        "exp": int(time.time()) + 600,
    }
    claims.update(overrides)
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, key, algorithm=algorithm, headers={"kid": "test-key"})


def headers_for(sub="auth0|user1", **kwargs) -> dict:
    return {"Authorization": f"Bearer {make_token(sub, **kwargs)}"}


@pytest.fixture(autouse=True)
def stub_jwks(monkeypatch):
    """Verify against the local test key instead of fetching Auth0's JWKS."""
    monkeypatch.setattr(
        "app.core.security.get_signing_key", lambda token: _PRIVATE_KEY.public_key()
    )
    monkeypatch.setattr(
        "app.services.user_service.fetch_userinfo",
        lambda token: (_ for _ in ()).throw(AssertionError("unexpected userinfo call")),
    )


@pytest.fixture
def session_factory():
    if USING_POSTGRES:
        engine = create_engine(TEST_DATABASE_URL, pool_size=10)
        Base.metadata.drop_all(engine)
    else:
        engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
    Base.metadata.create_all(engine)
    yield sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    if USING_POSTGRES:
        Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def client(session_factory):
    def override():
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def user1():
    return headers_for("auth0|user1")


@pytest.fixture
def user2():
    return headers_for("auth0|user2")


@pytest.fixture
def admin(session_factory):
    with session_factory() as db:
        db.add(User(auth0_sub="auth0|admin", email="admin@example.com", name="A", role="admin"))
        db.commit()
    return headers_for("auth0|admin")


@pytest.fixture
def catalog(session_factory):
    """Visible Paris/Hotel/two rooms plus hidden and inactive counterparts."""
    with session_factory() as db:
        paris = Destination(name="Paris", slug="paris", description="City of light")
        rome = Destination(name="Rome", slug="rome", description="Eternal city")
        hidden = Destination(name="Secret", slug="secret", is_visible=False)
        db.add_all([paris, rome, hidden])
        db.flush()
        hotel = Hotel(destination_id=paris.id, name="Hotel Lumiere", address="1 Rue A")
        hidden_hotel = Hotel(destination_id=paris.id, name="Hidden Hotel", is_visible=False)
        secret_hotel = Hotel(destination_id=hidden.id, name="Secret Hotel")
        db.add_all([hotel, hidden_hotel, secret_hotel])
        db.flush()
        double = Room(
            hotel_id=hotel.id,
            name="Double",
            capacity=2,
            price_per_night=Decimal("100.00"),
            amenities=["wifi", "breakfast"],
        )
        suite = Room(
            hotel_id=hotel.id,
            name="Suite",
            capacity=4,
            price_per_night=Decimal("250.00"),
            amenities=["wifi", "balcony"],
        )
        inactive = Room(
            hotel_id=hotel.id,
            name="Closed",
            capacity=2,
            price_per_night=Decimal("50.00"),
            amenities=[],
            is_active=False,
        )
        hidden_room = Room(
            hotel_id=hidden_hotel.id,
            name="In hidden hotel",
            capacity=2,
            price_per_night=Decimal("60.00"),
            amenities=[],
        )
        db.add_all([double, suite, inactive, hidden_room])
        db.flush()
        db.add_all(
            [
                RoomImage(room_id=double.id, image_url="https://img.test/b.jpg", sort_order=2),
                RoomImage(room_id=double.id, image_url="https://img.test/a.jpg", sort_order=1),
            ]
        )
        db.commit()
        return {
            "paris": paris.id,
            "rome": rome.id,
            "hidden_destination": hidden.id,
            "hotel": hotel.id,
            "hidden_hotel": hidden_hotel.id,
            "secret_hotel": secret_hotel.id,
            "double": double.id,
            "suite": suite.id,
            "inactive": inactive.id,
            "hidden_room": hidden_room.id,
        }


@pytest.fixture
def dates():
    start = date.today() + timedelta(days=10)
    return {"check_in": start.isoformat(), "check_out": (start + timedelta(days=3)).isoformat()}


def book(client, headers, room_id, dates, guests=2):
    return client.post(
        f"{API}/reservations", json={"room_id": room_id, "guests": guests, **dates}, headers=headers
    )
