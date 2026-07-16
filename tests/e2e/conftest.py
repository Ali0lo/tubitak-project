"""Fixtures for end-to-end tests against a fully running stack.

Unlike every other test suite in this repo, these tests need the
*entire* stack up and reachable — `make up` (or `make prod-up`) first.
They talk to the gateway exactly like a real client would: no
mocking, no direct service access, no database fixtures.

    BASE_URL=http://localhost:8000 pytest tests/e2e -v

BASE_URL defaults to the gateway's dev port. Point it at a deployed
environment's edge (nginx / a real domain) to smoke-test a real
deployment the same way.
"""
import os
import uuid

import httpx
import pytest

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000")


@pytest.fixture(scope="session")
def client():
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as c:
        yield c


@pytest.fixture
def unique_email() -> str:
    return f"e2e-{uuid.uuid4().hex[:12]}@example.com"


@pytest.fixture
def registered_user(client: httpx.Client, unique_email: str) -> dict:
    """Registers a fresh user and returns {email, password, access_token}."""
    password = "e2e-test-password-123"
    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "full_name": "E2E Test User",
            "password": password,
        },
    )
    assert register_response.status_code == 201, register_response.text

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": password},
    )
    assert login_response.status_code == 200, login_response.text
    tokens = login_response.json()

    return {
        "email": unique_email,
        "password": password,
        "access_token": tokens["access_token"],
        "headers": {"Authorization": f"Bearer {tokens['access_token']}"},
    }
