"""Unit tests for EmailClient.

Stubs out smtplib.SMTP entirely, so these run with no real SMTP server,
database, or network access.
"""
import os
import smtplib

import pytest

os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-unit-tests-only")
os.environ.setdefault("INTERNAL_SERVICE_API_KEY", "test-internal-key")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/unused"
)

from app.clients.email_client import EmailClient  # noqa: E402
from app.core.exceptions import EmailDispatchError  # noqa: E402
from app.templates.notification_email import render_reminder_email  # noqa: E402

pytestmark = pytest.mark.asyncio


class FakeSMTP:
    """Stand-in for smtplib.SMTP capturing calls instead of connecting."""

    instances: list["FakeSMTP"] = []

    def __init__(self, host, port, timeout=None):
        self.host = host
        self.port = port
        self.started_tls = False
        self.login_args = None
        self.sent = None
        FakeSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        return False

    def starttls(self):
        self.started_tls = True

    def login(self, username, password):
        self.login_args = (username, password)

    def sendmail(self, from_addr, to_addrs, message):
        self.sent = (from_addr, to_addrs, message)


class RaisingSMTP(FakeSMTP):
    def sendmail(self, from_addr, to_addrs, message):
        raise smtplib.SMTPException("mailbox full")


@pytest.fixture(autouse=True)
def reset_instances():
    FakeSMTP.instances.clear()
    yield
    FakeSMTP.instances.clear()


async def test_send_uses_configured_host_and_port(monkeypatch) -> None:
    monkeypatch.setattr("app.clients.email_client.smtplib.SMTP", FakeSMTP)
    client = EmailClient(
        host="smtp.example.com", port=2525, use_tls=False, from_email="a@x.com"
    )

    await client.send(
        to_email="user@example.com", content=render_reminder_email("hi")
    )

    assert len(FakeSMTP.instances) == 1
    assert FakeSMTP.instances[0].host == "smtp.example.com"
    assert FakeSMTP.instances[0].port == 2525


async def test_send_starts_tls_when_enabled(monkeypatch) -> None:
    monkeypatch.setattr("app.clients.email_client.smtplib.SMTP", FakeSMTP)
    client = EmailClient(use_tls=True)

    await client.send(
        to_email="user@example.com", content=render_reminder_email("hi")
    )

    assert FakeSMTP.instances[0].started_tls is True


async def test_send_logs_in_when_credentials_provided(monkeypatch) -> None:
    monkeypatch.setattr("app.clients.email_client.smtplib.SMTP", FakeSMTP)
    client = EmailClient(username="user", password="pass", use_tls=False)

    await client.send(
        to_email="user@example.com", content=render_reminder_email("hi")
    )

    assert FakeSMTP.instances[0].login_args == ("user", "pass")


async def test_send_delivers_to_the_given_recipient(monkeypatch) -> None:
    monkeypatch.setattr("app.clients.email_client.smtplib.SMTP", FakeSMTP)
    client = EmailClient(use_tls=False)

    await client.send(
        to_email="recipient@example.com",
        content=render_reminder_email("Don't forget"),
    )

    from_addr, to_addrs, message = FakeSMTP.instances[0].sent
    assert to_addrs == ["recipient@example.com"]
    assert "Don't forget" in message


async def test_send_raises_email_dispatch_error_on_smtp_failure(monkeypatch) -> None:
    monkeypatch.setattr("app.clients.email_client.smtplib.SMTP", RaisingSMTP)
    client = EmailClient(use_tls=False)

    with pytest.raises(EmailDispatchError):
        await client.send(
            to_email="user@example.com", content=render_reminder_email("hi")
        )
