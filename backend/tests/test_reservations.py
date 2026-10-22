from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.core.config import get_settings
from app.models import Reservation
from tests.conftest import API, USING_POSTGRES, book, headers_for


def age_reservation(session_factory, reservation_id, **delta):
    with session_factory() as db:
        reservation = db.get(Reservation, reservation_id)
        reservation.created_at = reservation.created_at - timedelta(**delta)
        db.commit()


def test_create_reservation_server_side_price(client, catalog, dates, user1):
    res = book(client, user1, catalog["double"], dates)
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "pending" and body["nights"] == 3
    assert body["total_amount"] == "300.00"
    assert body["confirmation_number"].startswith("TRV-")
    assert body["expires_at"] is not None
    assert body["room"]["hotel_name"] == "Hotel Lumiere"
    assert body["room"]["destination_name"] == "Paris"


def test_tax_and_fee_are_applied(client, catalog, dates, user1, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "tax_rate_percent", Decimal("10"))
    monkeypatch.setattr(settings, "flat_fee", Decimal("5.50"))
    assert book(client, user1, catalog["double"], dates).json()["total_amount"] == "335.50"


def test_client_cannot_supply_user_or_amount(client, catalog, dates, user1):
    payload = {"room_id": catalog["double"], "guests": 2, **dates}
    for extra in ({"total_amount": "1.00"}, {"user_id": "x"}, {"status": "confirmed"}):
        res = client.post(f"{API}/reservations", json={**payload, **extra}, headers=user1)
        assert res.status_code == 422


def test_reservation_validation(client, catalog, dates, user1):
    assert book(client, user1, catalog["double"], dates, guests=3).status_code == 400
    assert book(client, user1, catalog["double"], dates, guests=0).status_code == 422
    assert book(client, user1, 99999, dates).status_code == 404
    for key in ("inactive", "hidden_room"):
        assert book(client, user1, catalog[key], dates).status_code == 404
    inverted = {"check_in": dates["check_out"], "check_out": dates["check_in"]}
    assert book(client, user1, catalog["double"], inverted).status_code == 422
    past = {
        "check_in": (date.today() - timedelta(days=2)).isoformat(),
        "check_out": dates["check_out"],
    }
    assert book(client, user1, catalog["double"], past).status_code == 422
    assert client.post(f"{API}/reservations", json={"room_id": 1}).status_code == 401


def test_overlapping_reservations_conflict(client, catalog, dates, user1, user2):
    assert book(client, user1, catalog["double"], dates).status_code == 201
    assert book(client, user2, catalog["double"], dates).status_code == 409

    start = date.fromisoformat(dates["check_in"])
    partial = {
        "check_in": (start + timedelta(days=2)).isoformat(),
        "check_out": (start + timedelta(days=5)).isoformat(),
    }
    assert book(client, user2, catalog["double"], partial).status_code == 409
    inside = {
        "check_in": (start + timedelta(days=1)).isoformat(),
        "check_out": (start + timedelta(days=2)).isoformat(),
    }
    assert book(client, user2, catalog["double"], inside).status_code == 409

    adjacent = {
        "check_in": dates["check_out"],
        "check_out": (date.fromisoformat(dates["check_out"]) + timedelta(days=2)).isoformat(),
    }
    assert book(client, user2, catalog["double"], adjacent).status_code == 201
    assert book(client, user2, catalog["suite"], dates).status_code == 201


def test_expired_hold_releases_the_room(client, session_factory, catalog, dates, user1, user2):
    first = book(client, user1, catalog["double"], dates).json()
    age_reservation(session_factory, first["id"], hours=1)
    assert book(client, user2, catalog["double"], dates).status_code == 201
    assert (
        client.get(f"{API}/reservations/{first['id']}", headers=user1).json()["status"] == "expired"
    )


def test_cancelled_reservation_releases_the_room(client, catalog, dates, user1, user2):
    first = book(client, user1, catalog["double"], dates).json()
    assert (
        client.post(f"{API}/reservations/{first['id']}/cancel", headers=user1).json()["status"]
        == "cancelled"
    )
    assert book(client, user2, catalog["double"], dates).status_code == 201


def test_confirmed_reservations_block_even_when_old(
    client, session_factory, catalog, dates, user1, user2
):
    first = book(client, user1, catalog["double"], dates).json()
    client.post(
        f"{API}/payments/dummy",
        json={"reservation_id": first["id"], "outcome": "success"},
        headers=user1,
    )
    age_reservation(session_factory, first["id"], days=3)
    assert book(client, user2, catalog["double"], dates).status_code == 409


def test_reservation_ownership(client, catalog, dates, user1, user2, admin):
    res_id = book(client, user1, catalog["double"], dates).json()["id"]
    assert client.get(f"{API}/reservations/{res_id}", headers=user1).status_code == 200
    assert client.get(f"{API}/reservations/{res_id}", headers=user2).status_code == 404
    assert client.get(f"{API}/reservations/{res_id}", headers=admin).status_code == 200
    assert client.post(f"{API}/reservations/{res_id}/cancel", headers=user2).status_code == 404
    assert client.get(f"{API}/reservations/{res_id}").status_code == 401
    assert client.get(f"{API}/reservations/99999", headers=user1).status_code == 404


def test_my_reservations_filtering_and_pagination(client, catalog, dates, user1, user2):
    first = book(client, user1, catalog["double"], dates).json()
    book(client, user1, catalog["suite"], dates, guests=3)
    client.post(f"{API}/reservations/{first['id']}/cancel", headers=user1)

    mine = client.get(f"{API}/reservations/me", headers=user1).json()
    assert mine["total"] == 2 and mine["total_pages"] == 1
    assert (
        client.get(f"{API}/reservations/me", params={"status": "cancelled"}, headers=user1).json()[
            "total"
        ]
        == 1
    )
    assert (
        client.get(f"{API}/reservations/me", params={"page_size": 1}, headers=user1).json()[
            "total_pages"
        ]
        == 2
    )
    assert client.get(f"{API}/reservations/me", headers=user2).json()["total"] == 0
    assert (
        client.get(f"{API}/reservations/me", params={"status": "bogus"}, headers=user1).status_code
        == 422
    )
    assert (
        client.get(f"{API}/reservations/me", params={"page": 0}, headers=user1).status_code == 422
    )


def test_cancellation_policy(client, session_factory, catalog, user1, admin):
    soon = date.today() + timedelta(days=1)
    soon_dates = {"check_in": soon.isoformat(), "check_out": (soon + timedelta(days=1)).isoformat()}
    res = book(client, user1, catalog["double"], soon_dates).json()
    # Pending holds can always be cancelled by the owner.
    pay = client.post(
        f"{API}/payments/dummy",
        json={"reservation_id": res["id"], "outcome": "success"},
        headers=user1,
    )
    assert pay.status_code == 201
    # Confirmed and too close to check-in: owner blocked, admin allowed.
    get_settings().cancellation_cutoff_days = 2
    try:
        assert (
            client.post(f"{API}/reservations/{res['id']}/cancel", headers=user1).status_code == 409
        )
        cancelled = client.post(f"{API}/reservations/{res['id']}/cancel", headers=admin)
    finally:
        get_settings().cancellation_cutoff_days = 1
    assert cancelled.json()["status"] == "cancelled"
    payments = client.get(f"{API}/payments/reservation/{res['id']}", headers=user1).json()
    assert [p["status"] for p in payments] == ["refunded"]
    assert client.post(f"{API}/reservations/{res['id']}/cancel", headers=user1).status_code == 409


@pytest.mark.skipif(
    not USING_POSTGRES, reason="needs PostgreSQL row locking (set TEST_DATABASE_URL)"
)
def test_concurrent_bookings_do_not_overbook(client, catalog, dates):
    users = [headers_for(f"auth0|racer{i}") for i in range(8)]
    for headers in users:
        client.get(f"{API}/auth/me", headers=headers)
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(
            pool.map(lambda h: book(client, h, catalog["double"], dates).status_code, users)
        )
    assert results.count(201) == 1 and results.count(409) == 7
