"""Notification-service FastAPI application entrypoint.

This process serves the HTTP API only. The scheduler and dispatch
loops that actually send notifications run as a separate process —
see app/workers/run.py — started with its own command (e.g. a second
container from the same image).
"""
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.notifications import router as notifications_router
from app.api.v1.preferences import router as preferences_router
from app.core.config import get_settings
from app.core.exception_handlers import register_exception_handlers

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Todotak Notification Service",
        description="Schedules and dispatches task/meeting reminder notifications.",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(notifications_router, prefix="/api/v1")
    app.include_router(preferences_router, prefix="/api/v1")

    @app.get("/health", tags=["health"])
    async def health_check() -> dict[str, str]:
        return {"status": "ok", "service": settings.SERVICE_NAME}

    return app


app = create_app()
