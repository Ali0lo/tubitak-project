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
    import subprocess  # nosec B404

    logger = logging.getLogger("ai-service.startup")
    try:

        def run_alembic():
            res = subprocess.run(  # nosec B603, B607
                ["alembic", "upgrade", "head"], capture_output=True, text=True
            )
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
            "Autonomous AI Productivity Agent that manages tasks, meetings, "
            "and reminders via tool calling.\n\n"
            "### LLM Engine Support\n"
            "- **Cloud OpenAI**: Defaults to `gpt-4o` with native tool calling.\n"
            "- **Local LLM (Ollama & vLLM)**: Fully supports self-hosted local models "
            "(e.g., `llama3.1`, `qwen2.5`, `mistral`) via OpenAI-compatible endpoints.\n"
            "- **Graceful Tool Degradation**: Automatically falls back to prompt-guided JSON tool calling "
            "if the local model does not natively support the OpenAI tools parameter.\n"
            "- **Fault Tolerance**: Automatic fallback to cloud OpenAI if local LLM is unreachable.\n\n"
            "### Configuration Options\n"
            "- `LLM_PROVIDER`: `auto` | `openai` | `local` | `ollama` | `vllm`\n"
            "- `LOCAL_LLM_URL`: Base URL for local inference (e.g. `http://host.docker.internal:11434/v1`)\n"
            "- `LOCAL_LLM_MODEL`: Model name (default `llama3.1`)\n"
            "- `LOCAL_LLM_API_KEY`: Dummy auth header for OpenAI SDK (default `ollama`)\n"
            "- `FALLBACK_TO_OPENAI`: Boolean (default `true`)"
        ),
        version="1.1.0",
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
    async def health_check() -> dict:
        from app.clients.openai_client import OpenAIClient

        client = OpenAIClient()
        return {
            "status": "ok",
            "service": settings.SERVICE_NAME,
            "llm_provider": client.provider,
            "llm_model": client.model,
            "is_local": client.is_local,
            "base_url": client.base_url,
        }

    return app


app = create_app()
