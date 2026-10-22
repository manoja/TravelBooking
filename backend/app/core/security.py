import logging
from functools import lru_cache

import httpx
import jwt
from jwt import PyJWKClient

from app.core.config import get_settings
from app.core.exceptions import Unauthorized

logger = logging.getLogger(__name__)


@lru_cache
def _jwks_client() -> PyJWKClient:
    settings = get_settings()
    return PyJWKClient(
        f"https://{settings.auth0_domain}/.well-known/jwks.json", cache_keys=True, lifespan=3600
    )


def get_signing_key(token: str):
    return _jwks_client().get_signing_key_from_jwt(token).key


def verify_access_token(token: str) -> dict:
    """Validate signature, algorithm, issuer, audience and expiry of an Auth0 access token."""
    settings = get_settings()
    try:
        header = jwt.get_unverified_header(token)
        if header.get("alg") not in settings.auth0_algorithms:
            raise Unauthorized("Invalid or expired token")
        return jwt.decode(
            token,
            get_signing_key(token),
            algorithms=settings.auth0_algorithms,
            audience=settings.auth0_audience,
            issuer=settings.issuer,
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
    except jwt.PyJWTError as exc:
        logger.info("Access token rejected: %s", type(exc).__name__)
        raise Unauthorized("Invalid or expired token") from exc


def fetch_userinfo(token: str) -> dict:
    """Auth0 access tokens often omit the email; ask Auth0 using the caller's own token."""
    settings = get_settings()
    try:
        response = httpx.get(
            f"https://{settings.auth0_domain}/userinfo",
            headers={"Authorization": f"Bearer {token}"},
            timeout=3.0,
        )
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError):
        logger.warning("Could not fetch Auth0 userinfo")
        return {}
