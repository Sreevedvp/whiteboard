from fastapi import APIRouter
from app.api.v1.endpoints import elements, ws

api_router = APIRouter()
api_router.include_router(elements.router, tags=["elements"])
api_router.include_router(ws.router, tags=["realtime"])
