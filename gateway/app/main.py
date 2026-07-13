"""Gateway FastAPI application entrypoint."""
from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from redis.asyncio import Redis, from_url

from app.config.settings import get_settings
from app.middleware.error_handler import register_exception_handlers
from app.middleware.logging import RequestLoggingMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.routes.health import router as health_router
from app.routes.proxy import router as proxy_router
from app.services.proxy_service import ProxyService
from app.services.rate_limiter import RateLimiter

settings = get_settings()


def create_app(
    http_client: Optional[httpx.AsyncClient] = None,
    redis_client: Optional[Redis] = None,
) -> FastAPI:
    """Application factory for the gateway.

    `http_client` and `redis_client` may be injected (e.g. in tests to
    supply a mocked httpx transport and a fakeredis instance). When not
    provided, real clients are created and torn down in the lifespan.
    """
    owns_http_client = http_client is None
    owns_redis_client = redis_client is None

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.http_client = http_client or httpx.AsyncClient()
        app.state.redis_client = redis_client or from_url(
            settings.REDIS_URL, decode_responses=True
        )
        app.state.rate_limiter = RateLimiter(
            app.state.redis_client,
            max_requests=settings.RATE_LIMIT_REQUESTS,
            window_seconds=settings.RATE_LIMIT_WINDOW_SECONDS,
        )
        app.state.proxy_service = ProxyService(
            app.state.http_client, settings.REQUEST_TIMEOUT_SECONDS
        )
        yield
        if owns_http_client:
            await app.state.http_client.aclose()
        if owns_redis_client:
            await app.state.redis_client.aclose()

    app = FastAPI(
        title="Todotak Gateway",
        description="Routes client requests to the appropriate microservice.",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(health_router)
    app.include_router(proxy_router)

    return app


app = create_app()
