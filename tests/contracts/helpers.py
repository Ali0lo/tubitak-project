"""Shared helpers for cross-service contract tests.

Every service's top-level Python package is named `app`, so two
services can never be imported directly in the same interpreter
without one shadowing the other. Each helper here runs a small
subprocess with exactly one service directory on `sys.path`,
sidestepping that collision entirely — and, as a side effect, means
these tests exercise each service's *actual* code (client payload
construction, real Pydantic models) rather than a hand-maintained
copy of what the contract is supposed to be.

None of this requires a database or network access: importing a
schema or a client class doesn't connect to anything, it just
constructs Settings() (which needs syntactically-plausible env vars,
not a reachable database) and defines classes.
"""
import json
import subprocess
import sys
from pathlib import Path
from typing import Optional

REPO_ROOT = Path(__file__).resolve().parents[2]

# Baseline env vars every service's Settings() needs to construct
# without error. Individual calls can extend this via `extra_env`.
BASE_ENV = {
    "DATABASE_URL": "postgresql+asyncpg://user:pass@localhost:5432/unused",
    "JWT_SECRET_KEY": "contract-test-secret",
    "INTERNAL_SERVICE_API_KEY": "contract-test-internal-key",
    "OPENAI_API_KEY": "sk-contract-test-not-real",
}


def run_script(service: str, script: str, extra_env: Optional[dict] = None) -> str:
    service_dir = REPO_ROOT / service
    import os

    env = {**os.environ, **BASE_ENV, **(extra_env or {})}
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=str(service_dir),
        capture_output=True,
        text=True,
        env=env,
        timeout=30,
    )
    if result.returncode != 0:
        raise AssertionError(
            f"Subprocess for service={service!r} failed "
            f"(exit {result.returncode}):\n"
            f"--- stdout ---\n{result.stdout}\n"
            f"--- stderr ---\n{result.stderr}"
        )
    return result.stdout.strip()


def capture_client_payload(
    service: str, setup_script: str, extra_env: Optional[dict] = None
) -> dict:
    """Run `setup_script` (which must print exactly one JSON line to
    stdout — the payload a client built) inside `service`'s own
    directory/interpreter, and return the parsed payload.
    """
    output = run_script(service, setup_script, extra_env)
    last_line = output.splitlines()[-1]
    return json.loads(last_line)


def validate_payload_against_model(
    service: str,
    module_path: str,
    class_name: str,
    payload: dict,
    extra_env: Optional[dict] = None,
) -> None:
    """Assert that `payload` validates against `class_name` (a Pydantic
    model) importable as `module_path` inside `service`. Raises
    AssertionError with the validation error if it doesn't.
    """
    script = f"""
import json
from {module_path} import {class_name}
payload = json.loads({json.dumps(json.dumps(payload))})
{class_name}(**payload)
print("VALID")
"""
    output = run_script(service, script, extra_env)
    if "VALID" not in output:
        raise AssertionError(f"Payload did not validate:\n{output}")


def get_json_schema(
    service: str,
    module_path: str,
    class_name: str,
    extra_env: Optional[dict] = None,
) -> dict:
    """Return the JSON schema of a Pydantic model defined in another service."""
    script = f"""
import json
from {module_path} import {class_name}
print(json.dumps({class_name}.model_json_schema()))
"""
    output = run_script(service, script, extra_env)
    return json.loads(output.splitlines()[-1])


def get_route_paths(service: str, extra_env: Optional[dict] = None) -> list:
    """Return every route path registered on a service's FastAPI app.

    Reads app.openapi()["paths"] rather than walking app.routes
    directly — the installed FastAPI version wraps included routers
    such that top-level app.routes entries for them don't expose a
    plain `.path` attribute, while the generated OpenAPI schema always
    reflects the real, final route table regardless of that detail.
    """
    script = """
import json
from app.main import create_app
app = create_app()
print(json.dumps(sorted(app.openapi()["paths"].keys())))
"""
    output = run_script(service, script, extra_env)
    return json.loads(output.splitlines()[-1])


def run_with_captured_http_call(
    service: str, call_body: str, extra_env: Optional[dict] = None
) -> dict:
    """Execute `call_body` (the indented body of an `async def main():`
    that awaits some client method) with httpx.AsyncClient
    transparently mocked, and return the single outgoing request that
    was made: {"payload": ..., "headers": ..., "url": ...}.

    This exercises each client's *actual* payload-construction code
    rather than a hand-copied reimplementation of what it's supposed
    to send — the whole point of a contract test.
    """
    script = f"""
import asyncio, json
import httpx

captured = {{}}

def _handler(request):
    captured["payload"] = json.loads(request.content or b"{{}}")
    captured["headers"] = dict(request.headers)
    captured["url"] = str(request.url)
    return httpx.Response(200, json={{}})

_original_async_client = httpx.AsyncClient
def _patched_async_client(*args, **kwargs):
    kwargs["transport"] = httpx.MockTransport(_handler)
    return _original_async_client(*args, **kwargs)
httpx.AsyncClient = _patched_async_client

async def main():
{call_body}

asyncio.run(main())
print(json.dumps(captured))
"""
    output = run_script(service, script, extra_env)
    return json.loads(output.splitlines()[-1])
