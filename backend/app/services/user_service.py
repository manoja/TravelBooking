import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import fetch_userinfo
from app.models.user import User

logger = logging.getLogger(__name__)


class UserService:
    def __init__(self, db: Session):
        self.db = db

    def get_or_create(self, claims: dict, token: str) -> User:
        """Find the profile by verified Auth0 subject; new profiles are always role 'user'."""
        sub = claims["sub"]
        user = self.db.scalar(select(User).where(User.auth0_sub == sub))
        if user is not None:
            return user

        email, name = claims.get("email"), claims.get("name")
        if not email:
            info = fetch_userinfo(token)
            email, name = info.get("email"), name or info.get("name")
        email = email or f"{sub.replace('@', '_')}@auth0.invalid"
        # The live schema requires a non-null name, so fall back to the email local part.
        display_name = (name or email.split("@")[0] or "User")[:150]
        user = User(auth0_sub=sub, email=email[:320], name=display_name, role="user")
        self.db.add(user)
        try:
            self.db.commit()
        except IntegrityError:
            # A concurrent first request created the same profile.
            self.db.rollback()
            user = self.db.scalar(select(User).where(User.auth0_sub == sub))
            if user is None:
                raise
        return user
