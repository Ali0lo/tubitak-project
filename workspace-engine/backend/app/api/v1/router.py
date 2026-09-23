"""V1 API router aggregation."""
from fastapi import APIRouter

from app.api.v1.blocks import router as blocks_router
from app.api.v1.pages import router as pages_router
from app.api.v1.search import router as search_router
from app.api.v1.storage import router as storage_router
from app.api.v1.workspaces import router as workspaces_router

api_v1_router = APIRouter()
api_v1_router.include_router(workspaces_router)
api_v1_router.include_router(pages_router)
api_v1_router.include_router(blocks_router)
api_v1_router.include_router(search_router)
api_v1_router.include_router(storage_router)
