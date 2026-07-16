"""Helper for auth-enforcement sweeps.

Spins up a service's real FastAPI app in an isolated subprocess (same
reasoning as tests/contracts/helpers.py: every service's top-level
package is named `app`, so this can't happen in the parent process
without collisions) and fires a list of unauthenticated requests at
it, reporting back the status code each one got.

The database dependency is overridden with a no-op stand-in — safe
because in every route under test, the auth dependency is expected to
reject the request before any code that would actually touch the
database session runs. If that assumption is ever wrong for a given
route, the request fails with a 500 (unhandled exception trying to use
a None session) rather than silently passing, which is itself a useful
signal.
"""
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import List, Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parents[2]

BASE_ENV = {
    "DATABASE_URL": "postgresql+asyncpg://user:pass@localhost:5432/unused",
    "JWT_SECRET_KEY": "security-test-secret",
    "INTERNAL_SERVICE_API_KEY": "security-test-internal-key",
    "OPENAI_API_KEY": "sk-security-test-not-real",
}

DUMMY_UUID = "00000000-0000-0000-0000-000000000000"


def sweep_unauthenticated_requests(
    service: str,
    db_module: str,
    db_symbol: str,
    requests: List[Tuple[str, str]],
    extra_env: Optional[dict] = None,
) -> List[dict]:
    """requests: list of (method, path) tuples, path already concrete
    (use helpers.DUMMY_UUID for any {id} segments).

    Returns a list of {"method", "path", "status"} dicts.
    """
    requests_json = json.dumps(requests)
    script = f"""
import asyncio, json
from httpx import ASGITransport, AsyncClient
from app.main import create_app
from {db_module} import {db_symbol}

async def _fake_db():
    yield None

app = create_app()
app.dependency_overrides[{db_symbol}] = _fake_db

REQUESTS = json.loads({requests_json!r})

async def main():
    results = []
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for method, path in REQUESTS:
            body = {{}} if method.upper() in ("POST", "PATCH", "PUT") else None
            response = await client.request(method.upper(), path, json=body)
            results.append({{"method": method, "path": path, "status": response.status_code}})
    print(json.dumps(results))

asyncio.run(main())
"""
    env = {**os.environ, **BASE_ENV, **(extra_env or {})}
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=str(REPO_ROOT / service),
        capture_output=True,
        text=True,
        env=env,
        timeout=30,
    )
    if result.returncode != 0:
        raise AssertionError(
            f"Sweep subprocess for {service} failed:\n"
            f"--- stdout ---\n{result.stdout}\n--- stderr ---\n{result.stderr}"
        )
    return json.loads(result.stdout.strip().splitlines()[-1])
