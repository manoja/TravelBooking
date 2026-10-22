from tests.conftest import API


def test_health(client):
    res = client.get(f"{API}/health")
    assert res.status_code == 200 and res.json() == {"status": "ok"}


def test_database_health(client):
    res = client.get(f"{API}/health/db")
    assert res.status_code == 200 and res.json()["database"] == "ok"


def test_database_health_hides_details_on_failure(client):
    from sqlalchemy.exc import OperationalError

    from app.db.session import get_db
    from app.main import app

    class Broken:
        def execute(self, *_):
            raise OperationalError("SELECT 1", {}, Exception("password=secret host=db.internal"))

    app.dependency_overrides[get_db] = lambda: Broken()
    res = client.get(f"{API}/health/db")
    assert res.status_code == 503
    assert "secret" not in res.text and "internal" not in res.text


def test_openapi_docs_available(client):
    assert client.get("/docs").status_code == 200
    assert client.get("/redoc").status_code == 200
    assert f"{API}/rooms/search" in client.get("/openapi.json").json()["paths"]


def test_unhandled_errors_are_sanitised(client, monkeypatch):
    def boom(*_args, **_kwargs):
        raise RuntimeError("postgresql://user:pw@host/db failed")

    monkeypatch.setattr("app.services.catalog_service.DestinationService.list_items", boom)
    res = client.get(f"{API}/destinations")
    assert res.status_code == 500
    assert res.json() == {"detail": "Internal server error"}


def test_cors_only_allows_configured_origin(client):
    ok = client.options(
        f"{API}/destinations",
        headers={"Origin": "http://localhost:4200", "Access-Control-Request-Method": "GET"},
    )
    bad = client.options(
        f"{API}/destinations",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:4200"
    assert "access-control-allow-origin" not in bad.headers
