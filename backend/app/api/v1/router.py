from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin,
    auth,
    destinations,
    health,
    hotels,
    payments,
    reservations,
    rooms,
    saved_searches,
)

api_router = APIRouter()
for module in (
    health,
    auth,
    destinations,
    hotels,
    rooms,
    reservations,
    payments,
    saved_searches,
    admin,
):
    api_router.include_router(module.router)
