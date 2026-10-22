from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import DbSession
from app.schemas.catalog import DestinationQuery, DestinationRead
from app.schemas.common import Page
from app.services.catalog_service import DestinationService

router = APIRouter(prefix="/destinations", tags=["destinations"])


@router.get("", response_model=Page[DestinationRead])
def list_destinations(query: Annotated[DestinationQuery, Query()], db: DbSession):
    return DestinationService(db).list_items(query)


@router.get("/{destination_id}", response_model=DestinationRead)
def get_destination(destination_id: int, db: DbSession):
    return DestinationService(db).get(destination_id)
