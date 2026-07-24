"""SMTP-based email sender.

smtplib is synchronous; calls are offloaded to a thread via
asyncio.to_thread so they don't block the event loop.
"""
import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

from app.core.config import get_settings
from app.core.exceptions import EmailDispatchError
from app.templates.notification_email import RenderedEmail

logger = logging.getLogger("notification-service.email")
settings = get_settings()


class EmailClient:
    """Sends transactional email via SMTP."""

    def __init__(
        self,
        host: str | None = None,
        port: int | None = None,
        username: str | None = None,
        password: str | None = None,
        use_tls: bool | None = None,
        from_email: str | None = None,
        from_name: str | None = None,
        timeout: float | None = None,
    ) -> None:
        self.host = host or settings.SMTP_HOST
        self.port = port if port is not None else settings.SMTP_PORT
        self.username = username if username is not None else settings.SMTP_USERNAME
        self.password = password if password is not None else settings.SMTP_PASSWORD
        self.use_tls = use_tls if use_tls is not None else settings.SMTP_USE_TLS
        self.from_email = from_email or settings.SMTP_FROM_EMAIL
        self.from_name = from_name or settings.SMTP_FROM_NAME
        self.timeout = timeout or settings.SMTP_TIMEOUT_SECONDS

    async def send(self, *, to_email: str, content: RenderedEmail) -> None:
        try:
            await asyncio.to_thread(self._send_sync, to_email, content)
        except (smtplib.SMTPException, OSError, TimeoutError) as exc:
            logger.warning("Failed to send email to %s: %s", to_email, exc)
            raise EmailDispatchError(str(exc)) from exc

    def _send_sync(self, to_email: str, content: RenderedEmail) -> None:
        message = MIMEMultipart("alternative")
        message["Subject"] = content.subject
        message["From"] = formataddr((self.from_name, self.from_email))
        message["To"] = to_email
        message.attach(MIMEText(content.text_body, "plain"))
        message.attach(MIMEText(content.html_body, "html"))

        with smtplib.SMTP(self.host, self.port, timeout=self.timeout) as server:
            if self.use_tls:
                server.starttls()
            if self.username and self.password:
                server.login(self.username, self.password)
            server.sendmail(self.from_email, [to_email], message.as_string())
            logger.info("Dispatched notification email to %s with subject: %s", to_email, content.subject)
