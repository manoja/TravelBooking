"""Controlled admin bootstrap, run by an operator with database access (never via the API).

    python -m app.scripts.bootstrap_admin --auth0-sub "google-oauth2|1234567890"

The sub must be the verified Auth0 `sub` of the person to promote (visible in the Auth0
dashboard under Users). If the user has already signed in once, their profile is promoted;
otherwise a profile is created with role 'admin' and is completed on first login.
"""

import argparse

from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.user import User


def promote(auth0_sub: str, email: str | None = None, name: str | None = None) -> str:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.auth0_sub == auth0_sub))
        if user is None:
            user = User(
                auth0_sub=auth0_sub,
                email=email or f"{auth0_sub}@auth0.invalid"[:320],
                name=name,
                role="admin",
            )
            db.add(user)
            outcome = "created"
        else:
            user.role = "admin"
            outcome = "promoted"
        db.commit()
        return outcome


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--auth0-sub", required=True)
    parser.add_argument("--email")
    parser.add_argument("--name")
    args = parser.parse_args()
    get_settings().validate_for_runtime()
    print(f"Admin {promote(args.auth0_sub, args.email, args.name)}: {args.auth0_sub}")


if __name__ == "__main__":
    main()
