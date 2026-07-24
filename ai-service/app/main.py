"""AI-service FastAPI application entrypoint."""
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.chat import router as chat_router
from app.api.v1.conversations import router as conversations_router
from app.core.config import get_settings
from app.middleware.exception_handler import register_exception_handlers

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application startup/shutdown hooks."""
    import asyncio
    import logging
    import subprocess

    logger = logging.getLogger("ai-service.startup")
    try:
        def run_alembic():
            res = subprocess.run(["alembic", "upgrade", "head"], capture_output=True, text=True)
            if res.returncode != 0:
                logger.warning(f"Alembic migration warning: {res.stderr}")
            else:
                logger.info("Alembic migrations applied successfully.")

        await asyncio.to_thread(run_alembic)
    except Exception as exc:
        logger.warning(f"Failed to auto-run migrations: {exc}")

    yield


def create_app() -> FastAPI:
    """Application factory for the ai-service."""
    app = FastAPI(
        title="Todotak AI Service",
        description=(
            "Conversational AI assistant that manages tasks, meetings, "
            "and reminders via OpenAI tool calling."
        ),
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
    app.include_router(chat_router, prefix="/api/v1")
    app.include_router(conversations_router, prefix="/api/v1")

    @app.get("/health", tags=["health"])
    async def health_check() -> dict[str, str]:
        return {"status": "ok", "service": settings.SERVICE_NAME}

    return app


app = create_app()
