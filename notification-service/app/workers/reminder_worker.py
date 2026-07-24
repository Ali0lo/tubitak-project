"""Worker process task for consuming and processing reminder notifications."""
import logging

from app.queue.redis_queue import NotificationQueue
from app.workers.scheduler_worker import run_scheduler_loop

logger = logging.getLogger("notification-service.reminder_worker")


async def run_reminder_worker(queue: NotificationQueue) -> None:
    """Run reminder scheduler worker loop."""
    logger.info("Starting reminder worker loop")
    await run_scheduler_loop(queue)
