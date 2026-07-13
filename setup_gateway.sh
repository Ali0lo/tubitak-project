#!/usr/bin/env bash
# Todotak - gateway full implementation
# Run this from the root of your todotak/ repo:
#   bash setup_gateway.sh
set -euo pipefail

echo '==> Creating gateway directories'
mkdir -p "gateway"
mkdir -p "gateway/app"
mkdir -p "gateway/app/config"
mkdir -p "gateway/app/middleware"
mkdir -p "gateway/app/routes"
mkdir -p "gateway/app/services"
mkdir -p "gateway/tests"

echo '==> Writing gateway/.env.example'
cat > "gateway/.env.example" << 'TODOTAK_EOF'
ENVIRONMENT=development
DEBUG=true
SERVICE_NAME=gateway

AUTH_SERVICE_URL=http://auth-service:8000
CORE_SERVICE_URL=http://core-service:8000
AI_SERVICE_URL=http://ai-service:8000
NOTIFICATION_SERVICE_URL=http://notification-service:8000

REDIS_URL=redis://redis:6379/1

REQUEST_TIMEOUT_SECONDS=30.0

RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_SECONDS=60

CORS_ORIGINS=["http://localhost:3000"]
TODOTAK_EOF

echo '==> Writing gateway/Dockerfile'
cat > "gateway/Dockerfile" << 'TODOTAK_EOF'
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
TODOTAK_EOF

echo '==> Writing gateway/app/__init__.py'
cat > "gateway/app/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing gateway/app/config/__init__.py'
cat > "gateway/app/config/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing gateway/app/config/routes_table.py'
cat > "gateway/app/config/routes_table.py" << 'TODOTAK_EOF'
"""Static routing table mapping gateway path prefixes to downstream services.

The gateway does not know about individual endpoints inside each
service; it only needs to know which service owns which top-level
path prefix and forwards everything below that prefix verbatim.
"""
from typing import Dict, Optional, Tuple

from app.config.settings import get_settings

settings = get_settings()

# Ordered so longer/more specific prefixes are matched before shorter
# ones (not strictly required here since prefixes don't overlap, but
# kept explicit for future-proofing).
ROUTE_TABLE: Dict[str, str] = {
    "/api/v1/auth": settings.AUTH_SERVICE_URL,
    "/api/v1/tasks": settings.CORE_SERVICE_URL,
    "/api/v1/meetings": settings.CORE_SERVICE_URL,
    "/api/v1/reminders": settings.CORE_SERVICE_URL,
    "/api/v1/ai": settings.AI_SERVICE_URL,
    "/api/v1/notifications": settings.NOTIFICATION_SERVICE_URL,
}

# Endpoints that must remain reachable without a bearer token, because
# they are how a client obtains one in the first place (or resets a
# forgotten credential). Every other proxied path requires an
# Authorization header to be present before the gateway will forward
# it — final verification of the token itself still happens in the
# owning service.
PUBLIC_PATH_PREFIXES: Tuple[str, ...] = (
    "/api/v1/auth/register",
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
    "/api/v1/auth/password-reset",
)


def resolve_target(path: str) -> Optional[str]:
    """Return the base URL of the downstream service that owns `path`.

    Returns None if no configured prefix matches.
    """
    matches = [prefix for prefix in ROUTE_TABLE if path.startswith(prefix)]
    if not matches:
        return None
    # Prefer the longest matching prefix.
    best = max(matches, key=len)
    return ROUTE_TABLE[best]


def is_public_path(path: str) -> bool:
    """Return True if `path` may be proxied without an Authorization header."""
    return any(path.startswith(prefix) for prefix in PUBLIC_PATH_PREFIXES)
TODOTAK_EOF

echo '==> Writing gateway/app/config/settings.py'
cat > "gateway/app/config/settings.py" << 'TODOTAK_EOF'
"""Application configuration loaded from environment variables."""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the gateway."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    SERVICE_NAME: str = "gateway"

    AUTH_SERVICE_URL: str = "http://auth-service:8000"
    CORE_SERVICE_URL: str = "http://core-service:8000"
    AI_SERVICE_URL: str = "http://ai-service:8000"
    NOTIFICATION_SERVICE_URL: str = "http://notification-service:8000"

    REDIS_URL: str = "redis://localhost:6379/1"

    REQUEST_TIMEOUT_SECONDS: float = 30.0

    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    CORS_ORIGINS: List[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
TODOTAK_EOF

echo '==> Writing gateway/app/exceptions.py'
cat > "gateway/app/exceptions.py" << 'TODOTAK_EOF'
"""Domain-level exceptions for the gateway.

Translated into HTTP responses by the handler registered in
app.middleware.error_handler.
"""


class GatewayError(Exception):
    """Base class for all gateway errors."""

    def __init__(self, message: str, status_code: int = 502) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class UnknownRouteError(GatewayError):
    """Raised when a request path matches no configured downstream service."""

    def __init__(self) -> None:
        super().__init__("No service is registered for this route", status_code=404)


class UnauthenticatedError(GatewayError):
    """Raised when a non-public route is requested without a bearer token."""

    def __init__(self) -> None:
        super().__init__("Authentication required", status_code=401)


class ServiceUnavailableError(GatewayError):
    """Raised when a downstream service cannot be reached."""

    def __init__(self, service_name: str = "downstream service") -> None:
        super().__init__(f"{service_name} is unavailable", status_code=503)


class GatewayTimeoutError(GatewayError):
    """Raised when a downstream service does not respond in time."""

    def __init__(self, service_name: str = "downstream service") -> None:
        super().__init__(f"{service_name} timed out", status_code=504)


class RateLimitExceededError(GatewayError):
    """Raised when a client exceeds the configured request rate."""

    def __init__(self, retry_after_seconds: int) -> None:
        self.retry_after_seconds = retry_after_seconds
        super().__init__("Rate limit exceeded", status_code=429)
TODOTAK_EOF

echo '==> Writing gateway/app/main.py'
cat > "gateway/app/main.py" << 'TODOTAK_EOF'
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
TODOTAK_EOF

echo '==> Writing gateway/app/middleware/__init__.py'
cat > "gateway/app/middleware/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing gateway/app/middleware/error_handler.py'
cat > "gateway/app/middleware/error_handler.py" << 'TODOTAK_EOF'
"""Global exception handlers for the gateway FastAPI app."""
import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.exceptions import GatewayError, RateLimitExceededError

logger = logging.getLogger("gateway")


def register_exception_handlers(app: FastAPI) -> None:
    """Attach domain, validation, and catch-all exception handlers."""

    @app.exception_handler(RateLimitExceededError)
    async def rate_limit_error_handler(
        request: Request, exc: RateLimitExceededError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.message},
            headers={"Retry-After": str(exc.retry_after_seconds)},
        )

    @app.exception_handler(GatewayError)
    async def gateway_error_handler(
        request: Request, exc: GatewayError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code, content={"detail": exc.message}
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"detail": "Validation error", "errors": exc.errors()},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        logger.exception("Unhandled exception in gateway", exc_info=exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )
TODOTAK_EOF

echo '==> Writing gateway/app/middleware/logging.py'
cat > "gateway/app/middleware/logging.py" << 'TODOTAK_EOF'
"""Structured request/response logging middleware."""
import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("gateway.requests")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Logs one line per request with method, path, status, and latency.

    Also stamps a request id onto both the log line and the response
    headers (`X-Request-ID`) so a single request can be traced across
    the gateway and downstream service logs.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        start = time.perf_counter()

        response = await call_next(request)

        duration_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "%s %s -> %s (%.1fms) [%s]",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            request_id,
        )
        return response
TODOTAK_EOF

echo '==> Writing gateway/app/middleware/rate_limit.py'
cat > "gateway/app/middleware/rate_limit.py" << 'TODOTAK_EOF'
"""Rate limiting middleware."""
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

# Paths that are never subject to rate limiting, regardless of client.
_EXEMPT_PATHS = {"/health"}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rejects requests once a client exceeds the configured rate.

    Expects `request.app.state.rate_limiter` to be a RateLimiter
    instance, set up in the application lifespan.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if request.url.path in _EXEMPT_PATHS:
            return await call_next(request)

        rate_limiter = getattr(request.app.state, "rate_limiter", None)
        if rate_limiter is None:
            # Rate limiter not configured (e.g. Redis unavailable at
            # startup in a degraded environment) — fail open rather
            # than blocking all traffic.
            return await call_next(request)

        client_host = request.client.host if request.client else "unknown"
        key = f"ratelimit:{client_host}"

        allowed, retry_after = await rate_limiter.is_allowed(key)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded"},
                headers={"Retry-After": str(retry_after)},
            )

        return await call_next(request)
TODOTAK_EOF

echo '==> Writing gateway/app/routes/__init__.py'
cat > "gateway/app/routes/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing gateway/app/routes/health.py'
cat > "gateway/app/routes/health.py" << 'TODOTAK_EOF'
"""Health check routes."""
import httpx
from fastapi import APIRouter, Request

from app.config.settings import get_settings

router = APIRouter()
settings = get_settings()


@router.get("/health", tags=["health"])
async def health_check() -> dict:
    """Liveness check for the gateway itself."""
    return {"status": "ok", "service": settings.SERVICE_NAME}


@router.get("/health/services", tags=["health"])
async def health_check_services(request: Request) -> dict:
    """Aggregated health check across every downstream service.

    Each downstream is given a short, independent timeout so one slow
    or dead service doesn't stall this endpoint.
    """
    client: httpx.AsyncClient = request.app.state.http_client
    services = {
        "auth-service": settings.AUTH_SERVICE_URL,
        "core-service": settings.CORE_SERVICE_URL,
        "ai-service": settings.AI_SERVICE_URL,
        "notification-service": settings.NOTIFICATION_SERVICE_URL,
    }

    results: dict[str, str] = {}
    for name, base_url in services.items():
        try:
            response = await client.get(f"{base_url}/health", timeout=3.0)
            results[name] = "ok" if response.status_code == 200 else "degraded"
        except httpx.HTTPError:
            results[name] = "unreachable"

    overall = "ok" if all(status == "ok" for status in results.values()) else "degraded"
    return {"status": overall, "services": results}
TODOTAK_EOF

echo '==> Writing gateway/app/routes/proxy.py'
cat > "gateway/app/routes/proxy.py" << 'TODOTAK_EOF'
"""Catch-all reverse-proxy routes.

A single dynamic route captures every request under /api/v1/... and
forwards it to whichever downstream service owns that prefix,
according to app.config.routes_table.
"""
from fastapi import APIRouter, Request, Response

from app.config.routes_table import is_public_path, resolve_target
from app.exceptions import UnauthenticatedError, UnknownRouteError

router = APIRouter()

_PROXY_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]


@router.api_route("/api/v1/{full_path:path}", methods=_PROXY_METHODS)
async def proxy_dispatch(full_path: str, request: Request) -> Response:
    downstream_path = f"/api/v1/{full_path}"

    target_base_url = resolve_target(downstream_path)
    if target_base_url is None:
        raise UnknownRouteError()

    if not is_public_path(downstream_path):
        if "authorization" not in {k.lower() for k in request.headers.keys()}:
            raise UnauthenticatedError()

    proxy_service = request.app.state.proxy_service
    return await proxy_service.forward(request, target_base_url, downstream_path)
TODOTAK_EOF

echo '==> Writing gateway/app/services/__init__.py'
cat > "gateway/app/services/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing gateway/app/services/proxy_service.py'
cat > "gateway/app/services/proxy_service.py" << 'TODOTAK_EOF'
"""Reverse-proxy logic for forwarding requests to downstream services."""
from typing import Mapping

import httpx
from fastapi import Request, Response

from app.exceptions import GatewayTimeoutError, ServiceUnavailableError

# Hop-by-hop / connection-specific headers that must never be forwarded
# as-is between the client, the gateway, and the upstream service.
_EXCLUDED_REQUEST_HEADERS = {"host", "content-length", "connection"}
_EXCLUDED_RESPONSE_HEADERS = {
    "content-encoding",
    "transfer-encoding",
    "connection",
    "content-length",
}


class ProxyService:
    """Forwards an incoming FastAPI Request to a downstream service."""

    def __init__(self, client: httpx.AsyncClient, timeout_seconds: float) -> None:
        self.client = client
        self.timeout_seconds = timeout_seconds

    async def forward(
        self, request: Request, base_url: str, downstream_path: str
    ) -> Response:
        url = f"{base_url.rstrip('/')}{downstream_path}"
        headers = self._filter_request_headers(request.headers)
        body = await request.body()

        try:
            upstream_response = await self.client.request(
                method=request.method,
                url=url,
                headers=headers,
                params=request.query_params,
                content=body,
                timeout=self.timeout_seconds,
            )
        except httpx.TimeoutException as exc:
            raise GatewayTimeoutError(base_url) from exc
        except httpx.HTTPError as exc:
            raise ServiceUnavailableError(base_url) from exc

        return Response(
            content=upstream_response.content,
            status_code=upstream_response.status_code,
            headers=self._filter_response_headers(upstream_response.headers),
            media_type=upstream_response.headers.get("content-type"),
        )

    @staticmethod
    def _filter_request_headers(headers: Mapping[str, str]) -> dict:
        return {
            key: value
            for key, value in headers.items()
            if key.lower() not in _EXCLUDED_REQUEST_HEADERS
        }

    @staticmethod
    def _filter_response_headers(headers: Mapping[str, str]) -> dict:
        return {
            key: value
            for key, value in headers.items()
            if key.lower() not in _EXCLUDED_RESPONSE_HEADERS
        }
TODOTAK_EOF

echo '==> Writing gateway/app/services/rate_limiter.py'
cat > "gateway/app/services/rate_limiter.py" << 'TODOTAK_EOF'
"""Redis-backed fixed-window rate limiter."""
from typing import Tuple

from redis.asyncio import Redis


class RateLimiter:
    """Fixed-window request-rate limiter keyed by an arbitrary string.

    Each call to `is_allowed` increments a Redis counter for `key`. The
    counter's TTL is set on first increment so the window resets
    automatically after `window_seconds`.
    """

    def __init__(
        self, redis_client: Redis, max_requests: int, window_seconds: int
    ) -> None:
        self.redis = redis_client
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def is_allowed(self, key: str) -> Tuple[bool, int]:
        """Return (allowed, retry_after_seconds).

        retry_after_seconds is the number of seconds until the window
        resets; it is meaningful even when allowed is True.
        """
        current = await self.redis.incr(key)
        if current == 1:
            await self.redis.expire(key, self.window_seconds)

        ttl = await self.redis.ttl(key)
        retry_after = ttl if ttl and ttl > 0 else self.window_seconds

        return current <= self.max_requests, retry_after
TODOTAK_EOF

echo '==> Writing gateway/requirements.txt'
cat > "gateway/requirements.txt" << 'TODOTAK_EOF'
fastapi==0.115.0
uvicorn[standard]==0.30.6
httpx==0.27.2
pydantic==2.9.2
pydantic-settings==2.5.2
redis==5.0.8
pytest==8.3.3
pytest-asyncio==0.24.0
asgi-lifespan==2.1.0
fakeredis==2.24.1
TODOTAK_EOF

echo '==> Writing gateway/tests/__init__.py'
cat > "gateway/tests/__init__.py" << 'TODOTAK_EOF'

TODOTAK_EOF

echo '==> Writing gateway/tests/conftest.py'
cat > "gateway/tests/conftest.py" << 'TODOTAK_EOF'
"""Shared pytest fixtures for gateway tests.

The gateway has no database of its own, so these tests run entirely
against test doubles: an httpx.MockTransport standing in for the four
downstream services, and fakeredis standing in for Redis. No external
infrastructure is required to run this suite.
"""
import json
from typing import AsyncGenerator, Callable

import httpx
import pytest
import pytest_asyncio
from asgi_lifespan import LifespanManager
from fakeredis import FakeAsyncRedis
from httpx import ASGITransport, AsyncClient

from app.main import create_app

# Handlers can be overridden per-test by mutating this dict before the
# request is made; see the `backend_responses` fixture.
BackendHandler = Callable[[httpx.Request], httpx.Response]


def _default_handler(request: httpx.Request) -> httpx.Response:
    if request.url.path.endswith("/health"):
        return httpx.Response(200, json={"status": "ok"})
    return httpx.Response(
        200,
        json={"echo": {"method": request.method, "path": request.url.path}},
    )


@pytest.fixture
def backend_responses():
    """A mutable holder so individual tests can swap the mock handler."""
    return {"handler": _default_handler}


@pytest_asyncio.fixture
async def gateway_client(
    backend_responses: dict,
) -> AsyncGenerator[AsyncClient, None]:
    def _dispatch(request: httpx.Request) -> httpx.Response:
        return backend_responses["handler"](request)

    mock_transport = httpx.MockTransport(_dispatch)
    upstream_client = httpx.AsyncClient(transport=mock_transport)
    redis_client = FakeAsyncRedis()

    app = create_app(http_client=upstream_client, redis_client=redis_client)

    async with LifespanManager(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport, base_url="http://testserver"
        ) as client:
            yield client

    await upstream_client.aclose()
    await redis_client.aclose()


def json_body(request: httpx.Request) -> dict:
    return json.loads(request.content or b"{}")
TODOTAK_EOF

echo '==> Writing gateway/tests/test_health.py'
cat > "gateway/tests/test_health.py" << 'TODOTAK_EOF'
"""Tests for gateway health endpoints."""
import httpx
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_gateway_health(gateway_client: AsyncClient) -> None:
    response = await gateway_client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "gateway"


async def test_gateway_health_is_not_rate_limited(
    gateway_client: AsyncClient,
) -> None:
    for _ in range(150):
        response = await gateway_client.get("/health")
        assert response.status_code == 200


async def test_aggregated_health_all_services_ok(
    gateway_client: AsyncClient, backend_responses: dict
) -> None:
    backend_responses["handler"] = lambda request: httpx.Response(
        200, json={"status": "ok"}
    )
    response = await gateway_client.get("/health/services")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert set(body["services"].keys()) == {
        "auth-service",
        "core-service",
        "ai-service",
        "notification-service",
    }
    assert all(v == "ok" for v in body["services"].values())


async def test_aggregated_health_reports_degraded_service(
    gateway_client: AsyncClient, backend_responses: dict
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if "auth-service" in str(request.url):
            return httpx.Response(500)
        return httpx.Response(200, json={"status": "ok"})

    backend_responses["handler"] = handler
    response = await gateway_client.get("/health/services")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "degraded"
    assert body["services"]["auth-service"] == "degraded"
TODOTAK_EOF

echo '==> Writing gateway/tests/test_proxy.py'
cat > "gateway/tests/test_proxy.py" << 'TODOTAK_EOF'
"""Tests for the gateway's reverse-proxy behavior."""
import httpx
import pytest
from httpx import AsyncClient

from tests.conftest import json_body

pytestmark = pytest.mark.asyncio


async def test_proxies_public_auth_route_without_token(
    gateway_client: AsyncClient, backend_responses: dict
) -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["body"] = json_body(request)
        return httpx.Response(201, json={"id": "abc123"})

    backend_responses["handler"] = handler

    response = await gateway_client.post(
        "/api/v1/auth/register",
        json={"email": "a@example.com", "password": "supersecret123"},
    )
    assert response.status_code == 201
    assert response.json() == {"id": "abc123"}
    assert "auth-service" in captured["url"]
    assert captured["body"]["email"] == "a@example.com"


async def test_protected_route_without_token_is_rejected(
    gateway_client: AsyncClient,
) -> None:
    response = await gateway_client.get("/api/v1/tasks")
    assert response.status_code == 401


async def test_protected_route_with_token_is_forwarded(
    gateway_client: AsyncClient, backend_responses: dict
) -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["auth_header"] = request.headers.get("authorization")
        captured["path"] = request.url.path
        return httpx.Response(200, json={"items": [], "total": 0})

    backend_responses["handler"] = handler

    response = await gateway_client.get(
        "/api/v1/tasks", headers={"Authorization": "Bearer faketoken123"}
    )
    assert response.status_code == 200
    assert captured["auth_header"] == "Bearer faketoken123"
    assert captured["path"] == "/api/v1/tasks"


async def test_routes_tasks_and_meetings_to_core_service(
    gateway_client: AsyncClient, backend_responses: dict
) -> None:
    captured_urls = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured_urls.append(str(request.url))
        return httpx.Response(200, json={})

    backend_responses["handler"] = handler
    headers = {"Authorization": "Bearer faketoken123"}

    await gateway_client.get("/api/v1/tasks", headers=headers)
    await gateway_client.get("/api/v1/meetings", headers=headers)
    await gateway_client.get("/api/v1/reminders", headers=headers)

    assert all("core-service" in url for url in captured_urls)


async def test_unknown_route_returns_404(gateway_client: AsyncClient) -> None:
    response = await gateway_client.get(
        "/api/v1/nonexistent-service/whatever",
        headers={"Authorization": "Bearer faketoken123"},
    )
    assert response.status_code == 404


async def test_downstream_failure_returns_503(
    gateway_client: AsyncClient, backend_responses: dict
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused", request=request)

    backend_responses["handler"] = handler

    response = await gateway_client.get(
        "/api/v1/tasks", headers={"Authorization": "Bearer faketoken123"}
    )
    assert response.status_code == 503


async def test_downstream_status_code_is_passed_through(
    gateway_client: AsyncClient, backend_responses: dict
) -> None:
    backend_responses["handler"] = lambda request: httpx.Response(
        404, json={"detail": "Task not found"}
    )

    response = await gateway_client.get(
        "/api/v1/tasks/00000000-0000-0000-0000-000000000000",
        headers={"Authorization": "Bearer faketoken123"},
    )
    assert response.status_code == 404
    assert response.json() == {"detail": "Task not found"}


async def test_query_params_are_forwarded(
    gateway_client: AsyncClient, backend_responses: dict
) -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["query"] = dict(request.url.params)
        return httpx.Response(200, json={"items": [], "total": 0})

    backend_responses["handler"] = handler

    await gateway_client.get(
        "/api/v1/tasks",
        params={"status": "completed", "page": "2"},
        headers={"Authorization": "Bearer faketoken123"},
    )
    assert captured["query"] == {"status": "completed", "page": "2"}
TODOTAK_EOF

echo '==> Writing gateway/tests/test_rate_limit.py'
cat > "gateway/tests/test_rate_limit.py" << 'TODOTAK_EOF'
"""Tests for the gateway's rate limiting behavior."""
import httpx
import pytest
from httpx import AsyncClient

from app.config.settings import get_settings

pytestmark = pytest.mark.asyncio


async def test_requests_within_limit_are_allowed(
    gateway_client: AsyncClient, backend_responses: dict
) -> None:
    backend_responses["handler"] = lambda request: httpx.Response(
        200, json={"status": "ok"}
    )
    settings = get_settings()

    for _ in range(min(5, settings.RATE_LIMIT_REQUESTS)):
        response = await gateway_client.post(
            "/api/v1/auth/login",
            json={"email": "a@example.com", "password": "supersecret123"},
        )
        assert response.status_code == 200


async def test_exceeding_rate_limit_returns_429(
    gateway_client: AsyncClient, backend_responses: dict
) -> None:
    backend_responses["handler"] = lambda request: httpx.Response(
        200, json={"status": "ok"}
    )
    settings = get_settings()

    last_response = None
    for _ in range(settings.RATE_LIMIT_REQUESTS + 5):
        last_response = await gateway_client.post(
            "/api/v1/auth/login",
            json={"email": "a@example.com", "password": "supersecret123"},
        )

    assert last_response.status_code == 429
    assert "Retry-After" in last_response.headers
TODOTAK_EOF

echo '==> gateway files written successfully'
echo 'Next steps:'
echo '  1. cp gateway/.env.example gateway/.env and fill in real values'
echo '  2. cd gateway && pip install -r requirements.txt'
echo '  3. pytest   (runs fully offline against mocked backends + fakeredis)'
echo '  4. uvicorn app.main:app --reload'