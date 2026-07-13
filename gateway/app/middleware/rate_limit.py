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
