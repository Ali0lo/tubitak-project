"""Unit tests for notification email rendering."""
from app.templates.notification_email import render_reminder_email


def test_render_reminder_email_includes_message_in_both_bodies() -> None:
    result = render_reminder_email("Call the bank at 3pm")

    assert "Call the bank at 3pm" in result.text_body
    assert "Call the bank at 3pm" in result.html_body


def test_render_reminder_email_has_a_subject() -> None:
    result = render_reminder_email("Anything")
    assert result.subject == "Todotak reminder"


def test_render_reminder_email_html_is_well_formed_enough() -> None:
    result = render_reminder_email("Test message")
    assert result.html_body.strip().startswith("<!DOCTYPE html>")
    assert "</html>" in result.html_body


def test_render_reminder_email_escapes_nothing_special_but_preserves_content() -> None:
    message = "Pick up documents & sign by 5pm"
    result = render_reminder_email(message)
    assert message in result.text_body
