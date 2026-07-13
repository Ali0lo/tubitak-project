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
