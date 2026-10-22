import pytest

from tests.conftest import API, book

ADMIN_ROUTES = [
    ("get", "/admin/destinations", None),
    ("post", "/admin/destinations", {"name": "X"}),
    ("patch", "/admin/destinations/1", {"name": "Y"}),
    ("delete", "/admin/destinations/1", None),
    ("get", "/admin/hotels", None),
    ("post", "/admin/hotels", {"destination_id": 1, "name": "H"}),
    ("patch", "/admin/hotels/1", {"name": "Y"}),
    ("delete", "/admin/hotels/1", None),
    ("get", "/admin/rooms", None),
    ("post", "/admin/rooms", {"hotel_id": 1, "name": "R", "capacity": 2, "price_per_night": "10"}),
    ("patch", "/admin/rooms/1", {"name": "Y"}),
    ("delete", "/admin/rooms/1", None),
    ("post", "/admin/rooms/1/images", {"image_url": "https://x.test/a.jpg"}),
    ("delete", "/admin/room-images/1", None),
    ("get", "/admin/reservations", None),
    ("get", "/admin/dashboard", None),
]


@pytest.mark.parametrize("method,path,body", ADMIN_ROUTES)
def test_admin_routes_require_authentication_and_admin_role(
    client, catalog, user1, method, path, body
):
    anonymous = (
        getattr(client, method)(f"{API}{path}", json=body)
        if body
        else getattr(client, method)(f"{API}{path}")
    )
    assert anonymous.status_code == 401
    kwargs = {"json": body} if body else {}
    normal = getattr(client, method)(f"{API}{path}", headers=user1, **kwargs)
    assert normal.status_code == 403


def test_destination_crud(client, admin):
    created = client.post(
        f"{API}/admin/destinations", json={"name": "New York City"}, headers=admin
    )
    assert created.status_code == 201 and created.json()["slug"] == "new-york-city"
    dest_id = created.json()["id"]
    assert (
        client.post(
            f"{API}/admin/destinations", json={"name": "New York City"}, headers=admin
        ).json()["slug"]
        == "new-york-city-2"
    )
    assert (
        client.post(
            f"{API}/admin/destinations", json={"name": "Z", "slug": "new-york-city"}, headers=admin
        ).status_code
        == 409
    )

    patched = client.patch(
        f"{API}/admin/destinations/{dest_id}",
        json={"is_visible": False, "description": "d"},
        headers=admin,
    )
    assert patched.json()["is_visible"] is False and patched.json()["name"] == "New York City"
    assert client.get(f"{API}/destinations/{dest_id}").status_code == 404
    assert client.get(f"{API}/admin/destinations", headers=admin).json()["total"] == 2

    assert (
        client.patch(
            f"{API}/admin/destinations/{dest_id}", json={"name": None}, headers=admin
        ).status_code
        == 422
    )
    assert (
        client.patch(
            f"{API}/admin/destinations/{dest_id}",
            json={"image_url": "javascript:alert(1)"},
            headers=admin,
        ).status_code
        == 422
    )
    assert (
        client.patch(
            f"{API}/admin/destinations/{dest_id}", json={"bogus": 1}, headers=admin
        ).status_code
        == 422
    )
    assert (
        client.patch(f"{API}/admin/destinations/999", json={"name": "q"}, headers=admin).status_code
        == 404
    )

    assert client.delete(f"{API}/admin/destinations/{dest_id}", headers=admin).status_code == 204
    assert client.delete(f"{API}/admin/destinations/{dest_id}", headers=admin).status_code == 404


def test_safe_deletion_rules(client, catalog, dates, admin, user1):
    assert (
        client.delete(f"{API}/admin/destinations/{catalog['paris']}", headers=admin).status_code
        == 409
    )
    assert client.delete(f"{API}/admin/hotels/{catalog['hotel']}", headers=admin).status_code == 409
    book(client, user1, catalog["double"], dates)
    assert client.delete(f"{API}/admin/rooms/{catalog['double']}", headers=admin).status_code == 409
    # Room without reservations is deleted together with its images.
    assert client.delete(f"{API}/admin/rooms/{catalog['suite']}", headers=admin).status_code == 204
    assert (
        client.delete(f"{API}/admin/destinations/{catalog['rome']}", headers=admin).status_code
        == 204
    )


def test_saved_search_is_detached_when_destination_deleted(client, catalog, dates, admin, user1):
    saved = client.post(
        f"{API}/saved-searches",
        json={"destination_id": catalog["rome"], "guests": 1},
        headers=user1,
    ).json()
    assert (
        client.delete(f"{API}/admin/destinations/{catalog['rome']}", headers=admin).status_code
        == 204
    )
    assert (
        client.get(f"{API}/saved-searches/{saved['id']}", headers=user1).json()["destination_id"]
        is None
    )


def test_hotel_crud(client, catalog, admin):
    assert (
        client.post(
            f"{API}/admin/hotels",
            json={"destination_id": 999, "name": "H", "address": "1 Main St"},
            headers=admin,
        ).status_code
        == 404
    )
    created = client.post(
        f"{API}/admin/hotels",
        json={"destination_id": catalog["rome"], "name": "Roma Inn", "address": "2 Via Roma"},
        headers=admin,
    )
    assert created.status_code == 201
    hotel_id = created.json()["id"]
    assert (
        client.patch(
            f"{API}/admin/hotels/{hotel_id}", json={"is_visible": False}, headers=admin
        ).json()["is_visible"]
        is False
    )
    assert (
        client.patch(
            f"{API}/admin/hotels/{hotel_id}", json={"destination_id": 999}, headers=admin
        ).status_code
        == 404
    )
    assert client.get(f"{API}/hotels/{hotel_id}").status_code == 404
    assert client.get(f"{API}/admin/hotels", headers=admin).json()["total"] == 4
    assert client.delete(f"{API}/admin/hotels/{hotel_id}", headers=admin).status_code == 204


def test_room_and_image_management(client, catalog, admin):
    body = {
        "hotel_id": catalog["hotel"],
        "name": "Penthouse",
        "capacity": 6,
        "price_per_night": "999.99",
        "amenities": ["pool"],
    }
    created = client.post(f"{API}/admin/rooms", json=body, headers=admin)
    assert created.status_code == 201 and created.json()["hotel"]["name"] == "Hotel Lumiere"
    room_id = created.json()["id"]

    for bad in (
        {"capacity": 0},
        {"price_per_night": "-1"},
        {"price_per_night": "1.234"},
        {"hotel_id": 999},
    ):
        res = client.post(f"{API}/admin/rooms", json={**body, **bad}, headers=admin)
        assert res.status_code in (404, 422), bad

    patched = client.patch(
        f"{API}/admin/rooms/{room_id}",
        json={"price_per_night": "800.00", "is_active": False},
        headers=admin,
    )
    assert patched.json()["price_per_night"] == "800.00" and patched.json()["is_active"] is False
    assert client.get(f"{API}/rooms/{room_id}").status_code == 404

    image = client.post(
        f"{API}/admin/rooms/{room_id}/images",
        json={"image_url": "https://img.test/p.jpg", "sort_order": 3},
        headers=admin,
    )
    assert image.status_code == 201
    assert (
        client.post(
            f"{API}/admin/rooms/999/images",
            json={"image_url": "https://img.test/p.jpg"},
            headers=admin,
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"{API}/admin/rooms/{room_id}/images", json={"image_url": "ftp://x"}, headers=admin
        ).status_code
        == 422
    )
    assert (
        client.get(
            f"{API}/admin/rooms", params={"hotel_id": catalog["hotel"]}, headers=admin
        ).json()["total"]
        == 4
    )

    assert (
        client.delete(f"{API}/admin/room-images/{image.json()['id']}", headers=admin).status_code
        == 204
    )
    assert (
        client.delete(f"{API}/admin/room-images/{image.json()['id']}", headers=admin).status_code
        == 404
    )
    assert client.delete(f"{API}/admin/rooms/{room_id}", headers=admin).status_code == 204


def test_admin_reservation_overview_and_dashboard(client, catalog, dates, admin, user1, user2):
    first = book(client, user1, catalog["double"], dates).json()
    book(client, user2, catalog["suite"], dates, guests=3)
    client.post(
        f"{API}/payments/dummy",
        json={"reservation_id": first["id"], "outcome": "success"},
        headers=user1,
    )

    everything = client.get(f"{API}/admin/reservations", headers=admin).json()
    assert everything["total"] == 2 and "user_id" in everything["items"][0]
    assert (
        client.get(
            f"{API}/admin/reservations", params={"status": "confirmed"}, headers=admin
        ).json()["total"]
        == 1
    )
    in_range = {"check_in_from": dates["check_in"], "check_in_to": dates["check_in"]}
    assert (
        client.get(f"{API}/admin/reservations", params=in_range, headers=admin).json()["total"] == 2
    )
    out_range = {"check_in_from": dates["check_out"]}
    assert (
        client.get(f"{API}/admin/reservations", params=out_range, headers=admin).json()["total"]
        == 0
    )
    inverted = {"check_in_from": dates["check_out"], "check_in_to": dates["check_in"]}
    assert (
        client.get(f"{API}/admin/reservations", params=inverted, headers=admin).status_code == 422
    )

    stats = client.get(f"{API}/admin/dashboard", headers=admin).json()
    assert stats["reservations_by_status"] == {
        "pending": 1,
        "confirmed": 1,
        "cancelled": 0,
        "expired": 0,
    }
    assert stats["revenue"] == "300.00" or float(stats["revenue"]) == 300.0
    assert stats["destinations_total"] == 3 and stats["destinations_visible"] == 2
    assert stats["rooms_total"] == 4 and stats["rooms_active"] == 3 and stats["hotels_total"] == 3


def test_dashboard_revenue_excludes_failed_and_refunded(client, catalog, dates, admin, user1):
    res = book(client, user1, catalog["double"], dates).json()
    client.post(
        f"{API}/payments/dummy",
        json={"reservation_id": res["id"], "outcome": "failure"},
        headers=user1,
    )
    assert float(client.get(f"{API}/admin/dashboard", headers=admin).json()["revenue"]) == 0
    client.post(
        f"{API}/payments/dummy",
        json={"reservation_id": res["id"], "outcome": "success"},
        headers=user1,
    )
    assert float(client.get(f"{API}/admin/dashboard", headers=admin).json()["revenue"]) == 300
    client.post(f"{API}/reservations/{res['id']}/cancel", headers=admin)
    stats = client.get(f"{API}/admin/dashboard", headers=admin).json()
    assert float(stats["revenue"]) == 0 and float(stats["refunded_total"]) == 300
