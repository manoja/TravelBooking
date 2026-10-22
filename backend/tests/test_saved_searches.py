from datetime import date, timedelta

from tests.conftest import API, book


def payload(dates, **extra):
    return {"destination_id": None, "guests": 2, **dates, **extra}


def test_create_list_get_delete(client, catalog, dates, user1):
    created = client.post(
        f"{API}/saved-searches",
        json=payload(
            dates,
            destination_id=catalog["paris"],
            filters={"max_price": "150", "amenities": ["wifi"]},
        ),
        headers=user1,
    )
    assert created.status_code == 201
    saved = created.json()
    assert saved["filters"]["amenities"] == ["wifi"] and saved["guests"] == 2

    assert client.get(f"{API}/saved-searches", headers=user1).json()["total"] == 1
    assert (
        client.get(f"{API}/saved-searches/{saved['id']}", headers=user1).json()["id"] == saved["id"]
    )
    assert client.delete(f"{API}/saved-searches/{saved['id']}", headers=user1).status_code == 204
    assert client.get(f"{API}/saved-searches/{saved['id']}", headers=user1).status_code == 404


def test_ownership(client, catalog, dates, user1, user2):
    saved_id = client.post(f"{API}/saved-searches", json=payload(dates), headers=user1).json()["id"]
    assert client.get(f"{API}/saved-searches", headers=user2).json()["total"] == 0
    assert client.get(f"{API}/saved-searches/{saved_id}", headers=user2).status_code == 404
    assert client.post(f"{API}/saved-searches/{saved_id}/run", headers=user2).status_code == 404
    assert client.delete(f"{API}/saved-searches/{saved_id}", headers=user2).status_code == 404
    assert client.get(f"{API}/saved-searches/{saved_id}", headers=user1).status_code == 200
    assert client.get(f"{API}/saved-searches").status_code == 401


def test_run_uses_current_availability_and_pricing(
    client, catalog, dates, user1, user2, session_factory
):
    saved_id = client.post(
        f"{API}/saved-searches",
        json=payload(dates, destination_id=catalog["paris"], filters={"sort_by": "price_desc"}),
        headers=user1,
    ).json()["id"]

    first = client.post(f"{API}/saved-searches/{saved_id}/run", headers=user1)
    assert first.status_code == 200
    assert [r["name"] for r in first.json()["items"]] == ["Suite", "Double"]

    book(client, user2, catalog["suite"], dates, guests=3)
    second = client.post(f"{API}/saved-searches/{saved_id}/run", headers=user1).json()
    assert [r["name"] for r in second["items"]] == ["Double"]

    from decimal import Decimal

    from app.models import Room

    with session_factory() as db:
        db.get(Room, catalog["double"]).price_per_night = Decimal("175.00")
        db.commit()
    third = client.post(f"{API}/saved-searches/{saved_id}/run", headers=user1).json()
    assert third["items"][0]["price_per_night"] == "175.00"


def test_run_paging_validation(client, catalog, dates, user1):
    saved_id = client.post(f"{API}/saved-searches", json=payload(dates), headers=user1).json()["id"]
    assert (
        client.post(
            f"{API}/saved-searches/{saved_id}/run", params={"page_size": 0}, headers=user1
        ).status_code
        == 422
    )


def test_validation(client, catalog, dates, user1):
    bad_payloads = [
        payload({"check_in": dates["check_out"], "check_out": dates["check_in"]}),
        payload({"check_in": dates["check_in"]}),
        payload(dates, guests=0),
        payload(dates, filters={"min_price": "10", "max_price": "1"}),
        payload(dates, filters={"unknown": 1}),
        payload(dates, user_id="someone-else"),
    ]
    for body in bad_payloads:
        assert client.post(f"{API}/saved-searches", json=body, headers=user1).status_code == 422, (
            body
        )
    missing_dest = client.post(
        f"{API}/saved-searches", json=payload(dates, destination_id=9999), headers=user1
    )
    assert missing_dest.status_code == 404
    hidden = payload(dates, destination_id=catalog["hidden_destination"])
    assert client.post(f"{API}/saved-searches", json=hidden, headers=user1).status_code == 404


def test_dates_optional_and_stale_dates_rejected_on_run(client, catalog, user1, session_factory):
    saved = client.post(f"{API}/saved-searches", json={"guests": 1}, headers=user1).json()
    assert (
        client.post(f"{API}/saved-searches/{saved['id']}/run", headers=user1).json()["total"] == 2
    )

    from app.models import SavedSearch

    past = date.today() - timedelta(days=5)
    with session_factory() as db:
        row = db.get(SavedSearch, saved["id"])
        row.check_in, row.check_out = past, past + timedelta(days=2)
        db.commit()
    assert client.post(f"{API}/saved-searches/{saved['id']}/run", headers=user1).status_code == 400
