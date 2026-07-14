"""Entrypoint for the notification-service worker process.

Run as a separate process/container from the HTTP API, e.g.:

    python -m app.workers.run

Both loops run concurrently in one process since they're both
lightweight and I/O-bound; split them into separate processes later
if either becomes a bottleneck.
"""
import asyncio
import logging

from redis.asyncio import from_url

from app.core.config import get_settings
from app.queue.redis_queue import NotificationQueue
from app.workers.dispatch_worker import run_dispatch_loop
from app.workers.scheduler_worker import run_scheduler_loop

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("notification-service.worker")
settings = get_settings()


async def main() -> None:
    redis_client = from_url(settings.REDIS_URL, decode_responses=True)
    queue = NotificationQueue(redis_client, settings.NOTIFICATION_QUEUE_KEY)

    logger.info("Starting notification-service worker (scheduler + dispatch)")
    try:
        await asyncio.gather(
            run_scheduler_loop(queue),
            run_dispatch_loop(queue),
        )
    finally:
        await redis_client.aclose()


if __name__ == "__main__":
    asyncio.run(main())
