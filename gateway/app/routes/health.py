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
