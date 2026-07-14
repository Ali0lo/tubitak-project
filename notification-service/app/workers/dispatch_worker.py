"""Blocks on the dispatch queue and sends each notification as it
arrives — email (if enabled) plus marking the row sent.
"""
import asyncio
import logging

from app.clients.auth_service_client import AuthServiceClient
from app.clients.email_client import EmailClient
from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.queue.redis_queue import NotificationQueue
from app.services.dispatch_service import DispatchService

logger = logging.getLogger("notification-service.dispatch_worker")
settings = get_settings()


async def run_dispatch_loop(queue: NotificationQueue) -> None:
    """Run forever: block on the queue, dispatch each id as it appears."""
    email_client = EmailClient()
    auth_client = AuthServiceClient()

    while True:
        try:
            notification_id = await queue.dequeue(
                timeout_seconds=settings.DISPATCH_QUEUE_TIMEOUT_SECONDS
            )
        except Exception:  # noqa: BLE001
            logger.exception("Failed to read from dispatch queue; retrying")
            await asyncio.sleep(1)
            continue

        if notification_id is None:
            continue  # timed out waiting; loop and block again

        try:
            async with AsyncSessionLocal() as db:
                dispatch_service = DispatchService(db, email_client, auth_client)
                await dispatch_service.dispatch(notification_id)
        except Exception:  # noqa: BLE001
            logger.exception(
                "Failed to dispatch notification %s", notification_id
            )
