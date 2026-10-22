import pytest

from app.core.config import get_settings
from tests.conftest import API, book


def pay(client, headers, reservation_id, outcome="success", key=None):
    extra = {"Idempotency-Key": key} if key else {}
    return client.post(
        f"{API}/payments/dummy",
        json={"reservation_id": reservation_id, "outcome": outcome},
        headers={**headers, **extra},
    )


@pytest.fixture
def reservation(client, catalog, dates, user1):
    return book(client, user1, catalog["double"], dates).json()


def reservation_status(client, headers, reservation_id):
    return client.get(f"{API}/reservations/{reservation_id}", headers=headers).json()["status"]


def test_successful_payment_confirms_reservation(client, reservation, user1):
    res = pay(client, user1, reservation["id"])
    body = res.json()
    assert res.status_code == 201
    assert body["status"] == "succeeded" and body["amount"] == reservation["total_amount"]
    assert body["reservation_status"] == "confirmed"
    assert "development-only" in body["notice"].lower()
    assert reservation_status(client, user1, reservation["id"]) == "confirmed"


def test_failed_payment_keeps_reservation_pending_and_allows_retry(client, reservation, user1):
    failed = pay(client, user1, reservation["id"], "failure")
    assert failed.status_code == 201 and failed.json()["status"] == "failed"
    assert reservation_status(client, user1, reservation["id"]) == "pending"
    assert pay(client, user1, reservation["id"], "success").json()["status"] == "succeeded"
    history = client.get(f"{API}/payments/reservation/{reservation['id']}", headers=user1).json()
    assert sorted(p["status"] for p in history) == ["failed", "succeeded"]


def test_duplicate_successful_payment_rejected(client, reservation, user1):
    assert pay(client, user1, reservation["id"]).status_code == 201
    assert pay(client, user1, reservation["id"]).status_code == 409
    history = client.get(f"{API}/payments/reservation/{reservation['id']}", headers=user1).json()
    assert len(history) == 1


def test_idempotency_key_replays_original_result(client, reservation, user1):
    first = pay(client, user1, reservation["id"], key="key-abcdefgh-1")
    again = pay(client, user1, reservation["id"], key="key-abcdefgh-1")
    assert first.status_code == 201 and again.status_code == 200
    assert again.json()["id"] == first.json()["id"]
    assert again.json()["transaction_reference"] == first.json()["transaction_reference"]
    history = client.get(f"{API}/payments/reservation/{reservation['id']}", headers=user1).json()
    assert len(history) == 1


def test_invalid_idempotency_key_rejected(client, reservation, user1):
    assert pay(client, user1, reservation["id"], key="short").status_code == 422


def test_payment_amount_is_not_client_controlled(client, reservation, user1):
    res = client.post(
        f"{API}/payments/dummy",
        json={"reservation_id": reservation["id"], "outcome": "success", "amount": "0.01"},
        headers=user1,
    )
    assert res.status_code == 422


def test_cannot_pay_for_someone_elses_reservation(client, reservation, user2, admin):
    assert pay(client, user2, reservation["id"]).status_code == 404
    assert pay(client, admin, reservation["id"]).status_code == 404
    assert pay(client, user2, 99999).status_code == 404


def test_payment_history_access(client, reservation, user1, user2, admin):
    pay(client, user1, reservation["id"])
    url = f"{API}/payments/reservation/{reservation['id']}"
    assert len(client.get(url, headers=user1).json()) == 1
    assert len(client.get(url, headers=admin).json()) == 1
    assert client.get(url, headers=user2).status_code == 404
    assert client.get(url).status_code == 401


def test_payment_rejected_for_expired_or_cancelled(client, session_factory, reservation, user1):
    from tests.test_reservations import age_reservation

    age_reservation(session_factory, reservation["id"], hours=2)
    assert pay(client, user1, reservation["id"]).status_code == 409
    assert reservation_status(client, user1, reservation["id"]) == "expired"


def test_payment_rejected_for_cancelled(client, reservation, user1):
    client.post(f"{API}/reservations/{reservation['id']}/cancel", headers=user1)
    assert pay(client, user1, reservation["id"]).status_code == 409


def test_invalid_outcome_and_auth(client, reservation, user1):
    bad = client.post(
        f"{API}/payments/dummy",
        json={"reservation_id": reservation["id"], "outcome": "maybe"},
        headers=user1,
    )
    assert bad.status_code == 422
    assert (
        client.post(
            f"{API}/payments/dummy", json={"reservation_id": 1, "outcome": "success"}
        ).status_code
        == 401
    )


def test_dummy_payments_disabled_in_production(client, reservation, user1, monkeypatch):
    monkeypatch.setattr(get_settings(), "app_env", "production")
    assert pay(client, user1, reservation["id"]).status_code == 404
