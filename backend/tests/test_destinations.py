from tests.conftest import API


def test_list_only_visible_destinations_with_pagination(client, catalog):
    res = client.get(f"{API}/destinations")
    body = res.json()
    assert [d["slug"] for d in body["items"]] == ["paris", "rome"]
    assert (body["total"], body["page"], body["page_size"], body["total_pages"]) == (2, 1, 20, 1)

    page2 = client.get(f"{API}/destinations", params={"page": 2, "page_size": 1}).json()
    assert [d["slug"] for d in page2["items"]] == ["rome"] and page2["total_pages"] == 2


def test_destination_search_and_wildcard_escaping(client, catalog):
    assert client.get(f"{API}/destinations", params={"q": "par"}).json()["total"] == 1
    assert client.get(f"{API}/destinations", params={"q": "%"}).json()["total"] == 0
    assert client.get(f"{API}/destinations", params={"q": "nothing"}).json()["items"] == []


def test_invalid_pagination(client):
    for params in ({"page": 0}, {"page_size": 0}, {"page_size": 101}, {"page": "x"}):
        assert client.get(f"{API}/destinations", params=params).status_code == 422


def test_destination_details_and_missing(client, catalog):
    assert client.get(f"{API}/destinations/{catalog['paris']}").json()["name"] == "Paris"
    assert client.get(f"{API}/destinations/{catalog['hidden_destination']}").status_code == 404
    assert client.get(f"{API}/destinations/99999").status_code == 404
    assert client.get(f"{API}/destinations/abc").status_code == 422


def test_hotels_hide_hidden_hotels_and_destinations(client, catalog):
    names = [h["name"] for h in client.get(f"{API}/hotels").json()["items"]]
    assert names == ["Hotel Lumiere"]
    by_dest = client.get(f"{API}/hotels", params={"destination_id": catalog["paris"]}).json()
    assert by_dest["total"] == 1
    assert client.get(f"{API}/hotels", params={"q": "lumi"}).json()["total"] == 1
    assert client.get(f"{API}/hotels/{catalog['hidden_hotel']}").status_code == 404
    assert client.get(f"{API}/hotels/{catalog['secret_hotel']}").status_code == 404


def test_hotel_details_include_only_active_rooms(client, catalog):
    body = client.get(f"{API}/hotels/{catalog['hotel']}").json()
    assert body["destination"]["slug"] == "paris"
    assert [r["name"] for r in body["rooms"]] == ["Double", "Suite"]
    assert [i["sort_order"] for i in body["rooms"][0]["images"]] == [1, 2]
