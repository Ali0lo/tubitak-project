"""Periodically claims notifications whose scheduled_for time has
arrived and pushes them onto the dispatch queue.

Runs as an independent long-lived loop, separate from both the HTTP
API process and the dispatch worker, so a slow SMTP server never
delays claiming newly-due notifications.
"""
import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.queue.redis_queue import NotificationQueue
from app.repositories.notification_repository import NotificationRepository

logger = logging.getLogger("notification-service.scheduler_worker")
settings = get_settings()


async def run_scheduler_once(db: AsyncSession, queue: NotificationQueue) -> int:
    """Claim one batch of due notifications and enqueue them.

    Returns the number of notifications claimed, for logging/tests.
    """
    repository = NotificationRepository(db)
    claimed_ids = await repository.claim_due(
        before=datetime.now(timezone.utc),
        limit=settings.SCHEDULER_BATCH_SIZE,
    )
    if claimed_ids:
        await queue.enqueue_many(claimed_ids)
        logger.info("Claimed and enqueued %d due notification(s)", len(claimed_ids))
    return len(claimed_ids)


async def run_scheduler_loop(queue: NotificationQueue) -> None:
    """Run run_scheduler_once forever, sleeping between polls."""
    while True:
        try:
            async with AsyncSessionLocal() as db:
                await run_scheduler_once(db, queue)
        except Exception:  # noqa: BLE001
            logger.exception("Scheduler poll failed; will retry next interval")
        await asyncio.sleep(settings.SCHEDULER_POLL_INTERVAL_SECONDS)
