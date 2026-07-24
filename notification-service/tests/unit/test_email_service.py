"""Unit tests for EmailService, TemplateService, and ReminderService."""
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.clients.email_client import EmailClient
from app.core.exceptions import EmailDispatchError
from app.services.email_service import EmailService
from app.services.template_service import TemplateService
from app.templates.notification_email import RenderedEmail

pytestmark = pytest.mark.asyncio


class FakeEmailClient:
    def __init__(self, should_fail: bool = False) -> None:
        self.should_fail = should_fail
        self.sent = []

    async def send(self, *, to_email: str, content: RenderedEmail) -> None:
        if self.should_fail:
            raise EmailDispatchError("SMTP connection failed")
        self.sent.append((to_email, content))


async def test_email_service_send_notification_email_success() -> None:
    fake_client = FakeEmailClient()
    email_service = EmailService(email_client=fake_client)

    result = await email_service.send_notification_email(
        to_email="test@example.com",
        message="Hello world",
    )

    assert len(fake_client.sent) == 1
    assert fake_client.sent[0][0] == "test@example.com"
    assert result.subject == "Todotak reminder"
    assert "Hello world" in result.text_body


async def test_email_service_send_notification_email_custom_subject() -> None:
    fake_client = FakeEmailClient()
    email_service = EmailService(email_client=fake_client)

    result = await email_service.send_notification_email(
        to_email="test@example.com",
        message="Verification code: 123456",
        subject="Verify your email",
    )

    assert len(fake_client.sent) == 1
    assert result.subject == "Verify your email"


async def test_email_service_raises_on_failure() -> None:
    fake_client = FakeEmailClient(should_fail=True)
    email_service = EmailService(email_client=fake_client)

    with pytest.raises(EmailDispatchError):
        await email_service.send_notification_email(
            to_email="test@example.com",
            message="Fail test",
        )


async def test_template_service_render_reminder() -> None:
    rendered = TemplateService.render_reminder("Task due soon", subject="Reminder")
    assert rendered.subject == "Reminder"
    assert "Task due soon" in rendered.text_body


async def test_template_service_render_notification() -> None:
    rendered = TemplateService.render_notification("Notice message", title="System Alert")
    assert rendered.subject == "System Alert"
    assert "Notice message" in rendered.text_body
