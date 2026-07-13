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
