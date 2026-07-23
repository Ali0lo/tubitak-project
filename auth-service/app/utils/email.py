"""Email delivery utilities (SMTP)."""
import logging
from email.message import EmailMessage
from typing import Optional

import aiosmtplib

from app.config.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def send_email(
    *, to: str, subject: str, html_body: str, text_body: Optional[str] = None
) -> None:
    """Send an email via SMTP.

    Errors are logged and swallowed so a flaky mail provider never
    breaks the request/response cycle for register/login/etc.
    """
    message = EmailMessage()
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = to
    message["Subject"] = subject
    message.set_content(
        text_body or "Please view this email in an HTML-capable client."
    )
    message.add_alternative(html_body, subtype="html")

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USERNAME,
            password=settings.SMTP_PASSWORD,
            start_tls=settings.SMTP_USE_TLS,
        )
    except Exception:
        logger.exception("Failed to send email to %s", to)


async def send_verification_email(*, to: str, raw_token: str) -> None:
    link = f"{settings.FRONTEND_URL}/verify-email?token={raw_token}"
    await send_email(
        to=to,
        subject="Verify your Todotak account",
        html_body=(
            "<p>Welcome to Todotak.</p>"
            "<p>Click below to verify your email address:</p>"
            f'<p><a href="{link}">Verify email</a></p>'
            "<p>This link expires in 24 hours.</p>"
        ),
        text_body=f"Verify your email: {link}",
    )


async def send_password_reset_email(*, to: str, raw_token: str) -> None:
    link = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"
    await send_email(
        to=to,
        subject="Reset your Todotak password",
        html_body=(
            "<p>We received a request to reset your password.</p>"
            f'<p><a href="{link}">Reset password</a></p>'
            "<p>If you didn't request this, ignore this email.</p>"
        ),
        text_body=f"Reset your password: {link}",
    )