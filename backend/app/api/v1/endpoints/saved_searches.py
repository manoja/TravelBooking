from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.booking import SavedSearchCreate, SavedSearchRead
from app.schemas.catalog import RoomDetail
from app.schemas.common import Page, PageParams
from app.services.saved_search_service import SavedSearchService

router = APIRouter(prefix="/saved-searches", tags=["saved-searches"])


@router.get("", response_model=Page[SavedSearchRead])
def list_saved_searches(params: Annotated[PageParams, Query()], user: CurrentUser, db: DbSession):
    return SavedSearchService(db).list_items(user, params)


@router.post("", response_model=SavedSearchRead, status_code=status.HTTP_201_CREATED)
def create_saved_search(data: SavedSearchCreate, user: CurrentUser, db: DbSession):
    return SavedSearchService(db).create(user, data)


@router.get("/{search_id}", response_model=SavedSearchRead)
def get_saved_search(search_id: int, user: CurrentUser, db: DbSession):
    return SavedSearchService(db).get(user, search_id)


@router.post("/{search_id}/run", response_model=Page[RoomDetail])
def run_saved_search(
    search_id: int,
    params: Annotated[PageParams, Query()],
    user: CurrentUser,
    db: DbSession,
):
    return SavedSearchService(db).run(user, search_id, params)


@router.delete("/{search_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_search(search_id: int, user: CurrentUser, db: DbSession):
    SavedSearchService(db).delete(user, search_id)
