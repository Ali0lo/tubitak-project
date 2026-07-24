"""Email service for rendering and dispatching email notifications."""
import logging
from typing import Optional

from app.clients.email_client import EmailClient
from app.core.exceptions import EmailDispatchError
from app.templates.notification_email import RenderedEmail, render_reminder_email

logger = logging.getLogger("notification-service.email_service")


class EmailService:
    """High-level service for rendering email content and delivering via EmailClient."""

    def __init__(self, email_client: Optional[EmailClient] = None) -> None:
        self.email_client = email_client or EmailClient()

    async def send_notification_email(
        self, to_email: str, message: str, subject: Optional[str] = None
    ) -> RenderedEmail:
        """Render and dispatch a notification email to the given recipient.

        Args:
            to_email: Target email address.
            message: Plain text notification message content.
            subject: Optional custom subject line.

        Returns:
            RenderedEmail object containing rendered HTML and text.

        Raises:
            EmailDispatchError: If SMTP dispatch fails.
        """
        content = render_reminder_email(message)
        if subject:
            content.subject = subject

        try:
            await self.email_client.send(to_email=to_email, content=content)
            logger.info("Email notification successfully sent to %s", to_email)
        except EmailDispatchError as exc:
            logger.warning("Failed to send email to %s: %s", to_email, exc)
            raise

        return content

    async def send_email(self, to_email: str, content: RenderedEmail) -> None:
        """Directly send a pre-rendered email via EmailClient."""
        await self.email_client.send(to_email=to_email, content=content)
