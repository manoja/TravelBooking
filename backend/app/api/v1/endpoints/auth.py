from fastapi import APIRouter

from app.api.deps import CurrentUser
from app.schemas.booking import UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserRead)
def me(user: CurrentUser):
    return user
