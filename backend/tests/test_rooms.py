from datetime import date, timedelta

from tests.conftest import API, book


def search(client, **params):
    return client.get(f"{API}/rooms/search", params=params)


def test_search_returns_only_active_rooms_in_visible_hotels(client, catalog):
    body = search(client).json()
    assert [r["name"] for r in body["items"]] == ["Double", "Suite"]
    assert body["total"] == 2
    room = body["items"][0]
    assert room["hotel"]["name"] == "Hotel Lumiere"
    assert room["destination"]["slug"] == "paris"
    assert room["amenities"] == ["wifi", "breakfast"]
    assert room["price_per_night"] == "100.00"
    assert [i["image_url"] for i in room["images"]] == [
        "https://img.test/a.jpg",
        "https://img.test/b.jpg",
    ]


def test_search_filters(client, catalog):
    assert search(client, destination_id=catalog["rome"]).json()["total"] == 0
    assert search(client, destination_id=catalog["paris"]).json()["total"] == 2
    assert search(client, guests=3).json()["items"][0]["name"] == "Suite"
    assert search(client, guests=5).json()["total"] == 0
    assert search(client, min_price=150).json()["total"] == 1
    assert search(client, max_price=100).json()["total"] == 1
    assert search(client, min_price=100, max_price=100).json()["total"] == 1
    assert search(client, amenities="balcony").json()["items"][0]["name"] == "Suite"
    assert search(client, amenities="wifi,breakfast").json()["total"] == 1
    assert search(client, amenities=["wifi", "balcony"]).json()["total"] == 1
    assert search(client, amenities="pool").json()["total"] == 0


def test_search_sorting_and_pagination(client, catalog):
    desc = search(client, sort_by="price_desc").json()["items"]
    assert [r["name"] for r in desc] == ["Suite", "Double"]
    page = search(client, page=2, page_size=1).json()
    assert page["total"] == 2 and page["total_pages"] == 2 and page["items"][0]["name"] == "Suite"


def test_search_validation(client, catalog, dates):
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    cases = [
        {"check_in": dates["check_in"]},
        {"check_out": dates["check_out"]},
        {"check_in": dates["check_out"], "check_out": dates["check_in"]},
        {"check_in": dates["check_in"], "check_out": dates["check_in"]},
        {"check_in": yesterday, "check_out": dates["check_out"]},
        {
            "check_in": dates["check_in"],
            "check_out": (date.today() + timedelta(days=100)).isoformat(),
        },
        {"min_price": 200, "max_price": 100},
        {"min_price": -1},
        {"guests": 0},
        {"guests": 99},
        {"sort_by": "random"},
        {"page": 0},
        {"page_size": 500},
        {"check_in": "not-a-date", "check_out": dates["check_out"]},
    ]
    for params in cases:
        assert search(client, **params).status_code == 422, params


def test_search_excludes_conflicting_reservations(client, catalog, dates, user1):
    assert book(client, user1, catalog["double"], dates).status_code == 201
    names = [r["name"] for r in search(client, **dates).json()["items"]]
    assert names == ["Suite"]

    start = date.fromisoformat(dates["check_out"])  # check-out day is free again
    after = {"check_in": start.isoformat(), "check_out": (start + timedelta(days=1)).isoformat()}
    assert search(client, **after).json()["total"] == 2
    overlapping = {
        "check_in": (date.fromisoformat(dates["check_in"]) + timedelta(days=1)).isoformat(),
        "check_out": (start + timedelta(days=2)).isoformat(),
    }
    assert [r["name"] for r in search(client, **overlapping).json()["items"]] == ["Suite"]


def test_room_details(client, catalog):
    body = client.get(f"{API}/rooms/{catalog['double']}").json()
    assert body["capacity"] == 2 and body["hotel"]["name"] == "Hotel Lumiere"
    assert len(body["images"]) == 2
    for key in ("inactive", "hidden_room"):
        assert client.get(f"{API}/rooms/{catalog[key]}").status_code == 404
    assert client.get(f"{API}/rooms/99999").status_code == 404
