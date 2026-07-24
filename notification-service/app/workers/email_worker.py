"""Worker process task for consuming and processing email notification dispatch queue."""
import logging

from app.queue.redis_queue import NotificationQueue
from app.workers.dispatch_worker import run_dispatch_loop

logger = logging.getLogger("notification-service.email_worker")


async def run_email_worker(queue: NotificationQueue) -> None:
    """Run email dispatch loop."""
    logger.info("Starting email dispatch worker loop")
    await run_dispatch_loop(queue)
