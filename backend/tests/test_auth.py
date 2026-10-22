import pytest

from app.models import User
from tests.conftest import _OTHER_KEY, API, headers_for, make_token


def test_me_creates_profile_with_user_role(client, session_factory, user1):
    res = client.get(f"{API}/auth/me", headers=user1)
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == "user1@example.com" and body["role"] == "user"
    assert set(body) == {"id", "email", "name", "role"}
    again = client.get(f"{API}/auth/me", headers=user1).json()
    assert again["id"] == body["id"]
    with session_factory() as db:
        assert db.query(User).count() == 1


def test_role_claims_in_token_never_grant_admin(client):
    token_headers = headers_for(
        "auth0|sneaky", role="admin", roles=["admin"], **{"https://x/roles": ["admin"]}
    )
    assert client.get(f"{API}/auth/me", headers=token_headers).json()["role"] == "user"
    assert (
        client.post(
            f"{API}/admin/destinations", json={"name": "X"}, headers=token_headers
        ).status_code
        == 403
    )


def test_missing_email_falls_back_to_userinfo(client, monkeypatch):
    monkeypatch.setattr(
        "app.services.user_service.fetch_userinfo",
        lambda token: {"email": "info@example.com", "name": "From Userinfo"},
    )
    res = client.get(f"{API}/auth/me", headers=headers_for("auth0|noemail", email=None, name=None))
    assert res.json()["email"] == "info@example.com"


def test_requires_authentication(client):
    res = client.get(f"{API}/auth/me")
    assert res.status_code == 401 and res.headers["www-authenticate"] == "Bearer"
    assert client.get(f"{API}/reservations/me").status_code == 401
    assert client.get(f"{API}/saved-searches").status_code == 401


@pytest.mark.parametrize(
    "overrides",
    [
        {"exp": 1},
        {"aud": "https://other-api"},
        {"iss": "https://evil.example/"},
        {"exp": None},
        {"sub": None},
    ],
    ids=["expired", "wrong-audience", "wrong-issuer", "no-exp", "no-sub"],
)
def test_invalid_claims_rejected(client, overrides):
    token = make_token(**{"sub": "auth0|x", **overrides})
    res = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_bad_signature_rejected(client):
    token = make_token(key=_OTHER_KEY)
    assert (
        client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code
        == 401
    )


def test_disallowed_algorithm_rejected(client):
    token = make_token(key="a-shared-secret-that-is-long-enough-for-hs256", algorithm="HS256")
    assert (
        client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code
        == 401
    )


def test_garbage_token_rejected(client):
    assert client.get(f"{API}/auth/me", headers={"Authorization": "Bearer nope"}).status_code == 401
