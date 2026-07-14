"""Redis-backed queue carrying notification ids awaiting dispatch.

The scheduler worker pushes ids onto this queue once a notification's
scheduled_for time arrives; the dispatch worker blocks on it and sends
each notification as it appears. Using a queue rather than pure DB
polling in the dispatch worker means dispatch happens immediately
after the scheduler claims a batch, not on the next poll interval.
"""
import uuid
from typing import Optional

from redis.asyncio import Redis


class NotificationQueue:
    def __init__(self, redis_client: Redis, queue_key: str) -> None:
        self.redis = redis_client
        self.queue_key = queue_key

    async def enqueue(self, notification_id: uuid.UUID) -> None:
        await self.redis.lpush(self.queue_key, str(notification_id))

    async def enqueue_many(self, notification_ids: list[uuid.UUID]) -> None:
        if not notification_ids:
            return
        await self.redis.lpush(
            self.queue_key, *[str(nid) for nid in notification_ids]
        )

    async def dequeue(self, timeout_seconds: float) -> Optional[uuid.UUID]:
        """Block up to timeout_seconds waiting for an id; None on timeout."""
        result = await self.redis.brpop(self.queue_key, timeout=timeout_seconds)
        if result is None:
            return None
        _, raw_id = result
        try:
            return uuid.UUID(
                raw_id.decode() if isinstance(raw_id, bytes) else raw_id
            )
        except ValueError:
            return None
